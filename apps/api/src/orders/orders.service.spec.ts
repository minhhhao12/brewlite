import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OptionType, OrderStatus, Prisma, UserRole } from '@prisma/client';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { PrismaService } from '../prisma/prisma.service';
import { PromotionsService } from '../promotions/promotions.service';
import { OrdersService } from './orders.service';

describe('OrdersService (FR-05, FR-08, FR-09, FR-10, NFR-05, CV21)', () => {
  let service: OrdersService;
  let mockLoyaltyService: {
    earnPoints: jest.Mock;
    reversePoints: jest.Mock;
    getPoints: jest.Mock;
  };
  let prisma: {
    $transaction: jest.Mock;
    product: {
      findMany: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
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
    version: 0,
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
        findUnique: jest.fn(),
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

    mockLoyaltyService = {
      earnPoints: jest.fn(),
      reversePoints: jest.fn(),
      getPoints: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        PromotionsService,
        { provide: LoyaltyService, useValue: mockLoyaltyService },
        { provide: PrismaService, useValue: prisma },
      ],
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
        where: { productId: mockProduct.productId, version: 0, stock: { gte: 2 } },
        data: { stock: { decrement: 2 }, version: { increment: 1 } },
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

    it('từ chối khi mã khuyến mãi không tồn tại trên hệ thống (CV21)', async () => {
      prisma.product.findMany.mockResolvedValue([mockProduct]);
      prisma.promotion.findUnique.mockResolvedValue(null);

      await expect(
        service.createOrder('user-1', {
          items: [{ productId: mockProduct.productId, quantity: 1 }],
          promoCode: 'SAIMATROI',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('từ chối khi mã khuyến mãi đã hết hạn (CV21)', async () => {
      prisma.product.findMany.mockResolvedValue([mockProduct]);
      prisma.promotion.findUnique.mockResolvedValue({
        promotionId: 'promo-expired',
        code: 'HETHAN',
        discountType: 'FIXED',
        discountValue: new Prisma.Decimal(10000),
        maxDiscount: null,
        minimumOrderAmount: new Prisma.Decimal(20000),
        startAt: new Date(Date.now() - 7200000),
        endAt: new Date(Date.now() - 3600000),
        status: 'ACTIVE',
      });

      await expect(
        service.createOrder('user-1', {
          items: [{ productId: mockProduct.productId, quantity: 1 }],
          promoCode: 'HETHAN',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('từ chối khi mã khuyến mãi chưa đến thời gian áp dụng (CV21)', async () => {
      prisma.product.findMany.mockResolvedValue([mockProduct]);
      prisma.promotion.findUnique.mockResolvedValue({
        promotionId: 'promo-future',
        code: 'CHOGIO',
        discountType: 'FIXED',
        discountValue: new Prisma.Decimal(10000),
        maxDiscount: null,
        minimumOrderAmount: new Prisma.Decimal(20000),
        startAt: new Date(Date.now() + 3600000),
        endAt: new Date(Date.now() + 7200000),
        status: 'ACTIVE',
      });

      await expect(
        service.createOrder('user-1', {
          items: [{ productId: mockProduct.productId, quantity: 1 }],
          promoCode: 'CHOGIO',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('từ chối khi mã khuyến mãi có trạng thái INACTIVE (CV21)', async () => {
      prisma.product.findMany.mockResolvedValue([mockProduct]);
      prisma.promotion.findUnique.mockResolvedValue({
        promotionId: 'promo-inactive',
        code: 'KHOA',
        discountType: 'FIXED',
        discountValue: new Prisma.Decimal(10000),
        maxDiscount: null,
        minimumOrderAmount: new Prisma.Decimal(20000),
        startAt: new Date(Date.now() - 3600000),
        endAt: new Date(Date.now() + 3600000),
        status: 'INACTIVE',
      });

      await expect(
        service.createOrder('user-1', {
          items: [{ productId: mockProduct.productId, quantity: 1 }],
          promoCode: 'KHOA',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('từ chối khi đơn hàng chưa đạt giá trị tối thiểu của mã khuyến mãi (CV21)', async () => {
      prisma.product.findMany.mockResolvedValue([mockProduct]); // 29,000 VND
      prisma.promotion.findUnique.mockResolvedValue({
        promotionId: 'promo-min',
        code: 'TOITHIEU50K',
        discountType: 'FIXED',
        discountValue: new Prisma.Decimal(10000),
        maxDiscount: null,
        minimumOrderAmount: new Prisma.Decimal(50000),
        startAt: new Date(Date.now() - 3600000),
        endAt: new Date(Date.now() + 3600000),
        status: 'ACTIVE',
      });

      await expect(
        service.createOrder('user-1', {
          items: [{ productId: mockProduct.productId, quantity: 1 }],
          promoCode: 'TOITHIEU50K',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('áp dụng mã khuyến mãi theo phần trăm có trần maxDiscount chính xác (CV21)', async () => {
      prisma.product.findMany.mockResolvedValue([mockProduct]);
      prisma.product.updateMany.mockResolvedValue({ count: 1 });
      // Giảm 50% trần tối đa 10,000 cho đơn 29,000 -> giảm 10,000 thay vì 14,500
      prisma.promotion.findUnique.mockResolvedValue({
        promotionId: 'promo-percent',
        code: 'GIAM50',
        discountType: 'PERCENTAGE',
        discountValue: new Prisma.Decimal(50),
        maxDiscount: new Prisma.Decimal(10000),
        minimumOrderAmount: new Prisma.Decimal(20000),
        startAt: new Date(Date.now() - 3600000),
        endAt: new Date(Date.now() + 3600000),
        status: 'ACTIVE',
      });
      prisma.order.create.mockImplementation(async ({ data }: { data: any }) => ({
        orderId: 'order-percent',
        ...data,
        items: [],
      }));

      const result = await service.createOrder('user-1', {
        items: [{ productId: mockProduct.productId, quantity: 1 }],
        promoCode: 'GIAM50',
      });

      expect(result.subtotal).toBe(29000);
      expect(result.discountAmount).toBe(10000);
      expect(result.totalAmount).toBe(19000);
    });

    it('kiểm soát tồn kho bằng optimistic locking (version) khi trừ stock (CV18)', async () => {
      prisma.product.findMany.mockResolvedValue([mockProduct]);
      prisma.product.updateMany.mockResolvedValue({ count: 1 });
      prisma.order.create.mockImplementation(async ({ data }: { data: any }) => ({
        orderId: 'order-optimistic',
        ...data,
        items: [],
      }));

      await service.createOrder('user-1', {
        items: [{ productId: mockProduct.productId, quantity: 2 }],
      });

      expect(prisma.product.updateMany).toHaveBeenCalledWith({
        where: {
          productId: mockProduct.productId,
          version: mockProduct.version,
          stock: { gte: 2 },
        },
        data: {
          stock: { decrement: 2 },
          version: { increment: 1 },
        },
      });
    });

    it('báo lỗi rõ ràng khi cập nhật thất bại do hết hàng trong kho (CV18)', async () => {
      prisma.product.findMany.mockResolvedValue([mockProduct]);
      prisma.product.updateMany.mockResolvedValue({ count: 0 });
      prisma.product.findUnique.mockResolvedValue({
        stock: 0,
        name: mockProduct.name,
      });

      await expect(
        service.createOrder('user-1', {
          items: [{ productId: mockProduct.productId, quantity: 1 }],
        }),
      ).rejects.toThrow('đã hết hàng hoặc không đủ số lượng trong kho');
    });

    it('tự động retry và thành công khi gặp xung đột version đồng thời nhưng kho vẫn còn đủ hàng (CV18)', async () => {
      prisma.product.findMany.mockResolvedValue([mockProduct]);
      prisma.product.updateMany
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 1 });
      prisma.product.findUnique.mockResolvedValue({
        stock: 45,
        name: mockProduct.name,
      });
      prisma.order.create.mockImplementation(async ({ data }: { data: any }) => ({
        orderId: 'order-retry-success',
        ...data,
        items: [],
      }));

      const result = await service.createOrder('user-1', {
        items: [{ productId: mockProduct.productId, quantity: 1 }],
      });

      expect(result).toBeDefined();
      expect(prisma.product.updateMany).toHaveBeenCalledTimes(2);
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
        data: { stock: { increment: 3 }, version: { increment: 1 } },
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

  describe('getMyOrders (FR-07, CV16)', () => {
    it('trả về danh sách đơn hàng của chính user với đầy đủ mã đơn, trạng thái, tổng, ngày, items', async () => {
      const mockDate = new Date('2026-10-24T10:00:00Z');
      prisma.order.findMany.mockResolvedValue([
        {
          orderId: 'order-1',
          orderCode: 'BL-20261024-0001',
          userId: 'user-1',
          promotionId: null,
          subtotal: new Prisma.Decimal(45000),
          discountAmount: new Prisma.Decimal(5000),
          totalAmount: new Prisma.Decimal(40000),
          status: OrderStatus.PENDING,
          createdAt: mockDate,
          items: [
            {
              orderItemId: 'item-1',
              orderId: 'order-1',
              productId: 'prod-1',
              productName: 'Cà phê Sữa Đá',
              quantity: 1,
              unitPrice: new Prisma.Decimal(45000),
              subtotal: new Prisma.Decimal(45000),
              options: [
                {
                  orderItemOptionId: 'opt-1',
                  optionName: 'Size L',
                  optionType: OptionType.SIZE,
                  priceAdjustment: new Prisma.Decimal(10000),
                },
              ],
            },
          ],
          promotion: null,
        },
      ]);

      const orders = await service.getMyOrders('user-1');

      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        include: {
          items: {
            include: { options: true },
          },
          promotion: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(orders).toHaveLength(1);
      const firstOrder = orders[0];
      // Kiểm tra đầy đủ thông tin: mã đơn, trạng thái, tổng, ngày, items
      expect(firstOrder.orderCode).toBe('BL-20261024-0001');
      expect(firstOrder.status).toBe(OrderStatus.PENDING);
      expect(firstOrder.totalAmount).toBe(40000);
      expect(firstOrder.createdAt).toEqual(mockDate);
      expect(firstOrder.items).toHaveLength(1);
      expect(firstOrder.items[0].productName).toBe('Cà phê Sữa Đá');
      expect(firstOrder.items[0].options[0].optionName).toBe('Size L');
    });
  });

  describe('getOrderById (FR-07, CV16 - Chi tiết đơn hàng cho màn hình xác nhận)', () => {
    const mockOrder = {
      orderId: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
      orderCode: 'BL-20261024-9999',
      userId: 'user-owner',
      promotionId: null,
      subtotal: new Prisma.Decimal(35000),
      discountAmount: new Prisma.Decimal(0),
      totalAmount: new Prisma.Decimal(35000),
      status: OrderStatus.PENDING,
      createdAt: new Date('2026-10-24T12:00:00Z'),
      items: [
        {
          orderItemId: 'item-uuid-1',
          orderId: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
          productId: 'prod-uuid-1',
          productName: 'Trà Đào Cam Sả',
          quantity: 1,
          unitPrice: new Prisma.Decimal(35000),
          subtotal: new Prisma.Decimal(35000),
          options: [],
        },
      ],
      promotion: null,
    };

    it('trả về chi tiết đơn hàng cho chính user sở hữu đơn (bằng UUID orderId)', async () => {
      prisma.order.findFirst.mockResolvedValue(mockOrder);

      const result = await service.getOrderById(
        'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
        'user-owner',
        UserRole.CUSTOMER,
      );

      expect(result.id).toBe('a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d');
      expect(result.orderCode).toBe('BL-20261024-9999');
      expect(result.totalAmount).toBe(35000);
      expect(result.items).toHaveLength(1);
    });

    it('hỗ trợ tìm kiếm theo mã đơn hàng orderCode (không phải UUID)', async () => {
      prisma.order.findFirst.mockResolvedValue(mockOrder);

      const result = await service.getOrderById(
        'BL-20261024-9999',
        'user-owner',
        UserRole.CUSTOMER,
      );

      expect(prisma.order.findFirst).toHaveBeenCalledWith({
        where: { orderCode: 'BL-20261024-9999' },
        include: {
          items: {
            include: { options: true },
          },
          promotion: true,
        },
      });
      expect(result.orderCode).toBe('BL-20261024-9999');
    });

    it('chặn người dùng khác xem đơn hàng không thuộc về mình (Chỉ trả đơn của chính user)', async () => {
      prisma.order.findFirst.mockResolvedValue(mockOrder);

      await expect(
        service.getOrderById(
          'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
          'user-intruder',
          UserRole.CUSTOMER,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('cho phép tài khoản nhân viên (STAFF) xem chi tiết đơn hàng', async () => {
      prisma.order.findFirst.mockResolvedValue(mockOrder);

      const result = await service.getOrderById(
        'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
        'staff-user-id',
        UserRole.STAFF,
      );

      expect(result.id).toBe('a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d');
      expect(result.totalAmount).toBe(35000);
    });

    it('báo lỗi NotFoundException khi không tìm thấy đơn hàng', async () => {
      prisma.order.findFirst.mockResolvedValue(null);

      await expect(
        service.getOrderById('non-existent-order', 'user-owner', UserRole.CUSTOMER),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancelOrder (CV21, FR-10)', () => {
    it('gọi loyaltyService.reversePoints khi hủy đơn hàng đã thanh toán PAID', async () => {
      const paidOrder = {
        orderId: 'order-paid',
        userId: 'user-owner',
        status: OrderStatus.PAID,
        items: [{ productId: 'prod-1', quantity: 2 }],
      };

      prisma.order.findFirst.mockResolvedValue(paidOrder);
      prisma.order.updateMany.mockResolvedValue({ count: 1 });
      prisma.product.update.mockResolvedValue({});
      prisma.order.findUniqueOrThrow.mockResolvedValue({
        ...paidOrder,
        status: OrderStatus.CANCELLED,
        subtotal: new Prisma.Decimal(50000),
        discountAmount: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(50000),
        items: [],
      });

      await service.cancelOrder('order-paid', 'user-owner', UserRole.STAFF);

      expect(mockLoyaltyService.reversePoints).toHaveBeenCalledWith(
        'user-owner',
        'order-paid',
      );
    });

    it('không gọi loyaltyService.reversePoints khi hủy đơn chưa thanh toán PENDING', async () => {
      const pendingOrder = {
        orderId: 'order-pending',
        userId: 'user-owner',
        status: OrderStatus.PENDING,
        items: [{ productId: 'prod-1', quantity: 1 }],
      };

      prisma.order.findFirst.mockResolvedValue(pendingOrder);
      prisma.order.updateMany.mockResolvedValue({ count: 1 });
      prisma.product.update.mockResolvedValue({});
      prisma.order.findUniqueOrThrow.mockResolvedValue({
        ...pendingOrder,
        status: OrderStatus.CANCELLED,
        subtotal: new Prisma.Decimal(29000),
        discountAmount: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(29000),
        items: [],
      });

      await service.cancelOrder('order-pending', 'user-owner', UserRole.CUSTOMER);

      expect(mockLoyaltyService.reversePoints).not.toHaveBeenCalled();
    });
  });
});
