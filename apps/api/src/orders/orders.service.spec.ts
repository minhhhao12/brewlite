import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OptionType, OrderStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';

describe('OrdersService (FR-05, FR-08, FR-09, NFR-05)', () => {
  let service: OrdersService;
  let prisma: {
    $transaction: jest.Mock;
    product: {
      findMany: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
    };
    promotion: {
      findUnique: jest.Mock;
    };
    order: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
  };

  const mockProduct = {
    productId: 'prod-uuid-1',
    name: 'Cà phê Sữa Đá Truyền Thống',
    description: 'Đậm đà hương vị cà phê Robusta',
    basePrice: new Prisma.Decimal(29000),
    stock: 50,
    status: 'ACTIVE',
    options: [
      {
        optionId: 'opt-size-m',
        productId: 'prod-uuid-1',
        name: 'Size M (+50ml)',
        type: OptionType.SIZE,
        priceAdjustment: new Prisma.Decimal(6000),
        isAvailable: true,
      },
      {
        optionId: 'opt-top-cheese',
        productId: 'prod-uuid-1',
        name: 'Kem Cheese béo ngậy',
        type: OptionType.TOPPING,
        priceAdjustment: new Prisma.Decimal(10000),
        isAvailable: true,
      },
    ],
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(prisma);
      }),
      product: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
      promotion: {
        findUnique: jest.fn(),
      },
      order: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [OrdersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  describe('createOrder (FR-05, NFR-05)', () => {
    it('tính toán lại giá từ database (Base 29k + Size M 6k + Topping 10k = 45k x 2 = 90k)', async () => {
      prisma.product.findMany.mockResolvedValue([mockProduct]);
      prisma.product.updateMany.mockResolvedValue({ count: 1 }); // trừ kho thành công
      prisma.order.create.mockImplementation(async ({ data }: { data: any }) => ({
        orderId: 'order-1',
        ...data,
        items: data.items.create.map((it: any, index: number) => ({
          orderItemId: `item-${index}`,
          ...it,
          options: (it.options?.create || []).map((opt: any, oIdx: number) => ({
            orderItemOptionId: `opt-${oIdx}`,
            ...opt,
          })),
        })),
      }));

      const result = await service.createOrder('user-1', {
        items: [
          {
            productId: mockProduct.productId,
            quantity: 2,
            sizeOptionId: 'opt-size-m',
            toppingOptionIds: ['opt-top-cheese'],
          },
        ],
      });

      expect(prisma.product.updateMany).toHaveBeenCalledWith({
        where: { productId: mockProduct.productId, stock: { gte: 2 } },
        data: { stock: { decrement: 2 } },
      });
      expect(result.subtotal).toBe(90000);
      expect(result.totalAmount).toBe(90000);
      expect(result.discountAmount).toBe(0);
      expect(result.status).toBe(OrderStatus.PENDING);
    });

    it('từ chối khi tồn kho không đủ (chống oversell theo CONC-T01)', async () => {
      prisma.product.findMany.mockResolvedValue([
        {
          ...mockProduct,
          stock: 1, // Chỉ còn 1 sản phẩm
        },
      ]);

      await expect(
        service.createOrder('user-1', {
          items: [{ productId: mockProduct.productId, quantity: 5 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('từ chối khi sản phẩm không tồn tại', async () => {
      prisma.product.findMany.mockResolvedValue([]);

      await expect(
        service.createOrder('user-1', {
          items: [{ productId: 'non-existent-id', quantity: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('từ chối khi sản phẩm đã ngừng bán (status != ACTIVE)', async () => {
      prisma.product.findMany.mockResolvedValue([
        {
          ...mockProduct,
          status: 'HIDDEN',
        },
      ]);

      await expect(
        service.createOrder('user-1', {
          items: [{ productId: mockProduct.productId, quantity: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('áp dụng mã khuyến mãi hợp lệ và trừ tiền chính xác (FR-09)', async () => {
      prisma.product.findMany.mockResolvedValue([mockProduct]);
      prisma.product.updateMany.mockResolvedValue({ count: 1 });
      prisma.promotion.findUnique.mockResolvedValue({
        promotionId: 'promo-1',
        code: 'GIAM10K',
        discountType: 'FIXED',
        discountValue: new Prisma.Decimal(10000),
        maxDiscount: null,
        minimumOrderAmount: new Prisma.Decimal(20000),
        startAt: new Date(Date.now() - 3600000),
        endAt: new Date(Date.now() + 3600000),
        status: 'ACTIVE',
      });
      prisma.order.create.mockImplementation(async ({ data }: { data: any }) => ({
        orderId: 'order-promo',
        ...data,
        items: [],
      }));

      const result = await service.createOrder('user-1', {
        items: [{ productId: mockProduct.productId, quantity: 1 }],
        promoCode: 'GIAM10K',
      });

      expect(result.subtotal).toBe(29000);
      expect(result.discountAmount).toBe(10000);
      expect(result.totalAmount).toBe(19000);
    });
  });

  describe('cancelOrder', () => {
    it('hủy đơn hàng hợp lệ và hoàn lại số lượng tồn kho', async () => {
      const pendingOrder = {
        orderId: 'order-1',
        userId: 'user-1',
        status: OrderStatus.PENDING,
        items: [{ productId: mockProduct.productId, quantity: 3 }],
      };

      prisma.order.findFirst.mockResolvedValue(pendingOrder);
      prisma.order.updateMany.mockResolvedValue({ count: 1 });
      prisma.order.findUniqueOrThrow.mockResolvedValue({
        ...pendingOrder,
        status: OrderStatus.CANCELLED,
        items: [],
      });

      const cancelled = await service.cancelOrder('order-1', 'user-1');

      expect(cancelled.status).toBe(OrderStatus.CANCELLED);
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { productId: mockProduct.productId },
        data: { stock: { increment: 3 } },
      });
    });
    it('khách không được huỷ đơn đã thanh toán', async () => {
      prisma.order.findFirst.mockResolvedValue({
        orderId: 'order-1',
        userId: 'user-1',
        status: OrderStatus.PAID,
        items: [],
      });
      await expect(service.cancelOrder('order-1', 'user-1')).rejects.toThrow(ForbiddenException);
      expect(prisma.product.update).not.toHaveBeenCalled();
    });
    it('không hoàn kho khi đơn vừa bị request khác hủy (count = 0)', async () => {
      prisma.order.findFirst.mockResolvedValue({
        orderId: 'order-1',
        userId: 'user-1',
        status: OrderStatus.PENDING,
        items: [{ productId: mockProduct.productId, quantity: 3 }],
      });
      prisma.order.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.cancelOrder('order-1', 'user-1')).rejects.toThrow(ConflictException);
      expect(prisma.product.update).not.toHaveBeenCalled();
    });

    it('chặn người dùng khác hủy đơn hàng không thuộc về mình', async () => {
      const pendingOrder = {
        orderId: 'order-1',
        userId: 'user-owner',
        status: OrderStatus.PENDING,
        items: [],
      };

      prisma.order.findFirst.mockResolvedValue(pendingOrder);

      await expect(
        service.cancelOrder('order-1', 'user-intruder', UserRole.CUSTOMER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('báo lỗi NotFoundException khi đơn hàng không tồn tại', async () => {
      prisma.order.findFirst.mockResolvedValue(null);

      await expect(service.cancelOrder('non-existent-order', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    describe('chặn chuyển trạng thái sai bằng OrderStateMachine (FR-08)', () => {
      const orderWith = (status: OrderStatus) => ({
        orderId: 'order-1',
        userId: 'user-1',
        status,
        items: [{ productId: mockProduct.productId, quantity: 3 }],
      });

      it('nhân viên không được hủy lại đơn đã CANCELLED (tránh hoàn kho lần hai)', async () => {
        prisma.order.findFirst.mockResolvedValue(orderWith(OrderStatus.CANCELLED));
        prisma.order.updateMany.mockResolvedValue({ count: 1 });

        await expect(service.cancelOrder('order-1', 'staff-1', UserRole.STAFF)).rejects.toThrow(
          BadRequestException,
        );
        expect(prisma.order.updateMany).not.toHaveBeenCalled();
        expect(prisma.product.update).not.toHaveBeenCalled();
      });

      it('nhân viên không được hủy đơn đã COMPLETED (trạng thái cuối)', async () => {
        prisma.order.findFirst.mockResolvedValue(orderWith(OrderStatus.COMPLETED));

        await expect(service.cancelOrder('order-1', 'staff-1', UserRole.STAFF)).rejects.toThrow(
          BadRequestException,
        );
        expect(prisma.product.update).not.toHaveBeenCalled();
      });

      it('nhân viên không được hủy đơn đang PREPARING (thiết kế chỉ cho PAID → CANCELLED)', async () => {
        prisma.order.findFirst.mockResolvedValue(orderWith(OrderStatus.PREPARING));

        await expect(service.cancelOrder('order-1', 'staff-1', UserRole.STAFF)).rejects.toThrow(
          BadRequestException,
        );
        expect(prisma.product.update).not.toHaveBeenCalled();
      });

      it('nhân viên hủy đơn PAID thì được phép và hoàn kho (PAID → CANCELLED)', async () => {
        prisma.order.findFirst.mockResolvedValue(orderWith(OrderStatus.PAID));
        prisma.order.updateMany.mockResolvedValue({ count: 1 });
        prisma.order.findUniqueOrThrow.mockResolvedValue({
          ...orderWith(OrderStatus.CANCELLED),
          items: [],
        });

        const cancelled = await service.cancelOrder('order-1', 'staff-1', UserRole.STAFF);

        expect(cancelled.status).toBe(OrderStatus.CANCELLED);
        expect(prisma.product.update).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('updateStatus (FR-08, luồng KDS)', () => {
    const orderWith = (status: OrderStatus) => ({ orderId: 'order-1', userId: 'user-1', status });

    it('cho phép PAID → PREPARING', async () => {
      prisma.order.findFirst.mockResolvedValue(orderWith(OrderStatus.PAID));
      prisma.order.update.mockResolvedValue({ ...orderWith(OrderStatus.PREPARING), items: [] });

      const updated = await service.updateStatus('order-1', OrderStatus.PREPARING);

      expect(updated.status).toBe(OrderStatus.PREPARING);
      expect(prisma.order.update).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['nhảy cóc PAID → COMPLETED', OrderStatus.PAID, OrderStatus.COMPLETED],
      ['đi lùi READY → PREPARING', OrderStatus.READY, OrderStatus.PREPARING],
      ['đơn chưa thanh toán PENDING → PREPARING', OrderStatus.PENDING, OrderStatus.PREPARING],
      ['giữ nguyên trạng thái PAID → PAID', OrderStatus.PAID, OrderStatus.PAID],
      ['rời trạng thái cuối COMPLETED → READY', OrderStatus.COMPLETED, OrderStatus.READY],
    ])('chặn %s và không ghi DB', async (_name, from, to) => {
      prisma.order.findFirst.mockResolvedValue(orderWith(from));

      await expect(service.updateStatus('order-1', to)).rejects.toThrow(BadRequestException);
      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('báo NotFoundException khi đơn hàng không tồn tại', async () => {
      prisma.order.findFirst.mockResolvedValue(null);

      await expect(service.updateStatus('khong-co', OrderStatus.PREPARING)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getMyOrders (FR-07)', () => {
    it('trả về danh sách đơn hàng được ánh xạ đúng', async () => {
      prisma.order.findMany.mockResolvedValue([
        {
          orderId: 'order-1',
          orderCode: 'BL-TEST-1',
          userId: 'user-1',
          subtotal: new Prisma.Decimal(29000),
          discountAmount: new Prisma.Decimal(0),
          totalAmount: new Prisma.Decimal(29000),
          status: OrderStatus.PENDING,
          createdAt: new Date(),
          items: [],
        },
      ]);

      const orders = await service.getMyOrders('user-1');
      expect(orders).toHaveLength(1);
      expect(orders[0].id).toBe('order-1');
      expect(orders[0].subtotal).toBe(29000);
    });
  });
});
