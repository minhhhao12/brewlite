import { Test, TestingModule } from '@nestjs/testing';
import { LoyaltyType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoyaltyService } from './loyalty.service';

describe('LoyaltyService', () => {
  let service: LoyaltyService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(async (cb) => cb(prisma)),
      loyaltyTransaction: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoyaltyService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<LoyaltyService>(LoyaltyService);
  });

  describe('earnPoints', () => {
    it('cộng điểm chính xác cho đơn hàng và ghi transaction (FR-10)', async () => {
      prisma.loyaltyTransaction.findUnique.mockResolvedValue(null);
      prisma.loyaltyTransaction.create.mockResolvedValue({
        transactionId: 'tx-1',
        userId: 'user-1',
        orderId: 'order-1',
        points: 4,
        type: LoyaltyType.EARN,
      });
      prisma.user.update.mockResolvedValue({ userId: 'user-1', loyaltyPoints: 4 });

      // Đơn hàng 45,000 VND -> 4 điểm
      const result = await service.earnPoints('user-1', 'order-1', 45000);

      expect(prisma.loyaltyTransaction.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          orderId: 'order-1',
          points: 4,
          type: LoyaltyType.EARN,
        },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: {
          loyaltyPoints: { increment: 4 },
        },
      });
      expect(result?.points).toBe(4);
    });

    it('không cộng điểm lặp lại nếu đơn hàng đã từng được tích điểm (Idempotent)', async () => {
      const existingTx = {
        transactionId: 'tx-existing',
        userId: 'user-1',
        orderId: 'order-1',
        points: 4,
        type: LoyaltyType.EARN,
      };
      prisma.loyaltyTransaction.findUnique.mockResolvedValue(existingTx);

      const result = await service.earnPoints('user-1', 'order-1', 45000);

      expect(result).toBe(existingTx);
      expect(prisma.loyaltyTransaction.create).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('xử lý an toàn khi xảy ra race condition trùng khóa P2002', async () => {
      prisma.loyaltyTransaction.findUnique.mockResolvedValue({
        transactionId: 'tx-race',
        userId: 'user-1',
        orderId: 'order-1',
        points: 4,
        type: LoyaltyType.EARN,
      });

      const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.0.0',
      });
      prisma.$transaction.mockRejectedValueOnce(error);

      const result = await service.earnPoints('user-1', 'order-1', 45000);

      expect(result?.transactionId).toBe('tx-race');
    });

    it('không tăng user points khi đơn hàng không đủ tiền tích điểm (dưới 10,000 VND)', async () => {
      prisma.loyaltyTransaction.findUnique.mockResolvedValue(null);
      prisma.loyaltyTransaction.create.mockResolvedValue({
        transactionId: 'tx-zero',
        userId: 'user-1',
        orderId: 'order-1',
        points: 0,
        type: LoyaltyType.EARN,
      });

      const result = await service.earnPoints('user-1', 'order-1', 8000);

      expect(result?.points).toBe(0);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('reversePoints', () => {
    it('trừ điểm khi đơn hàng bị hủy sau khi đã thanh toán (PAID -> CANCELLED)', async () => {
      const earnTx = {
        transactionId: 'tx-earn',
        userId: 'user-1',
        orderId: 'order-1',
        points: 5,
        type: LoyaltyType.EARN,
      };
      prisma.loyaltyTransaction.findUnique
        .mockResolvedValueOnce(earnTx) // tìm earn
        .mockResolvedValueOnce(null); // kiểm tra reversal

      prisma.user.findUniqueOrThrow.mockResolvedValue({ loyaltyPoints: 10 });
      prisma.loyaltyTransaction.create.mockResolvedValue({
        transactionId: 'tx-rev',
        userId: 'user-1',
        orderId: 'order-1',
        points: -5,
        type: LoyaltyType.REVERSAL,
      });

      const result = await service.reversePoints('user-1', 'order-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { loyaltyPoints: 5 },
      });
      expect(result?.type).toBe(LoyaltyType.REVERSAL);
    });

    it('không làm gì nếu đơn hàng chưa từng được tích điểm', async () => {
      prisma.loyaltyTransaction.findUnique.mockResolvedValue(null);

      const result = await service.reversePoints('user-1', 'order-no-earn');

      expect(result).toBeNull();
      expect(prisma.loyaltyTransaction.create).not.toHaveBeenCalled();
    });

    it('không trừ điểm lặp lại nếu đã có REVERSAL trước đó (Idempotent)', async () => {
      const earnTx = { points: 5, type: LoyaltyType.EARN };
      const existingRev = { points: -5, type: LoyaltyType.REVERSAL };

      prisma.loyaltyTransaction.findUnique
        .mockResolvedValueOnce(earnTx)
        .mockResolvedValueOnce(existingRev);

      const result = await service.reversePoints('user-1', 'order-1');

      expect(result).toBe(existingRev);
      expect(prisma.loyaltyTransaction.create).not.toHaveBeenCalled();
    });
  });

  describe('getPoints', () => {
    it('lấy số điểm tích lũy hiện tại của user', async () => {
      prisma.user.findUnique.mockResolvedValue({ loyaltyPoints: 12 });

      const points = await service.getPoints('user-1');
      expect(points).toBe(12);
    });

    it('trả về 0 nếu user không tồn tại', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const points = await service.getPoints('user-unknown');
      expect(points).toBe(0);
    });
  });
});
