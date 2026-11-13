
import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePaymentDto } from './dto/create-payments.dto';
import { PaymentsService } from './payments.service';

const MAX_IDEMPOTENCY_KEY_LENGTH = 64;

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * FR-06: Tạo thanh toán cho đơn hàng của người dùng hiện tại.
   */
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePaymentDto,
    @Headers('idempotency-key') idempotencyHeader?: string,
  ) {
    const idempotencyKey = PaymentsController.resolveIdempotencyKey(
      idempotencyHeader,
      dto.idempotencyKey,
    );

    return this.paymentsService.create(user.userId, {
      ...dto,
      idempotencyKey,
    });
  }

  /**
   * Header là nguồn chính. Body vẫn được hỗ trợ để tương thích client cũ.
   */
  private static resolveIdempotencyKey(
    header: string | undefined,
    bodyKey: string | undefined,
  ): string {
    const fromHeader = header?.trim();
    const fromBody = bodyKey?.trim();

    if (fromHeader && fromBody && fromHeader !== fromBody) {
      throw new BadRequestException(
        'Idempotency-Key trong header và trong body không khớp nhau.',
      );
    }

    const key = fromHeader || fromBody;

    if (!key) {
      throw new BadRequestException('Thiếu header Idempotency-Key.');
    }

    if (key.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
      throw new BadRequestException(
        `Idempotency-Key tối đa ${MAX_IDEMPOTENCY_KEY_LENGTH} ký tự.`,
      );
    }

    return key;
  }
}
