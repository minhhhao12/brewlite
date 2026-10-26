
import { Module } from '@nestjs/common';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [LoyaltyModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
