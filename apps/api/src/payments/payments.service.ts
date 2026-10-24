
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OrderStatus,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { OrderStateMachine } from '../orders/domain/order-state-machine';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payments.dto';

/** Sau khi controller đã hợp nhất header/body, khóa idempotency luôn có mặt. */
export type CreatePaymentInput = CreatePaymentDto & { idempotencyKey: string };

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async create(dto: CreatePaymentInput) {
    const provider = this.config.get<string>('PAYMENT_PROVIDER', 'mock');
    const nodeEnv = this.config.get<string>('NODE_ENV', 'development');

    if (provider !== 'mock') {
      throw new ServiceUnavailableException(
        'Payment provider hiện chưa được triển khai.',
      );
    }

    if (dto.simulateFailure && nodeEnv === 'production') {
      throw new BadRequestException(
        'Không được mô phỏng kết quả thanh toán trong production.',
      );
    }

    const order = await this.prisma.order.findUnique({
      where: { orderId: dto.orderId },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng.');
    }

    // Retry cùng khóa sẽ trả về kết quả đã lưu, không tạo payment mới.
    const existing = await this.prisma.payment.findUnique({
      where: {
        userId_orderId_idempotencyKey: {
          userId: order.userId,
          orderId: order.orderId,
          idempotencyKey: dto.idempotencyKey,
        },
      },
    });

    if (existing) {
      return {
        payment: existing,
        orderStatus: order.status,
        reused: true,
      };
    }

    if (
      order.status !== OrderStatus.PENDING &&
      order.status !== OrderStatus.PAYMENT_FAILED
    ) {
      throw new ConflictException(
        `Không thể thanh toán đơn hàng ở trạng thái ${order.status}.`,
      );
    }

    const failed = dto.simulateFailure === true;
    const paymentStatus = failed
      ? PaymentStatus.FAILED
      : PaymentStatus.PAID;
    const nextOrderStatus = failed
      ? OrderStatus.PAYMENT_FAILED
      : OrderStatus.PAID;

    // FR-08: PaymentsService không tự định nghĩa transition, luôn hỏi OrderStateMachine.
    // PAYMENT_FAILED -> PENDING (thử lại) rồi PENDING -> PAID | PAYMENT_FAILED.
    if (order.status === OrderStatus.PAYMENT_FAILED) {
      OrderStateMachine.assertTransition(
        OrderStatus.PAYMENT_FAILED,
        OrderStatus.PENDING,
      );
    }
    OrderStateMachine.assertTransition(OrderStatus.PENDING, nextOrderStatus);

    const transactionReference =
      `MOCK-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        if (order.status === OrderStatus.PAYMENT_FAILED) {
          const reset = await tx.order.updateMany({
            where: {
              orderId: order.orderId,
              status: OrderStatus.PAYMENT_FAILED,
            },
            data: { status: OrderStatus.PENDING },
          });
          // Một request khác vừa đổi trạng thái đơn (ví dụ đã PAID) -> không ghi đè.
          if (reset.count !== 1) {
            throw new ConflictException(
              'Đơn hàng đã được xử lý bởi một yêu cầu khác.',
            );
          }
        }

        // Chỉ một yêu cầu được phép chuyển đơn PENDING.
        const updated = await tx.order.updateMany({
          where: {
            orderId: order.orderId,
            status: OrderStatus.PENDING,
          },
          data: { status: nextOrderStatus },
        });

        if (updated.count !== 1) {
          throw new ConflictException(
            'Đơn hàng đã được xử lý bởi một yêu cầu khác.',
          );
        }

        const payment = await tx.payment.create({
          data: {
            userId: order.userId,
            orderId: order.orderId,
            idempotencyKey: dto.idempotencyKey,
            amount: new Prisma.Decimal(order.totalAmount.toString()),
            method: dto.method,
            status: paymentStatus,
            transactionReference,
          },
        });

        return {
          payment,
          orderStatus: nextOrderStatus,
          reused: false,
        };
      });

      return result;
    } catch (error) {
      // Retry đồng thời cùng Idempotency-Key: request thua cuộc có thể dính P2002
      // (trùng unique key) hoặc 409 (đơn vừa bị request thắng cuộc đổi trạng thái).
      // Cả hai trường hợp đều trả kết quả đã lưu của request thắng cuộc.
      const isRace =
        error instanceof ConflictException ||
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002');

      if (isRace) {
        const duplicate = await this.prisma.payment.findUnique({
          where: {
            userId_orderId_idempotencyKey: {
              userId: order.userId,
              orderId: order.orderId,
              idempotencyKey: dto.idempotencyKey,
            },
          },
        });

        if (duplicate) {
          const latestOrder = await this.prisma.order.findUnique({
            where: { orderId: order.orderId },
          });

          return {
            payment: duplicate,
            orderStatus: latestOrder?.status ?? order.status,
            reused: true,
          };
        }
      }

      throw error;
    }
  }
}
