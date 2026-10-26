import { ExecutionContext, ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DiscountType, OrderStatus, PaymentMethod, Prisma, PromotionStatus, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { PromotionsModule } from './promotions.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';

class FakePrismaCV21 {
  readonly users = new Map<string, any>();
  readonly products = new Map<string, any>();
  readonly promotions = new Map<string, any>();
  readonly orders = new Map<string, any>();
  readonly payments: any[] = [];
  readonly loyaltyTransactions: any[] = [];

  user = {
    findUnique: async ({ where }: { where: { userId: string } }) => {
      return this.users.get(where.userId) ?? null;
    },
    update: async ({ where, data }: { where: { userId: string }; data: any }) => {
      const u = this.users.get(where.userId);
      if (!u) return null;
      if (data.loyaltyPoints?.increment !== undefined) {
        u.loyaltyPoints = (u.loyaltyPoints || 0) + data.loyaltyPoints.increment;
      } else if (typeof data.loyaltyPoints === 'number') {
        u.loyaltyPoints = data.loyaltyPoints;
      }
      return u;
    },
  };

  product = {
    findMany: async ({ where }: { where: { productId: { in: string[] } } }) => {
      return (where.productId.in || [])
        .map((id) => this.products.get(id))
        .filter(Boolean)
        .map((p) => ({ ...p, basePrice: new Prisma.Decimal(p.basePrice) }));
    },
    updateMany: async () => ({ count: 1 }),
  };

  promotion = {
    findUnique: async ({ where }: { where: { code: string } }) => {
      const p = this.promotions.get(where.code.toUpperCase());
      if (!p) return null;
      return {
        ...p,
        discountValue: new Prisma.Decimal(p.discountValue),
        maxDiscount: p.maxDiscount !== null ? new Prisma.Decimal(p.maxDiscount) : null,
        minimumOrderAmount: new Prisma.Decimal(p.minimumOrderAmount),
      };
    },
  };

  order = {
    create: async ({ data }: { data: any }) => {
      const orderId = randomUUID();
      const row = {
        orderId,
        orderCode: data.orderCode,
        userId: data.userId,
        promotionId: data.promotionId ?? null,
        subtotal: data.subtotal,
        discountAmount: data.discountAmount,
        totalAmount: data.totalAmount,
        status: data.status,
        createdAt: new Date(),
        items: (data.items?.create || []).map((it: any) => ({
          orderItemId: randomUUID(),
          ...it,
          options: (it.options?.create || []).map((opt: any) => ({
            orderItemOptionId: randomUUID(),
            ...opt,
          })),
        })),
        promotion: data.promotionId ? this.promotions.get(data.promotionId) : null,
      };
      this.orders.set(orderId, row);
      return row;
    },
    findUnique: async ({ where }: { where: { orderId: string } }) => {
      return this.orders.get(where.orderId) ?? null;
    },
    updateMany: async ({ where, data }: { where: { orderId: string }; data: any }) => {
      const o = this.orders.get(where.orderId);
      if (!o) return { count: 0 };
      o.status = data.status;
      return { count: 1 };
    },
  };

  payment = {
    findUnique: async ({ where }: { where: any }) => {
      const key = where.userId_orderId_idempotencyKey;
      return (
        this.payments.find(
          (p) =>
            p.userId === key.userId &&
            p.orderId === key.orderId &&
            p.idempotencyKey === key.idempotencyKey,
        ) ?? null
      );
    },
    create: async ({ data }: { data: any }) => {
      const p = { paymentId: randomUUID(), ...data };
      this.payments.push(p);
      return p;
    },
  };

  loyaltyTransaction = {
    findUnique: async ({ where }: { where: { orderId_type: { orderId: string; type: string } } }) => {
      const { orderId, type } = where.orderId_type;
      return (
        this.loyaltyTransactions.find(
          (tx) => tx.orderId === orderId && tx.type === type,
        ) ?? null
      );
    },
    create: async ({ data }: { data: any }) => {
      const tx = { transactionId: randomUUID(), ...data };
      this.loyaltyTransactions.push(tx);
      return tx;
    },
  };

  $transaction = async <T>(callback: (tx: FakePrismaCV21) => Promise<T>): Promise<T> => {
    return callback(this);
  };
}

describe('CV21 - Task 10: Khuyến mãi & Điểm thưởng E2E', () => {
  let app: INestApplication;
  let db: FakePrismaCV21;
  const testUserId = '11111111-1111-4111-8111-111111111111';
  const testProductId = '22222222-2222-4222-8222-222222222222';
  const promo10kId = '33333333-3333-4333-8333-333333333333';

  beforeEach(async () => {
    db = new FakePrismaCV21();

    // Seed test user
    db.users.set(testUserId, {
      userId: testUserId,
      email: 'customer@brewlite.vn',
      username: 'customer',
      loyaltyPoints: 0,
      role: UserRole.CUSTOMER,
      isActive: true,
    });

    // Seed test product: 45,000 VND, 100 stock
    db.products.set(testProductId, {
      productId: testProductId,
      name: 'Trà Sữa Oolong',
      description: 'Đậm vị trà',
      basePrice: 45000,
      stock: 100,
      version: 0,
      status: 'ACTIVE',
      options: [],
    });

    // Seed promotions
    // 1. Valid FIXED: GIAM10K (Min 30k)
    db.promotions.set('GIAM10K', {
      promotionId: promo10kId,
      code: 'GIAM10K',
      discountType: DiscountType.FIXED,
      discountValue: 10000,
      maxDiscount: null,
      minimumOrderAmount: 30000,
      startAt: new Date(Date.now() - 3600000),
      endAt: new Date(Date.now() + 3600000),
      status: PromotionStatus.ACTIVE,
    });

    // 2. Expired
    db.promotions.set('HETHAN', {
      promotionId: '44444444-4444-4444-8444-444444444444',
      code: 'HETHAN',
      discountType: DiscountType.FIXED,
      discountValue: 10000,
      maxDiscount: null,
      minimumOrderAmount: 20000,
      startAt: new Date(Date.now() - 7200000),
      endAt: new Date(Date.now() - 3600000),
      status: PromotionStatus.ACTIVE,
    });

    // 3. Min Order not met
    db.promotions.set('MIN100K', {
      promotionId: '55555555-5555-4555-8555-555555555555',
      code: 'MIN100K',
      discountType: DiscountType.FIXED,
      discountValue: 20000,
      maxDiscount: null,
      minimumOrderAmount: 100000,
      startAt: new Date(Date.now() - 3600000),
      endAt: new Date(Date.now() + 3600000),
      status: PromotionStatus.ACTIVE,
    });

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        PrismaModule,
        PromotionsModule,
        LoyaltyModule,
        OrdersModule,
        PaymentsModule,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = {
            userId: testUserId,
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

  describe('Tiêu chí nghiệm thu 1: Mã sai bị từ chối', () => {
    it('từ chối khi mã khuyến mãi không tồn tại', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .send({
          items: [{ productId: testProductId, quantity: 1 }],
          promoCode: 'MA_KHONG_TON_TAI',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('không tồn tại');
    });

    it('từ chối khi mã khuyến mãi đã hết hạn', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .send({
          items: [{ productId: testProductId, quantity: 1 }],
          promoCode: 'HETHAN',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('đã hết hạn');
    });

    it('từ chối khi đơn hàng không đạt giá trị tối thiểu', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .send({
          items: [{ productId: testProductId, quantity: 1 }], // 45,000 VND < 100,000 VND
          promoCode: 'MIN100K',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('chưa đạt giá trị tối thiểu');
    });

    it('áp dụng mã khuyến mãi hợp lệ thành công và tính đúng số tiền', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .send({
          items: [{ productId: testProductId, quantity: 1 }], // 45,000 VND
          promoCode: 'GIAM10K',
        });

      expect(res.status).toBe(201);
      expect(res.body.subtotal).toBe(45000);
      expect(res.body.discountAmount).toBe(10000);
      expect(res.body.totalAmount).toBe(35000);
      expect(res.body.promotionId).toBe(promo10kId);
    });
  });

  describe('Tiêu chí nghiệm thu 2: Điểm cộng đúng sau PAID', () => {
    it('cộng điểm loyalty chuẩn xác cho user sau khi đơn chuyển sang PAID (floor(totalAmount / 10000))', async () => {
      // 1. Tạo đơn hàng 45,000 VND (sau giảm 10k còn 35,000 VND)
      const orderRes = await request(app.getHttpServer())
        .post('/orders')
        .send({
          items: [{ productId: testProductId, quantity: 1 }],
          promoCode: 'GIAM10K',
        });

      const orderId = orderRes.body.orderId;
      expect(orderRes.body.totalAmount).toBe(35000);

      // Điểm ban đầu là 0
      expect(db.users.get(testUserId).loyaltyPoints).toBe(0);

      // 2. Thanh toán đơn hàng thành công
      const idempotencyKey = randomUUID();
      const payRes = await request(app.getHttpServer())
        .post('/payments')
        .set('Idempotency-Key', idempotencyKey)
        .send({
          orderId,
          method: PaymentMethod.WALLET,
        });

      expect(payRes.status).toBe(201);
      expect(payRes.body.orderStatus).toBe(OrderStatus.PAID);

      // 3. Kiểm tra số điểm được cộng: 35,000 / 10,000 = 3 điểm
      const user = db.users.get(testUserId);
      expect(user.loyaltyPoints).toBe(3);

      // Kiểm tra bản ghi LoyaltyTransaction
      const tx = db.loyaltyTransactions.find((t) => t.orderId === orderId);
      expect(tx).toBeDefined();
      expect(tx.points).toBe(3);
      expect(tx.type).toBe('EARN');

      // 4. Gọi lại thanh toán cùng Idempotency-Key -> Idempotent, điểm không bị cộng lần hai
      const retryRes = await request(app.getHttpServer())
        .post('/payments')
        .set('Idempotency-Key', idempotencyKey)
        .send({
          orderId,
          method: PaymentMethod.WALLET,
        });

      expect(retryRes.status).toBe(201);
      expect(retryRes.body.reused).toBe(true);
      // Điểm vẫn là 3, không bị tăng lên 6
      expect(db.users.get(testUserId).loyaltyPoints).toBe(3);
    });

    it('không cộng điểm loyalty khi thanh toán bị thất bại (PAYMENT_FAILED)', async () => {
      // 1. Tạo đơn hàng 45,000 VND
      const orderRes = await request(app.getHttpServer())
        .post('/orders')
        .send({
          items: [{ productId: testProductId, quantity: 1 }],
        });

      const orderId = orderRes.body.orderId;

      // 2. Thanh toán giả lập thất bại
      const payRes = await request(app.getHttpServer())
        .post('/payments')
        .set('Idempotency-Key', randomUUID())
        .send({
          orderId,
          method: PaymentMethod.CARD,
          simulateFailure: true,
        });

      expect(payRes.status).toBe(201);
      expect(payRes.body.orderStatus).toBe(OrderStatus.PAYMENT_FAILED);

      // Điểm vẫn giữ nguyên, không cộng
      expect(db.users.get(testUserId).loyaltyPoints).toBe(0);
      expect(db.loyaltyTransactions.filter((t) => t.orderId === orderId)).toHaveLength(0);
    });
  });
});
