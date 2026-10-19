import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreatePaymentInput,
  PaymentProvider,
  PaymentProviderResult,
  PaymentVerification,
} from './payment-provider.interface';

/**
 * Provider mô phỏng: không gọi mạng, không trừ tiền thật.
 * Delay và tỷ lệ lỗi lấy từ PAYMENT_MOCK_DELAY_MS / PAYMENT_MOCK_FAILURE_RATE.
 */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  constructor(private readonly config: ConfigService) {}

  async createPayment(input: CreatePaymentInput): Promise<PaymentProviderResult> {
    const delayMs = Number(this.config.get('PAYMENT_MOCK_DELAY_MS') ?? 300);
    const failureRate = Number(this.config.get('PAYMENT_MOCK_FAILURE_RATE') ?? 0);

    await new Promise((resolve) => setTimeout(resolve, delayMs));

    const failed = Math.random() < failureRate;
    return {
      success: !failed,
      transactionReference: `mock_${input.orderId}_${randomUUID()}`,
      failureReason: failed ? 'MOCK_PAYMENT_DECLINED' : undefined,
      verified: true,
    };
  }

  async verifyResult(transactionReference: string): Promise<PaymentVerification> {
    // Mock không lưu state; coi mọi reference do createPayment sinh ra là đã xác minh.
    return {
      success: transactionReference.startsWith('mock_'),
      transactionReference,
      verified: true,
      failureReason: transactionReference.startsWith('mock_') ? undefined : 'UNKNOWN_REFERENCE',
    };
  }
}
