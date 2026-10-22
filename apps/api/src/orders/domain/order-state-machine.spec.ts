import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { OrderStateMachine } from './order-state-machine';

describe('OrderStateMachine (FR-08)', () => {
  describe('assertTransition - Các chuyển đổi hợp lệ', () => {
    it('cho phép chuyển PENDING -> PAID (Thanh toán thành công)', () => {
      expect(() => {
        OrderStateMachine.assertTransition(OrderStatus.PENDING, OrderStatus.PAID);
      }).not.toThrow();
    });

    it('cho phép chuyển PENDING -> PAYMENT_FAILED (Thanh toán thất bại đã xác minh)', () => {
      expect(() => {
        OrderStateMachine.assertTransition(OrderStatus.PENDING, OrderStatus.PAYMENT_FAILED);
      }).not.toThrow();
    });

    it('cho phép chuyển PAYMENT_FAILED -> PENDING (Khách hàng thử lại thanh toán)', () => {
      expect(() => {
        OrderStateMachine.assertTransition(OrderStatus.PAYMENT_FAILED, OrderStatus.PENDING);
      }).not.toThrow();
    });

    it('cho phép chuyển PENDING -> CANCELLED (Khách hàng hủy đơn)', () => {
      expect(() => {
        OrderStateMachine.assertTransition(OrderStatus.PENDING, OrderStatus.CANCELLED);
      }).not.toThrow();
    });

    it('cho phép chuyển PAYMENT_FAILED -> CANCELLED (Hủy đơn khi lỗi thanh toán)', () => {
      expect(() => {
        OrderStateMachine.assertTransition(OrderStatus.PAYMENT_FAILED, OrderStatus.CANCELLED);
      }).not.toThrow();
    });

    it('cho phép chuyển PAID -> CANCELLED (Nhân viên hủy đơn/hoàn tiền)', () => {
      expect(() => {
        OrderStateMachine.assertTransition(OrderStatus.PAID, OrderStatus.CANCELLED);
      }).not.toThrow();
    });

    it('cho phép luồng KDS: PAID -> PREPARING -> READY -> COMPLETED', () => {
      expect(() => {
        OrderStateMachine.assertTransition(OrderStatus.PAID, OrderStatus.PREPARING);
        OrderStateMachine.assertTransition(OrderStatus.PREPARING, OrderStatus.READY);
        OrderStateMachine.assertTransition(OrderStatus.READY, OrderStatus.COMPLETED);
      }).not.toThrow();
    });

    it('không ném lỗi khi trạng thái không đổi (same state)', () => {
      expect(() => {
        OrderStateMachine.assertTransition(OrderStatus.PENDING, OrderStatus.PENDING);
      }).not.toThrow();
    });
  });

  describe('assertTransition - Các chuyển đổi bất hợp lệ (Chặn lỗi)', () => {
    it('chặn chuyển từ COMPLETED sang trạng thái khác (Terminal state)', () => {
      expect(() => {
        OrderStateMachine.assertTransition(OrderStatus.COMPLETED, OrderStatus.PENDING);
      }).toThrow(BadRequestException);

      expect(() => {
        OrderStateMachine.assertTransition(OrderStatus.COMPLETED, OrderStatus.CANCELLED);
      }).toThrow(BadRequestException);
    });

    it('chặn chuyển từ CANCELLED sang trạng thái khác (Terminal state)', () => {
      expect(() => {
        OrderStateMachine.assertTransition(OrderStatus.CANCELLED, OrderStatus.PENDING);
      }).toThrow(BadRequestException);
    });

    it('chặn nhảy cóc từ PENDING trực tiếp lên READY hoặc COMPLETED', () => {
      expect(() => {
        OrderStateMachine.assertTransition(OrderStatus.PENDING, OrderStatus.READY);
      }).toThrow(BadRequestException);

      expect(() => {
        OrderStateMachine.assertTransition(OrderStatus.PENDING, OrderStatus.COMPLETED);
      }).toThrow(BadRequestException);
    });

    it('chặn chuyển từ PAYMENT_FAILED trực tiếp lên PAID mà không quay về PENDING', () => {
      expect(() => {
        OrderStateMachine.assertTransition(OrderStatus.PAYMENT_FAILED, OrderStatus.PAID);
      }).toThrow(BadRequestException);
    });
  });

  describe('isTerminal', () => {
    it('trả về true cho COMPLETED và CANCELLED', () => {
      expect(OrderStateMachine.isTerminal(OrderStatus.COMPLETED)).toBe(true);
      expect(OrderStateMachine.isTerminal(OrderStatus.CANCELLED)).toBe(true);
    });

    it('trả về false cho các trạng thái trung gian', () => {
      expect(OrderStateMachine.isTerminal(OrderStatus.PENDING)).toBe(false);
      expect(OrderStateMachine.isTerminal(OrderStatus.PAID)).toBe(false);
      expect(OrderStateMachine.isTerminal(OrderStatus.PREPARING)).toBe(false);
      expect(OrderStateMachine.isTerminal(OrderStatus.READY)).toBe(false);
    });
  });
});
