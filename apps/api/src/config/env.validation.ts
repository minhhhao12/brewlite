import { plainToInstance, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnvironment {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

export class EnvironmentVariables {
  @IsIn(Object.values(NodeEnvironment))
  NODE_ENV: NodeEnvironment = NodeEnvironment.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3000;

  @IsIn(['debug', 'info', 'warn', 'error'])
  LOG_LEVEL = 'info';

  @IsString()
  @Matches(/^postgres(ql)?:\/\//, {
    message: 'DATABASE_URL phải là PostgreSQL connection string',
  })
  DATABASE_URL: string;

  @IsString()
  CORS_ORIGIN = 'http://localhost:3001';

  @IsString()
  @MinLength(32)
  JWT_SECRET: string;

  @IsOptional()
  @IsString()
  JWT_EXPIRES_IN?: string;

  @IsIn(['mock'])
  PAYMENT_PROVIDER = 'mock' as const;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  PAYMENT_MOCK_DELAY_MS = 300;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  PAYMENT_MOCK_FAILURE_RATE = 0;
}

/**
 * Validate biến môi trường ngay khi ứng dụng khởi động.
 * Sai cấu hình => process dừng, tránh chạy với secret/DB URL rỗng.
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, {
    skipMissingProperties: false,
    forbidUnknownValues: false,
  });

  if (errors.length > 0) {
    const details = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Cấu hình môi trường không hợp lệ: ${details}`);
  }

  return { ...config, ...validated };
}
