import { BadRequestException, Body, Controller, Headers, Post } from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payments.dto';
import { PaymentsService } from './payments.service';

const MAX_IDEMPOTENCY_KEY_LENGTH = 64;

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * FR-06: khóa chống trừ tiền trùng lấy từ header `Idempotency-Key`.
   * Gửi lại cùng khóa cho cùng đơn thì trả kết quả đã lưu, không tạo thanh toán mới.
   */
  @Post()
  create(
    @Body() dto: CreatePaymentDto,
    @Headers('idempotency-key') idempotencyHeader?: string,
  ) {
    const idempotencyKey = PaymentsController.resolveIdempotencyKey(
      idempotencyHeader,
      dto.idempotencyKey,
    );
    return this.paymentsService.create({ ...dto, idempotencyKey });
  }

  /**
   * Header là nguồn chính. Trường `idempotencyKey` trong body vẫn được chấp nhận
   * để không làm hỏng client cũ, nhưng nếu gửi cả hai thì phải trùng nhau.
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
