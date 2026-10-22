import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

/**
 * OrderStateMachine — Nguồn sự thật duy nhất (Single Source of Truth)
 * quản lý việc chuyển đổi trạng thái của đơn hàng theo FR-08.
 *
 * Các transition hợp lệ duy nhất:
 * - PENDING -> PAID (thanh toán thành công)
 * - PENDING -> PAYMENT_FAILED (thanh toán lỗi đã xác minh)
 * - PAYMENT_FAILED -> PENDING (khách hàng thử lại thanh toán)
 * - PENDING -> CANCELLED (khách hàng chủ động hủy)
 * - PAYMENT_FAILED -> CANCELLED (khách hàng hủy đơn khi thanh toán lỗi)
 * - PAID -> CANCELLED (nhân viên hủy/hoàn đơn)
 * - PAID -> PREPARING (barista tiếp nhận đơn)
 * - PREPARING -> READY (pha chế xong, chờ khách lấy)
 * - READY -> COMPLETED (khách nhận món tại quầy)
 */
export class OrderStateMachine {
  private static readonly VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING]: [
      OrderStatus.PAID,
      OrderStatus.PAYMENT_FAILED,
      OrderStatus.CANCELLED,
    ],
    [OrderStatus.PAYMENT_FAILED]: [
      OrderStatus.PENDING,
      OrderStatus.CANCELLED,
    ],
    [OrderStatus.PAID]: [
      OrderStatus.PREPARING,
      OrderStatus.CANCELLED,
    ],
    [OrderStatus.PREPARING]: [
      OrderStatus.READY,
      OrderStatus.CANCELLED,
    ],
    [OrderStatus.READY]: [
      OrderStatus.COMPLETED,
    ],
    [OrderStatus.COMPLETED]: [],
    [OrderStatus.CANCELLED]: [],
  };

  public static assertTransition(from: OrderStatus, to: OrderStatus): void {
    if (from === to) {
      return;
    }

    const allowed = this.VALID_TRANSITIONS[from] || [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(
        `Chuyển đổi trạng thái đơn hàng không hợp lệ: Không thể chuyển từ [${from}] sang [${to}]`,
      );
    }
  }

  public static isTerminal(status: OrderStatus): boolean {
    return status === OrderStatus.COMPLETED || status === OrderStatus.CANCELLED;
  }
}
