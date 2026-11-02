
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LoyaltyType,
  OrderStatus,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { OrderStateMachine } from '../orders/domain/order-state-machine';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payments.dto';

/** Sau khi controller đã hợp nhất header/body, khóa idempotency luôn có mặt. */
export type CreatePaymentInput = CreatePaymentDto & {
  idempotencyKey: string;
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * FR-10:
   * Quy đổi 10.000 VND = 1 điểm.
   * Chỉ lấy phần nguyên, không làm tròn lên.
   */
  private calculateLoyaltyPoints(
    totalAmount: Prisma.Decimal,
  ): number {
    return Math.floor(totalAmount.toNumber() / 10_000);
  }

  /**
   * Ghi nhận điểm thưởng sau khi thanh toán thành công.
   *
   * LoyaltyTransaction và User.loyaltyPoints được cập nhật
   * trong cùng một transaction.
   *
   * Unique constraint [orderId, type] bảo đảm mỗi đơn hàng
   * chỉ có tối đa một giao dịch EARN.
   */
  private async awardLoyaltyPoints(orderId: string): Promise<number> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const order = await tx.order.findUnique({
            where: { orderId },
          });

          if (!order) {
            throw new NotFoundException(
              'Không tìm thấy đơn hàng khi tích điểm.',
            );
          }

          if (order.status !== OrderStatus.PAID) {
            throw new ConflictException(
              'Chỉ đơn hàng đã thanh toán mới được tích điểm.',
            );
          }

          const existingEarn = await tx.loyaltyTransaction.findUnique({
            where: {
              orderId_type: {
                orderId,
                type: LoyaltyType.EARN,
              },
            },
          });

          const user = await tx.user.findUnique({
            where: { userId: order.userId },
            select: {
              loyaltyPoints: true,
            },
          });

          if (!user) {
            throw new NotFoundException(
              'Không tìm thấy tài khoản khách hàng.',
            );
          }

          // Đơn hàng đã được tích điểm trước đó.
          // Không cộng lại.
          if (existingEarn) {
            return user.loyaltyPoints;
          }

          const points = this.calculateLoyaltyPoints(
            order.totalAmount,
          );

          // Đơn hàng dưới 10.000 VND không được cộng điểm.
          if (points <= 0) {
            return user.loyaltyPoints;
          }

          // Ghi lịch sử tích điểm.
          await tx.loyaltyTransaction.create({
            data: {
              userId: order.userId,
              orderId: order.orderId,
              points,
              type: LoyaltyType.EARN,
            },
          });

          // Cập nhật số điểm hiện tại của khách hàng.
          const updatedUser = await tx.user.update({
            where: {
              userId: order.userId,
            },
            data: {
              loyaltyPoints: {
                increment: points,
              },
            },
            select: {
              loyaltyPoints: true,
            },
          });

          return updatedUser.loyaltyPoints;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      /**
       * Hai request đồng thời có thể cùng cố tạo EARN.
       *
       * Nếu request hiện tại thua cuộc vì unique constraint,
       * đọc lại giao dịch EARN và số điểm hiện tại.
       * Tuyệt đối không cộng điểm lần thứ hai.
       */
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existingEarn =
          await this.prisma.loyaltyTransaction.findUnique({
            where: {
              orderId_type: {
                orderId,
                type: LoyaltyType.EARN,
              },
            },
          });

        if (existingEarn) {
          const order = await this.prisma.order.findUnique({
            where: { orderId },
            select: {
              userId: true,
            },
          });

          if (order) {
            const user = await this.prisma.user.findUnique({
              where: {
                userId: order.userId,
              },
              select: {
                loyaltyPoints: true,
              },
            });

            if (user) {
              return user.loyaltyPoints;
            }
          }
        }
      }

      throw error;
    }
  }

  /**
   * Bổ sung thông tin điểm thưởng vào response thanh toán.
   *
   * Nếu tích điểm gặp lỗi:
   * - Không thay đổi kết quả thanh toán.
   * - Trả loyaltyAwardPending = true.
   * - Cho phép retry cùng Idempotency-Key để thử tích điểm lại.
   */
  private async attachLoyaltyPoints<
    T extends {
      payment: {
        status: PaymentStatus;
        orderId: string;
      };
      orderStatus: OrderStatus;
    },
  >(result: T) {
    if (
      result.payment.status !== PaymentStatus.PAID ||
      result.orderStatus !== OrderStatus.PAID
    ) {
      return {
        ...result,
        loyaltyPoints: null,
        loyaltyAwardPending: false,
      };
    }

    try {
      const loyaltyPoints = await this.awardLoyaltyPoints(
        result.payment.orderId,
      );

      return {
        ...result,
        loyaltyPoints,
        loyaltyAwardPending: false,
      };
    } catch (error) {
      this.logger.error(
        `Không thể tích điểm cho đơn hàng ${result.payment.orderId}`,
        error instanceof Error ? error.stack : String(error),
      );

      return {
        ...result,
        loyaltyPoints: null,
        loyaltyAwardPending: true,
      };
    }
  }

  /**
   * Tạo thanh toán.
   *
   * - Chỉ hỗ trợ mock provider.
   * - Kiểm tra Idempotency-Key.
   * - Kiểm tra trạng thái đơn hàng.
   * - Sử dụng OrderStateMachine.
   * - Chống thanh toán trùng.
   * - Tích điểm sau khi thanh toán thành công.
   */
  async create(dto: CreatePaymentInput) {
    const provider = this.config.get<string>(
      'PAYMENT_PROVIDER',
      'mock',
    );

    const nodeEnv = this.config.get<string>(
      'NODE_ENV',
      'development',
    );

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
      where: {
        orderId: dto.orderId,
      },
    });

    if (!order) {
      throw new NotFoundException(
        'Không tìm thấy đơn hàng.',
      );
    }

    // Retry cùng khóa sẽ trả về payment đã lưu.
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
      return this.attachLoyaltyPoints({
        payment: existing,
        orderStatus: order.status,
        reused: true,
      });
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

    // FR-08: Luôn kiểm tra transition bằng OrderStateMachine.
    if (order.status === OrderStatus.PAYMENT_FAILED) {
      OrderStateMachine.assertTransition(
        OrderStatus.PAYMENT_FAILED,
        OrderStatus.PENDING,
      );
    }

    OrderStateMachine.assertTransition(
      OrderStatus.PENDING,
      nextOrderStatus,
    );

    const transactionReference =
      `MOCK-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}`;

    try {
      // Transaction 1: Xử lý trạng thái đơn và tạo payment.
      const result = await this.prisma.$transaction(
        async (tx) => {
          // Nếu thanh toán lại đơn PAYMENT_FAILED,
          // đưa trạng thái về PENDING trước.
          if (order.status === OrderStatus.PAYMENT_FAILED) {
            const reset = await tx.order.updateMany({
              where: {
                orderId: order.orderId,
                status: OrderStatus.PAYMENT_FAILED,
              },
              data: {
                status: OrderStatus.PENDING,
              },
            });

            if (reset.count !== 1) {
              throw new ConflictException(
                'Đơn hàng đã được xử lý bởi một yêu cầu khác.',
              );
            }
          }

          // Chỉ một request được phép chuyển PENDING.
          const updated = await tx.order.updateMany({
            where: {
              orderId: order.orderId,
              status: OrderStatus.PENDING,
            },
            data: {
              status: nextOrderStatus,
            },
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
              amount: new Prisma.Decimal(
                order.totalAmount.toString(),
              ),
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
        },
      );

      // Transaction 2: Tích điểm sau khi payment đã commit.
      return this.attachLoyaltyPoints(result);
    } catch (error) {
      /**
       * Xử lý request đồng thời:
       * - ConflictException: request khác vừa xử lý đơn.
       * - P2002: trùng Idempotency-Key.
       *
       * Nếu request thắng cuộc đã tạo payment,
       * trả lại payment đó và tiếp tục kiểm tra tích điểm.
       */
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
            where: {
              orderId: order.orderId,
            },
          });

          return this.attachLoyaltyPoints({
            payment: duplicate,
            orderStatus: latestOrder?.status ?? order.status,
            reused: true,
          });
        }
      }

      throw error;
    }
  }
}
