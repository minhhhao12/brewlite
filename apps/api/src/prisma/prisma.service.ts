import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  // Prisma kết nối lazy ở query đầu tiên, nhờ vậy /health vẫn trả lời được
  // khi PostgreSQL tạm thời không sẵn sàng; /health/ready sẽ báo 503.

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
