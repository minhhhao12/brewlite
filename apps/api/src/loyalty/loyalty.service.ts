
import { Injectable, Logger } from '@nestjs/common';
import { LoyaltyTransaction, LoyaltyType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);
  private readonly VND_PER_POINT = 10_000;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tính điểm thưởng: 10.000 VNĐ = 1 điểm.
   */
  private calculateEarnedPoints(totalAmount: number): number {
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return 0;
    }

    return Math.floor(totalAmount / this.VND_PER_POINT);
  }

  /**
   * Tính số điểm còn lại sau khi hoàn điểm.
   * Không cho phép số điểm tích lũy bị âm.
   */
  private calculateReversalPoints(
    currentPoints: number,
    earnedPoints: number,
  ): number {
    return Math.max(0, currentPoints - earnedPoints);
  }

  /**
   * FR-10: Tích lũy điểm thưởng sau khi đơn hàng chuyển sang PAID.
   * - Idempotent theo (orderId, EARN).
   * - Ghi nhận lịch sử giao dịch.
   * - Cộng điểm nguyên tử vào tài khoản.
   */
  async earnPoints(
    userId: string,
    orderId: string,
    totalAmount: number,
  ): Promise<LoyaltyTransaction | null> {
    const points = this.calculateEarnedPoints(totalAmount);

    try {
      return await this.prisma.$transaction(async (tx) => {
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

        const transaction = await tx.loyaltyTransaction.create({
          data: {
            userId,
            orderId,
            points,
            type: LoyaltyType.EARN,
          },
        });

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
        `Lỗi khi cộng điểm loyalty cho user ${userId}, đơn ${orderId}: ${
          error instanceof Error ? error.message : error
        }`,
      );

      throw error;
    }
  }

  /**
   * Hoàn lại điểm thưởng khi đơn đã PAID bị hủy.
   * - Idempotent theo (orderId, REVERSAL).
   * - Không để điểm tích lũy bị âm.
   */
  async reversePoints(
    userId: string,
    orderId: string,
  ): Promise<LoyaltyTransaction | null> {
    return this.prisma.$transaction(async (tx) => {
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

      const user = await tx.user.findUniqueOrThrow({
        where: { userId },
        select: { loyaltyPoints: true },
      });

      const newPoints = this.calculateReversalPoints(
        user.loyaltyPoints,
        earnTx.points,
      );

      const reversalTx = await tx.loyaltyTransaction.create({
        data: {
          userId,
          orderId,
          points: -earnTx.points,
          type: LoyaltyType.REVERSAL,
        },
      });

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
