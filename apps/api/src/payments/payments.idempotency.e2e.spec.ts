import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsModule } from './payments.module';

type OrderRow = { orderId: string; userId: string; status: string; totalAmount: Prisma.Decimal };
type PaymentRow = {
  paymentId: string;
  userId: string;
  orderId: string;
  idempotencyKey: string;
  amount: Prisma.Decimal;
  method: string;
  status: string;
  transactionReference: string;
};

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

/**
 * DB giả trong bộ nhớ, mô phỏng đúng 3 hành vi mà idempotency dựa vào:
 *  - unique (userId, orderId, idempotencyKey) -> lỗi P2002 như Prisma thật;
 *  - updateMany có điều kiện trả { count } (khóa lạc quan);
 *  - $transaction chạy lần lượt từng cái (giống khóa dòng của PostgreSQL).
 */
class FakePrisma {
  readonly orders = new Map<string, OrderRow>();
  readonly payments: PaymentRow[] = [];
  orderUpdates = 0;
  private lock: Promise<unknown> = Promise.resolve();
  private barrier: { waiting: Array<() => void>; size: number } | null = null;

  /** Bắt N request cùng dừng ở bước kiểm tra "đã có payment chưa" rồi mới cho chạy tiếp: ép đúng tình huống đua. */
  holdPaymentLookupsUntil(size: number): void {
    this.barrier = { waiting: [], size };
  }

  order = {
    findUnique: async ({ where }: { where: { orderId: string } }) => {
      await tick();
      return this.orders.get(where.orderId) ?? null;
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: { orderId: string; status: string };
      data: { status: string };
    }) => {
      const row = this.orders.get(where.orderId);
      if (!row || row.status !== where.status) return { count: 0 };
      row.status = data.status;
      this.orderUpdates += 1;
      return { count: 1 };
    },
  };

  payment = {
    findUnique: async ({
      where,
    }: {
      where: {
        userId_orderId_idempotencyKey: { userId: string; orderId: string; idempotencyKey: string };
      };
    }) => {
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
    create: async ({ data }: { data: Omit<PaymentRow, 'paymentId'> }) => {
      const duplicated = this.payments.some(
        (p) =>
          p.userId === data.userId &&
          p.orderId === data.orderId &&
          p.idempotencyKey === data.idempotencyKey,
      );
      if (duplicated) {
        throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        });
      }
      const row: PaymentRow = { paymentId: randomUUID(), ...data };
      this.payments.push(row);
      return row;
    },
  };

  loyaltyTransaction = {
    findUnique: async () => null,
    create: async ({ data }: { data: any }) => ({ transactionId: randomUUID(), ...data }),
  };

  user = {
    findUnique: async () => null,
    update: async () => ({}),
  };

  $transaction = <T>(callback: (tx: FakePrisma) => Promise<T>): Promise<T> => {
    const run = this.lock.then(() => callback(this));
    this.lock = run.catch(() => undefined);
    return run;
  };

  seedOrder(status = 'PENDING'): OrderRow {
    const row: OrderRow = {
      orderId: randomUUID(),
      userId: randomUUID(),
      status,
      totalAmount: new Prisma.Decimal(45000),
    };
    this.orders.set(row.orderId, row);
    return row;
  }
}

describe('POST /payments - Idempotency-Key (CV17, FR-06)', () => {
  let app: INestApplication;
  let db: FakePrisma;

  beforeEach(async () => {
    db = new FakePrisma();
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        PrismaModule,
        PaymentsModule,
      ],
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

  const pay = (
    orderId: string,
    headers: Record<string, string> = {},
    body: Record<string, unknown> = {},
  ) =>
    request(app.getHttpServer())
      .post('/payments')
      .set(headers)
      .send({ orderId, method: 'WALLET', ...body });

  it('Test (b): gửi 2 lần cùng Idempotency-Key chỉ tạo 1 thanh toán và trả lại kết quả cũ', async () => {
    const order = db.seedOrder();

    const first = await pay(order.orderId, { 'Idempotency-Key': 'key-abc' }).expect(201);
    const second = await pay(order.orderId, { 'Idempotency-Key': 'key-abc' }).expect(201);

    expect(first.body.reused).toBe(false);
    expect(first.body.orderStatus).toBe('PAID');
    expect(second.body.reused).toBe(true);
    expect(second.body.payment.paymentId).toBe(first.body.payment.paymentId);
    expect(second.body.orderStatus).toBe('PAID');

    expect(db.payments).toHaveLength(1); // không tạo/ trừ lần 2
    expect(db.orderUpdates).toBe(1); // đơn chỉ đổi trạng thái đúng 1 lần
  });

  it('gửi song song 2 request cùng key (bấm đúp) vẫn chỉ tạo 1 thanh toán, cả hai đều thành công', async () => {
    const order = db.seedOrder();
    db.holdPaymentLookupsUntil(2); // cả hai request cùng thấy "chưa có payment" rồi mới tranh nhau ghi

    const [a, b] = await Promise.all([
      pay(order.orderId, { 'Idempotency-Key': 'double-click' }),
      pay(order.orderId, { 'Idempotency-Key': 'double-click' }),
    ]);

    expect([a.status, b.status]).toEqual([201, 201]);
    expect(a.body.payment.paymentId).toBe(b.body.payment.paymentId);
    expect([a.body.reused, b.body.reused].sort()).toEqual([false, true]);
    expect(db.payments).toHaveLength(1);
    expect(db.orderUpdates).toBe(1);
  });

  it('khác key trên đơn đã PAID thì bị từ chối 409, không tạo thanh toán thứ hai', async () => {
    const order = db.seedOrder();

    await pay(order.orderId, { 'Idempotency-Key': 'key-1' }).expect(201);
    const res = await pay(order.orderId, { 'Idempotency-Key': 'key-2' }).expect(409);

    expect(res.body.statusCode).toBe(409);
    expect(db.payments).toHaveLength(1);
  });

  it('thanh toán lỗi rồi thử lại bằng key mới là hai lần thanh toán khác nhau', async () => {
    const order = db.seedOrder();

    const failed = await pay(
      order.orderId,
      { 'Idempotency-Key': 'try-1' },
      { simulateFailure: true },
    ).expect(201);
    const retried = await pay(order.orderId, { 'Idempotency-Key': 'try-2' }).expect(201);

    expect(failed.body.orderStatus).toBe('PAYMENT_FAILED');
    expect(retried.body.orderStatus).toBe('PAID');
    expect(retried.body.payment.paymentId).not.toBe(failed.body.payment.paymentId);
    expect(db.payments).toHaveLength(2);
  });

  it('gửi lại key của lần thất bại thì trả kết quả thất bại cũ, không tính lại', async () => {
    const order = db.seedOrder();

    const first = await pay(
      order.orderId,
      { 'Idempotency-Key': 'try-1' },
      { simulateFailure: true },
    ).expect(201);
    const replay = await pay(order.orderId, { 'Idempotency-Key': 'try-1' }).expect(201);

    expect(replay.body.reused).toBe(true);
    expect(replay.body.payment.paymentId).toBe(first.body.payment.paymentId);
    expect(replay.body.payment.status).toBe('FAILED');
    expect(db.payments).toHaveLength(1);
  });

  it('cùng key nhưng khác đơn là hai thanh toán độc lập (khóa gắn với từng đơn)', async () => {
    const a = db.seedOrder();
    const b = db.seedOrder();

    await pay(a.orderId, { 'Idempotency-Key': 'shared' }).expect(201);
    const res = await pay(b.orderId, { 'Idempotency-Key': 'shared' }).expect(201);

    expect(res.body.reused).toBe(false);
    expect(db.payments).toHaveLength(2);
  });

  it('thiếu Idempotency-Key thì 400 và không đụng tới DB', async () => {
    const order = db.seedOrder();

    const res = await pay(order.orderId).expect(400);

    expect(res.body.message).toContain('Idempotency-Key');
    expect(db.payments).toHaveLength(0);
    expect(order.status).toBe('PENDING');
  });

  it('Idempotency-Key dài hơn 64 ký tự thì 400', async () => {
    const order = db.seedOrder();

    await pay(order.orderId, { 'Idempotency-Key': 'x'.repeat(65) }).expect(400);
    expect(db.payments).toHaveLength(0);
  });

  it('header và body gửi khóa khác nhau thì 400; body đứng một mình vẫn được (client cũ)', async () => {
    const order = db.seedOrder();

    await pay(order.orderId, { 'Idempotency-Key': 'a' }, { idempotencyKey: 'b' }).expect(400);
    expect(db.payments).toHaveLength(0);

    const legacy = await pay(order.orderId, {}, { idempotencyKey: 'legacy' }).expect(201);
    expect(legacy.body.reused).toBe(false);
  });

  it('đơn không tồn tại thì 404', async () => {
    await pay(randomUUID(), { 'Idempotency-Key': 'k' }).expect(404);
  });
});
