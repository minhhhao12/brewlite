import { Module } from '@nestjs/common';
import { MockPaymentProvider } from './mock-payment.provider';
import { PAYMENT_PROVIDER } from './payment-provider.interface';

/**
 * TODO Sprint 2: PaymentsController + PaymentsService + repository.
 * Nghiệp vụ idempotency/transaction sẽ được thêm tại đây.
 */
@Module({
  providers: [
    MockPaymentProvider,
    { provide: PAYMENT_PROVIDER, useExisting: MockPaymentProvider },
  ],
  exports: [PAYMENT_PROVIDER, MockPaymentProvider],
})
export class PaymentsModule {}
