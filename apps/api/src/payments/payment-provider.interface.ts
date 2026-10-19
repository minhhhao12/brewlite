export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export type PaymentMethod = 'WALLET' | 'CARD';

export interface CreatePaymentInput {
  orderId: string;
  amount: number;
  method: PaymentMethod;
  idempotencyKey: string;
}

export interface PaymentProviderResult {
  success: boolean;
  transactionReference: string;
  failureReason?: string;
  /** false khi provider chưa xác minh được kết quả (timeout/đang đối soát). */
  verified: boolean;
}

export interface PaymentVerification extends PaymentProviderResult {
  transactionReference: string;
}

/**
 * Cổng thanh toán được trừu tượng hóa để có thể thay Mock bằng provider thật.
 * Xem ADR-005.
 */
export interface PaymentProvider {
  createPayment(input: CreatePaymentInput): Promise<PaymentProviderResult>;
  verifyResult(transactionReference: string): Promise<PaymentVerification>;
}
