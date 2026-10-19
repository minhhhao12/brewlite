import { ConfigService } from '@nestjs/config';
import { MockPaymentProvider } from './mock-payment.provider';

describe('MockPaymentProvider', () => {
  const config = {
    get: (key: string) => {
      if (key === 'PAYMENT_MOCK_DELAY_MS') return 0;
      if (key === 'PAYMENT_MOCK_FAILURE_RATE') return 0;
      return undefined;
    },
  } as unknown as ConfigService;

  it('trả success và transactionReference khi failure rate = 0', async () => {
    const provider = new MockPaymentProvider(config);
    const result = await provider.createPayment({
      orderId: 'order-1',
      amount: 45000,
      method: 'WALLET',
      idempotencyKey: 'idem-1',
    });

    expect(result.success).toBe(true);
    expect(result.verified).toBe(true);
    expect(result.transactionReference).toMatch(/^mock_order-1_/);
  });

  it('verifyResult xác minh reference do mock sinh ra', async () => {
    const provider = new MockPaymentProvider(config);
    await expect(provider.verifyResult('mock_order-1_abc')).resolves.toMatchObject({
      success: true,
      verified: true,
    });
  });
});
