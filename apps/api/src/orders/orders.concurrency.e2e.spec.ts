import { ExecutionContext, HttpStatus, ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { OptionType, OrderStatus, Prisma, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersModule } from './orders.module';

type FakeProduct = {
  productId: string;
  name: string;
  description: string;
  basePrice: Prisma.Decimal;
  stock: number;
  version: number;
  status: string;
  options: any[];
};

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

/**
 * Fake Prisma in-memory mô phỏng chính xác hành vi của PostgreSQL:
 * 1. Read với barrier để ép tình huống race condition (nhiều request đồng thời cùng đọc stock/version).
 * 2. Optimistic locking: updateMany({ where: { version, stock: { gte: qty } } }).
 * 3. Atomic state transitions và transaction serialization.
 */
class FakePrismaOrders {
  readonly products = new Map<string, FakeProduct>();
  readonly orders: any[] = [];
  productUpdates = 0;
  private barrier: { waiting: Array<() => void>; size: number } | null = null;

  /** Ép N request cùng dừng lại ở bước đọc sản phẩm để mô phỏng tranh chấp đồng thời (race condition) */
  holdLookupsUntil(size: number): void {
    this.barrier = { waiting: [], size };
  }

  product = {
    findMany: async ({ where }: { where: { productId: { in: string[] } } }) => {
      await tick();
      const barrier = this.barrier;
      if (barrier) {
        await new Promise<void>((resolve) => {
          barrier.waiting.push(resolve);
          if (barrier.waiting.length >= barrier.size) {
            this.barrier = null;
            barrier.waiting.forEach((release) => release());
          }
        });
      }
      return (where.productId.in || [])
        .map((id) => this.products.get(id))
        .filter(Boolean)
        .map((p) => ({ ...p!, basePrice: new Prisma.Decimal(p!.basePrice) }));
    },

    findUnique: async ({ where }: { where: { productId: string } }) => {
      await tick();
      const p = this.products.get(where.productId);
      return p ? { ...p, basePrice: new Prisma.Decimal(p.basePrice) } : null;
    },

    updateMany: async ({
      where,
      data,
    }: {
      where: { productId: string; version?: number; stock?: { gte?: number } };
      data: { stock?: { decrement?: number }; version?: { increment?: number } };
    }) => {
      await tick();
      const p = this.products.get(where.productId);
      if (!p) return { count: 0 };

      // Kiểm tra điều kiện Optimistic Locking (version)
      if (where.version !== undefined && p.version !== where.version) {
        return { count: 0 };
      }

      // Kiểm tra điều kiện tồn kho (stock >= qty)
      if (where.stock?.gte !== undefined && p.stock < where.stock.gte) {
        return { count: 0 };
      }

      // Cập nhật tồn kho và version nguyên tử
      if (data.stock?.decrement !== undefined) {
        p.stock -= data.stock.decrement;
      }
      if (data.version?.increment !== undefined) {
        p.version += data.version.increment;
      }

      this.productUpdates += 1;
      return { count: 1 };
    },

    update: async ({
      where,
      data,
    }: {
      where: { productId: string };
      data: { stock?: { increment?: number }; version?: { increment?: number } };
    }) => {
      await tick();
      const p = this.products.get(where.productId);
      if (!p) throw new Error('Product not found');

      if (data.stock?.increment !== undefined) {
        p.stock += data.stock.increment;
      }
      if (data.version?.increment !== undefined) {
        p.version += data.version.increment;
      }

      return { ...p, basePrice: new Prisma.Decimal(p.basePrice) };
    },
  };

  order = {
    create: async ({ data }: { data: any }) => {
      await tick();
      const newOrder = {
        orderId: randomUUID(),
        ...data,
        items: (data.items?.create || []).map((it: any) => ({
          orderItemId: randomUUID(),
          ...it,
          options: (it.options?.create || []).map((opt: any) => ({
            orderItemOptionId: randomUUID(),
            ...opt,
          })),
        })),
        promotion: null,
      };
      this.orders.push(newOrder);
      return newOrder;
    },
  };

  promotion = {
    findUnique: async () => null,
  };

  $transaction = async <T>(callback: (tx: FakePrismaOrders) => Promise<T>): Promise<T> => {
    return callback(this);
  };

  seedProduct(stock: number, version = 0): FakeProduct {
    const prod: FakeProduct = {
      productId: randomUUID(),
      name: 'Cà phê Sữa Đá Test Concurrency',
      description: 'Món dùng để test bắn request đồng thời',
      basePrice: new Prisma.Decimal(29000),
      stock,
      version,
      status: 'ACTIVE',
      options: [
        {
          optionId: randomUUID(),
          name: 'Size M',
          type: OptionType.SIZE,
          priceAdjustment: new Prisma.Decimal(6000),
          isAvailable: true,
        },
      ],
    };
    this.products.set(prod.productId, prod);
    return prod;
  }
}

describe('POST /orders - Concurrency & Optimistic Locking (CV18, CONC-T01, NFR-05)', () => {
  let app: INestApplication;
  let db: FakePrismaOrders;

  beforeEach(async () => {
    db = new FakePrismaOrders();

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        PrismaModule,
        OrdersModule,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = {
            userId: req.headers['x-user-id'] || 'user-customer-test',
            email: 'customer@brewlite.vn',
            role: UserRole.CUSTOMER,
          };
          return true;
        },
      })
      .overrideProvider(PrismaService)
      .useValue(db)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const placeOrder = (productId: string, quantity: number, userId = 'user-test') =>
    request(app.getHttpServer())
      .post('/orders')
      .set('x-user-id', userId)
      .send({
        items: [{ productId, quantity }],
      });

  it('Test (c): đặt đồng thời không vượt tồn kho - 10 request song song mua sản phẩm chỉ còn tồn kho = 3', async () => {
    // 1. Chuẩn bị sản phẩm chỉ còn đúng 3 ly trong kho
    const product = db.seedProduct(3, 0);

    // 2. Ép barrier: 10 request cùng đọc stock = 3 và version = 0 tại cùng một thời điểm
    db.holdLookupsUntil(10);

    // 3. Bắn 10 request đồng thời (Promise.all)
    const requests = Array.from({ length: 10 }, (_, i) =>
      placeOrder(product.productId, 1, `user-${i}`),
    );

    const responses = await Promise.all(requests);

    // 4. Phân loại kết quả phản hồi
    const successResponses = responses.filter((r) => r.status === HttpStatus.CREATED);
    const failureResponses = responses.filter(
      (r) => r.status === HttpStatus.BAD_REQUEST || r.status === HttpStatus.CONFLICT,
    );

    // 5. Kiểm tra tiêu chí hoàn thành của CV18:
    // - ĐÚNG 3 request thành công (bằng tồn kho ban đầu)
    expect(successResponses).toHaveLength(3);
    for (const res of successResponses) {
      expect(res.body).toHaveProperty('orderCode');
      expect(res.body.status).toBe(OrderStatus.PENDING);
    }

    // - ĐÚNG 7 request thất bại vì hết hàng
    expect(failureResponses).toHaveLength(7);
    for (const res of failureResponses) {
      expect(res.body.message).toMatch(/hết hàng|không đủ hàng|không đủ số lượng/i);
    }

    // - Tồn kho sau cùng trong DB phải là 0, TUYỆT ĐỐI KHÔNG BỊ ÂM (chống oversell)
    const productInDb = db.products.get(product.productId)!;
    expect(productInDb.stock).toBe(0);

    // - Version phải được tăng tương ứng với số giao dịch thành công (0 + 3 = 3)
    expect(productInDb.version).toBe(3);

    // - Tổng số đơn hàng thực sự được tạo trong DB đúng bằng 3
    expect(db.orders).toHaveLength(3);
  });

  it('bắn đồng thời với số lượng lớn hơn 1: kho còn 5, 3 khách cùng đặt mỗi người 2 ly', async () => {
    // Kho còn 5 ly
    const product = db.seedProduct(5, 0);

    // 3 request cùng đặt mỗi người 2 ly (Tổng nhu cầu = 6 > 5)
    db.holdLookupsUntil(3);

    const requests = [
      placeOrder(product.productId, 2, 'user-a'),
      placeOrder(product.productId, 2, 'user-b'),
      placeOrder(product.productId, 2, 'user-c'),
    ];

    const responses = await Promise.all(requests);

    const successResponses = responses.filter((r) => r.status === HttpStatus.CREATED);
    const failureResponses = responses.filter((r) => r.status === HttpStatus.BAD_REQUEST);

    // Chỉ có 2 request thành công (2 * 2 = 4 ly), request thứ 3 phải thất bại vì còn lại 1 không đủ cho 2
    expect(successResponses).toHaveLength(2);
    expect(failureResponses).toHaveLength(1);
    expect(failureResponses[0].body.message).toMatch(
      /hết hàng|không đủ hàng|không đủ số lượng/i,
    );

    // Tồn kho còn lại đúng 1 ly, không bị âm
    const productInDb = db.products.get(product.productId)!;
    expect(productInDb.stock).toBe(1);
    expect(productInDb.version).toBe(2);
    expect(db.orders).toHaveLength(2);
  });

  it('từ chối ngay từ đầu khi kho đã có stock = 0 trước khi đặt', async () => {
    const product = db.seedProduct(0, 0);

    const res = await placeOrder(product.productId, 1).expect(HttpStatus.BAD_REQUEST);

    expect(res.body.message).toMatch(/không đủ hàng trong kho/i);
    expect(db.orders).toHaveLength(0);
  });
});
