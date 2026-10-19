import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  const healthService = {
    check: jest.fn().mockReturnValue({ status: 'ok' }),
    ready: jest.fn().mockResolvedValue({ status: 'ready' }),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: healthService }],
    }).compile();

    controller = moduleRef.get(HealthController);
  });

  it('GET /health trả status ok', () => {
    expect(controller.check()).toEqual({ status: 'ok' });
  });

  it('GET /health/ready trả status ready', async () => {
    await expect(controller.ready()).resolves.toEqual({ status: 'ready' });
  });
});
