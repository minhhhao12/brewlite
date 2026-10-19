import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /** Liveness: dùng cho smoke test sau deploy. */
  @Get()
  check(): Record<string, unknown> {
    return this.healthService.check();
  }

  /** Readiness: kiểm tra kết nối PostgreSQL. */
  @Get('ready')
  ready(): Promise<Record<string, unknown>> {
    return this.healthService.ready();
  }
}
