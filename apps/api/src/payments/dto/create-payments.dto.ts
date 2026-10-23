
import { PaymentMethod } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreatePaymentDto {
  @IsUUID()
  orderId!: string;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  idempotencyKey!: string;

  @IsOptional()
  @IsBoolean()
  simulateFailure?: boolean;
}
