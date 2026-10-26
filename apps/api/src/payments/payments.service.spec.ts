import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { OrderStatus, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { OrderStateMachine } from '../orders/domain/order-state-machine';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from './payments.service';

describe('PaymentsService + OrderStateMachine (FR-06, FR-08, FR-10)', () => {
  let service: PaymentsService;
  let mockLoyaltyService: {
    earnPoints: jest.Mock;
    reversePoints: jest.Mock;
    getPoints: jest.Mock;
  };
  let prisma: {
    $transaction: jest.Mock;
    order: { findUnique: jest.Mock; updateMany: jest.Mock };
    payment: { findUnique: jest.Mock; create: jest.Mock };
  };

  const orderWith = (status: OrderStatus) => ({
    orderId: 'order-1',
    userId: 'user-1',
    status,
    totalAmount: new Prisma.Decimal(45000),
  });

  const dto = {
    orderId: 'order-1',
    method: PaymentMethod.WALLET,
    idempotencyKey: 'key-1',
  };

  beforeEach(async () => {
    mockLoyaltyService = {
      earnPoints: jest.fn().mockResolvedValue({ transactionId: 'tx-1', points: 4 }),
      reversePoints: jest.fn(),
      getPoints: jest.fn(),
    };

    prisma = {
      $transaction: jest.fn().mockImplementation(async (callback) => callback(prisma)),
      order: { findUnique: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      payment: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => ({ paymentId: 'pay-1', ...data })),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: LoyaltyService, useValue: mockLoyaltyService },
        // Dùng giá trị mặc định: PAYMENT_PROVIDER = mock, NODE_ENV = development.
        {
          provide: ConfigService,
          useValue: { get: (_key: string, fallback?: unknown) => fallback },
        },
      ],
    }).compile();

    service = module.get(PaymentsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('thanh toán thành công: đơn PENDING -> PAID', async () => {
    prisma.order.findUnique.mockResolvedValue(orderWith(OrderStatus.PENDING));
    const assertSpy = jest.spyOn(OrderStateMachine, 'assertTransition');

    const result = await service.create(dto);

    expect(result.orderStatus).toBe(OrderStatus.PAID);
    expect(result.reused).toBe(false);
    expect(prisma.order.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.order.updateMany).toHaveBeenCalledWith({
      where: { orderId: 'order-1', status: OrderStatus.PENDING },
      data: { status: OrderStatus.PAID },
    });
    expect(prisma.payment.create.mock.calls[0][0].data.status).toBe(PaymentStatus.PAID);
    expect(assertSpy).toHaveBeenCalledWith(OrderStatus.PENDING, OrderStatus.PAID);
    expect(mockLoyaltyService.earnPoints).toHaveBeenCalledWith('user-1', 'order-1', 45000);
  });

  it('thanh toán thất bại đã xác minh: đơn PENDING -> PAYMENT_FAILED', async () => {
    prisma.order.findUnique.mockResolvedValue(orderWith(OrderStatus.PENDING));
    const assertSpy = jest.spyOn(OrderStateMachine, 'assertTransition');

    const result = await service.create({ ...dto, simulateFailure: true });

    expect(result.orderStatus).toBe(OrderStatus.PAYMENT_FAILED);
    expect(prisma.order.updateMany).toHaveBeenCalledWith({
      where: { orderId: 'order-1', status: OrderStatus.PENDING },
      data: { status: OrderStatus.PAYMENT_FAILED },
    });
    expect(prisma.payment.create.mock.calls[0][0].data.status).toBe(PaymentStatus.FAILED);
    expect(assertSpy).toHaveBeenCalledWith(OrderStatus.PENDING, OrderStatus.PAYMENT_FAILED);
    expect(mockLoyaltyService.earnPoints).not.toHaveBeenCalled();
  });

  it('thử lại sau khi thất bại: PAYMENT_FAILED -> PENDING -> PAID trên cùng đơn', async () => {
    prisma.order.findUnique.mockResolvedValue(orderWith(OrderStatus.PAYMENT_FAILED));
    const assertSpy = jest.spyOn(OrderStateMachine, 'assertTransition');

    const result = await service.create({ ...dto, idempotencyKey: 'key-2' });

    expect(result.orderStatus).toBe(OrderStatus.PAID);
    expect(prisma.order.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.order.updateMany).toHaveBeenNthCalledWith(1, {
      where: { orderId: 'order-1', status: OrderStatus.PAYMENT_FAILED },
      data: { status: OrderStatus.PENDING },
    });
    expect(prisma.order.updateMany).toHaveBeenNthCalledWith(2, {
      where: { orderId: 'order-1', status: OrderStatus.PENDING },
      data: { status: OrderStatus.PAID },
    });
    expect(assertSpy).toHaveBeenCalledWith(OrderStatus.PAYMENT_FAILED, OrderStatus.PENDING);
    expect(assertSpy).toHaveBeenCalledWith(OrderStatus.PENDING, OrderStatus.PAID);
  });

  it.each([
    OrderStatus.PAID,
    OrderStatus.PREPARING,
    OrderStatus.READY,
    OrderStatus.COMPLETED,
    OrderStatus.CANCELLED,
  ])('không cho thanh toán đơn đang ở trạng thái %s', async (status) => {
    prisma.order.findUnique.mockResolvedValue(orderWith(status));

    await expect(service.create(dto)).rejects.toThrow(ConflictException);
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('nếu OrderStateMachine từ chối thì không ghi bất cứ thứ gì xuống DB', async () => {
    prisma.order.findUnique.mockResolvedValue(orderWith(OrderStatus.PENDING));
    jest.spyOn(OrderStateMachine, 'assertTransition').mockImplementation(() => {
      throw new BadRequestException('Chuyển đổi trạng thái đơn hàng không hợp lệ');
    });

    await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('gửi lại cùng Idempotency-Key: trả kết quả đã lưu, không đổi trạng thái đơn', async () => {
    prisma.order.findUnique.mockResolvedValue(orderWith(OrderStatus.PAID));
    prisma.payment.findUnique.mockResolvedValue({ paymentId: 'pay-1', status: PaymentStatus.PAID });

    const result = await service.create(dto);

    expect(result.reused).toBe(true);
    expect(result.orderStatus).toBe(OrderStatus.PAID);
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('một request khác vừa đổi trạng thái đơn (count = 0) thì từ chối và không tạo payment', async () => {
    prisma.order.findUnique.mockResolvedValue(orderWith(OrderStatus.PENDING));
    prisma.order.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.create(dto)).rejects.toThrow(ConflictException);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });
});
