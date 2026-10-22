import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { OptionType, OrderStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStateMachine } from './domain/order-state-machine';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Chuyển đổi bản ghi Order từ Prisma sang định dạng phản hồi chuẩn cho client.
   */
  public mapOrderResponse(order: any) {
    return {
      id: order.orderId,
      orderId: order.orderId,
      orderCode: order.orderCode,
      userId: order.userId,
      promotionId: order.promotionId,
      subtotal:
        order.subtotal instanceof Prisma.Decimal
          ? order.subtotal.toNumber()
          : Number(order.subtotal),
      discountAmount:
        order.discountAmount instanceof Prisma.Decimal
          ? order.discountAmount.toNumber()
          : Number(order.discountAmount),
      totalAmount:
        order.totalAmount instanceof Prisma.Decimal
          ? order.totalAmount.toNumber()
          : Number(order.totalAmount),
      status: order.status,
      createdAt: order.createdAt,
      items: (order.items || []).map((item: any) => ({
        id: item.orderItemId,
        orderItemId: item.orderItemId,
        orderId: item.orderId,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice:
          item.unitPrice instanceof Prisma.Decimal
            ? item.unitPrice.toNumber()
            : Number(item.unitPrice),
        subtotal:
          item.subtotal instanceof Prisma.Decimal
            ? item.subtotal.toNumber()
            : Number(item.subtotal),
        options: (item.options || []).map((opt: any) => ({
          id: opt.orderItemOptionId,
          orderItemOptionId: opt.orderItemOptionId,
          optionName: opt.optionName,
          optionType: opt.optionType,
          priceAdjustment:
            opt.priceAdjustment instanceof Prisma.Decimal
              ? opt.priceAdjustment.toNumber()
              : Number(opt.priceAdjustment),
        })),
      })),
      promotion: order.promotion,
    };
  }

  /**
   * FR-05 / FR-09 / NFR-05: Tạo đơn hàng trong Transaction Serializable,
   * kiểm tra tồn kho, tính giá server-side và trừ tồn kho nguyên tử.
   */
  async createOrder(userId: string, dto: CreateOrderDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Giỏ hàng không được để trống.');
    }

    const uniqueProductIds = [...new Set(dto.items.map((i) => i.productId))];

    return this.prisma.$transaction(
      async (tx) => {
        // Đọc danh sách sản phẩm và các tùy chọn từ DB
        const products = await tx.product.findMany({
          where: { productId: { in: uniqueProductIds } },
          include: { options: true },
        });

        if (products.length !== uniqueProductIds.length) {
          throw new BadRequestException('Một hoặc nhiều sản phẩm không tồn tại.');
        }

        const productMap = new Map(products.map((p) => [p.productId, p]));

        // Kiểm tra trạng thái hoạt động của món
        for (const product of products) {
          if (product.status !== 'ACTIVE') {
            throw new BadRequestException(`Sản phẩm "${product.name}" hiện không còn mở bán.`);
          }
        }

        // Gom tổng số lượng yêu cầu theo từng productId để kiểm tra tồn kho
        const productQuantities = new Map<string, number>();
        for (const item of dto.items) {
          const current = productQuantities.get(item.productId) || 0;
          productQuantities.set(item.productId, current + item.quantity);
        }

        for (const [pId, qty] of productQuantities.entries()) {
          const product = productMap.get(pId)!;
          if (product.stock < qty) {
            throw new BadRequestException(
              `Sản phẩm "${product.name}" không đủ hàng trong kho (Còn ${product.stock}, yêu cầu ${qty}).`,
            );
          }
        }

        // Tính toán lại giá từ database (chống gian lận giá client-side - FR-05)
        let subtotal = 0;
        const orderItemsToCreate: Array<{
          productId: string;
          productName: string;
          quantity: number;
          unitPrice: Prisma.Decimal;
          subtotal: Prisma.Decimal;
          options: Array<{
            optionName: string;
            optionType: OptionType;
            priceAdjustment: Prisma.Decimal;
          }>;
        }> = [];

        for (const item of dto.items) {
          const product = productMap.get(item.productId)!;
          let unitPrice = product.basePrice.toNumber();
          const optionsToCreate: Array<{
            optionName: string;
            optionType: OptionType;
            priceAdjustment: Prisma.Decimal;
          }> = [];

          // Tùy chọn Size
          if (item.sizeOptionId) {
            const sizeOption = product.options.find(
              (opt) => opt.optionId === item.sizeOptionId && opt.type === OptionType.SIZE,
            );
            if (!sizeOption || !sizeOption.isAvailable) {
              throw new BadRequestException(
                `Tùy chọn Size không hợp lệ cho sản phẩm "${product.name}".`,
              );
            }
            const sizeDelta = sizeOption.priceAdjustment.toNumber();
            unitPrice += sizeDelta;
            optionsToCreate.push({
              optionName: sizeOption.name,
              optionType: OptionType.SIZE,
              priceAdjustment: new Prisma.Decimal(sizeDelta),
            });
          }

          // Tùy chọn Topping
          if (item.toppingOptionIds && item.toppingOptionIds.length > 0) {
            for (const toppingId of item.toppingOptionIds) {
              const toppingOption = product.options.find(
                (opt) => opt.optionId === toppingId && opt.type === OptionType.TOPPING,
              );
              if (!toppingOption || !toppingOption.isAvailable) {
                throw new BadRequestException(
                  `Tùy chọn Topping không hợp lệ cho sản phẩm "${product.name}".`,
                );
              }
              const toppingDelta = toppingOption.priceAdjustment.toNumber();
              unitPrice += toppingDelta;
              optionsToCreate.push({
                optionName: toppingOption.name,
                optionType: OptionType.TOPPING,
                priceAdjustment: new Prisma.Decimal(toppingDelta),
              });
            }
          }

          const itemSubtotal = unitPrice * item.quantity;
          subtotal += itemSubtotal;

          orderItemsToCreate.push({
            productId: product.productId,
            productName: product.name,
            quantity: item.quantity,
            unitPrice: new Prisma.Decimal(unitPrice),
            subtotal: new Prisma.Decimal(itemSubtotal),
            options: optionsToCreate,
          });
        }

        // Xử lý mã khuyến mãi (FR-09)
        let discountAmount = 0;
        let promotionId: string | undefined = undefined;

        if (dto.promoCode) {
          const code = dto.promoCode.trim().toUpperCase();
          const now = new Date();
          const promo = await tx.promotion.findUnique({
            where: { code },
          });

          if (
            !promo ||
            promo.status !== 'ACTIVE' ||
            promo.startAt > now ||
            promo.endAt < now ||
            subtotal < promo.minimumOrderAmount.toNumber()
          ) {
            throw new BadRequestException(
              'Mã khuyến mãi không hợp lệ, đã hết hạn hoặc không đủ điều kiện áp dụng.',
            );
          }

          const promoVal = promo.discountValue.toNumber();
          let discount =
            promo.discountType === 'PERCENTAGE' ? (subtotal * promoVal) / 100 : promoVal;

          if (promo.maxDiscount) {
            discount = Math.min(discount, promo.maxDiscount.toNumber());
          }
          discount = Math.min(discount, subtotal);
          discountAmount = discount;
          promotionId = promo.promotionId;
        }

        const totalAmount = Math.max(0, subtotal - discountAmount);
        const orderCode = `BL-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

        // Trừ tồn kho nguyên tử (chống oversell)
        for (const [pId, qty] of productQuantities.entries()) {
          const updated = await tx.product.updateMany({
            where: { productId: pId, stock: { gte: qty } },
            data: { stock: { decrement: qty } },
          });

          if (updated.count === 0) {
            throw new BadRequestException(
              'Tồn kho sản phẩm đã thay đổi, không đủ số lượng để hoàn tất đơn hàng.',
            );
          }
        }

        // Tạo Order + OrderItem + OrderItemOption
        const order = await tx.order.create({
          data: {
            orderCode,
            userId,
            promotionId,
            subtotal: new Prisma.Decimal(subtotal),
            discountAmount: new Prisma.Decimal(discountAmount),
            totalAmount: new Prisma.Decimal(totalAmount),
            status: OrderStatus.PENDING,
            items: {
              create: orderItemsToCreate.map((item) => ({
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                subtotal: item.subtotal,
                options: {
                  create: item.options,
                },
              })),
            },
          },
          include: {
            items: {
              include: { options: true },
            },
            promotion: true,
          },
        });

        return this.mapOrderResponse(order);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  /**
   * FR-07: Xem danh sách lịch sử đơn hàng của người dùng đang đăng nhập.
   */
  async getMyOrders(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          include: { options: true },
        },
        promotion: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((o) => this.mapOrderResponse(o));
  }

  /**
   * Xem chi tiết 1 đơn hàng theo ID.
   */
  async getOrderById(orderId: string, userId: string, role?: UserRole) {
    const order = await this.prisma.order.findFirst({
      where: { orderId },
      include: {
        items: {
          include: { options: true },
        },
        promotion: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với mã: ${orderId}`);
    }

    if (order.userId !== userId && role !== UserRole.STAFF) {
      throw new ForbiddenException('Bạn không có quyền xem thông tin đơn hàng này.');
    }

    return this.mapOrderResponse(order);
  }

  /**
   * Hủy đơn hàng và hoàn lại tồn kho nguyên tử.
   */
  async cancelOrder(orderId: string, userId: string, role?: UserRole) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { orderId },
        include: { items: true },
      });

      if (!order) {
        throw new NotFoundException(`Không tìm thấy đơn hàng với mã: ${orderId}`);
      }

      if (order.userId !== userId && role !== UserRole.STAFF) {
        throw new ForbiddenException('Bạn không có quyền hủy đơn hàng này.');
      }

      // (1) Khách chỉ được tự hủy khi đơn chưa thanh toán.
      //     PAID/PREPARING là luồng của nhân viên (hủy + hoàn tiền).
      const customerCanCancel =
        order.status === OrderStatus.PENDING || order.status === OrderStatus.PAYMENT_FAILED;

      if (!customerCanCancel && role !== UserRole.STAFF) {
        throw new ForbiddenException(
          'Đơn hàng đã thanh toán hoặc đang xử lý, chỉ nhân viên mới có thể hủy.',
        );
      }

      // Kiểm tra state machine trước để trả lỗi 400 dễ hiểu.
      OrderStateMachine.assertTransition(order.status, OrderStatus.CANCELLED);

      // (2) Chốt trạng thái nguyên tử: chỉ 1 request được đi tiếp.
      //     Request thua cuộc nhận count = 0 -> không hoàn kho.
      const locked = await tx.order.updateMany({
        where: { orderId, status: order.status },
        data: { status: OrderStatus.CANCELLED },
      });

      if (locked.count === 0) {
        throw new ConflictException(
          'Đơn hàng vừa được cập nhật bởi thao tác khác, vui lòng tải lại và thử lại.',
        );
      }

      // Hoàn kho chỉ chạy sau khi đã thắng chốt ở trên.
      for (const item of order.items) {
        await tx.product.update({
          where: { productId: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      const updated = await tx.order.findUniqueOrThrow({
        where: { orderId },
        include: {
          items: { include: { options: true } },
          promotion: true,
        },
      });

      return this.mapOrderResponse(updated);
    });
  }

  /**
   * Cập nhật trạng thái đơn hàng (Dành cho Barista / Staff theo FR-08).
   */
  async updateStatus(orderId: string, nextStatus: OrderStatus) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { orderId },
      });

      if (!order) {
        throw new NotFoundException(`Không tìm thấy đơn hàng với mã: ${orderId}`);
      }

      OrderStateMachine.assertTransition(order.status, nextStatus);

      const updated = await tx.order.update({
        where: { orderId },
        data: { status: nextStatus },
        include: {
          items: {
            include: { options: true },
          },
          promotion: true,
        },
      });

      return this.mapOrderResponse(updated);
    });
  }
}
