import { Injectable, Logger } from '@nestjs/common';
import { LoyaltyTransaction, LoyaltyType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoyaltyPolicy } from './domain/loyalty-policy';

@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * FR-10: Tích lũy điểm thưởng thành viên sau khi đơn hàng chuyển sang PAID.
   * - Hoạt động idempotent theo ràng buộc duy nhất (orderId, EARN).
   * - Cộng floor(totalAmount / 10000) điểm vào tài khoản người dùng.
   * - Ghi nhận lịch sử vào bảng LoyaltyTransaction.
   */
  async earnPoints(
    userId: string,
    orderId: string,
    totalAmount: number,
  ): Promise<LoyaltyTransaction | null> {
    const points = LoyaltyPolicy.calculateEarnedPoints(totalAmount);

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Kiểm tra xem đơn hàng đã từng được cộng điểm chưa (chặn cộng lặp lại)
        const existing = await tx.loyaltyTransaction.findUnique({
          where: {
            orderId_type: {
              orderId,
              type: LoyaltyType.EARN,
            },
          },
        });

        if (existing) {
          this.logger.debug(
            `Đơn hàng ${orderId} đã được cộng điểm trước đó (${existing.points} điểm). Bỏ qua thao tác lặp.`,
          );
          return existing;
        }

        // Tạo bản ghi giao dịch điểm thưởng
        const transaction = await tx.loyaltyTransaction.create({
          data: {
            userId,
            orderId,
            points,
            type: LoyaltyType.EARN,
          },
        });

        // Cập nhật điểm tích lũy của người dùng nguyên tử
        if (points > 0) {
          await tx.user.update({
            where: { userId },
            data: {
              loyaltyPoints: { increment: points },
            },
          });
        }

        this.logger.log(
          `Đã cộng ${points} điểm loyalty cho người dùng ${userId} từ đơn hàng ${orderId}.`,
        );

        return transaction;
      });
    } catch (error) {
      // Xử lý race condition đồng thời (Prisma P2002 - Unique constraint violation)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const duplicate = await this.prisma.loyaltyTransaction.findUnique({
          where: {
            orderId_type: {
              orderId,
              type: LoyaltyType.EARN,
            },
          },
        });
        if (duplicate) {
          return duplicate;
        }
      }

      this.logger.error(
        `Lỗi khi cộng điểm loyalty cho user ${userId}, đơn ${orderId}: ${error instanceof Error ? error.message : error}`,
      );
      throw error;
    }
  }

  /**
   * Hoàn lại điểm thưởng khi đơn đã PAID bị hủy (PAID -> CANCELLED).
   * - Hoạt động idempotent theo (orderId, REVERSAL).
   * - Không làm điểm người dùng bị âm.
   */
  async reversePoints(
    userId: string,
    orderId: string,
  ): Promise<LoyaltyTransaction | null> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Kiểm tra đơn hàng có giao dịch EARN không
      const earnTx = await tx.loyaltyTransaction.findUnique({
        where: {
          orderId_type: {
            orderId,
            type: LoyaltyType.EARN,
          },
        },
      });

      if (!earnTx) {
        return null;
      }

      // 2. Kiểm tra nếu đã hoàn điểm rồi thì trả về giao dịch cũ (idempotent)
      const existingReversal = await tx.loyaltyTransaction.findUnique({
        where: {
          orderId_type: {
            orderId,
            type: LoyaltyType.REVERSAL,
          },
        },
      });

      if (existingReversal) {
        return existingReversal;
      }

      // 3. Đọc số điểm hiện tại của user để trừ an toàn (không âm)
      const user = await tx.user.findUniqueOrThrow({
        where: { userId },
        select: { loyaltyPoints: true },
      });

      const newPoints = LoyaltyPolicy.calculateReversalPoints(
        user.loyaltyPoints,
        earnTx.points,
      );

      // 4. Tạo bản ghi hoàn điểm
      const reversalTx = await tx.loyaltyTransaction.create({
        data: {
          userId,
          orderId,
          points: -earnTx.points,
          type: LoyaltyType.REVERSAL,
        },
      });

      // 5. Cập nhật số điểm mới
      await tx.user.update({
        where: { userId },
        data: { loyaltyPoints: newPoints },
      });

      return reversalTx;
    });
  }

  /**
   * Lấy số điểm tích lũy hiện tại của người dùng.
   */
  async getPoints(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: { loyaltyPoints: true },
    });
    return user?.loyaltyPoints ?? 0;
  }
}
