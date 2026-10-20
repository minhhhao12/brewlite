const LOCAL_DATABASE_URL =
  'postgresql://brewlite:brewlite_local_only@127.0.0.1:5432/brewlite?schema=public';
const LOCAL_JWT_SECRET = 'local-only-jwt-secret-at-least-32-characters';
const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

/**
 * Validate cấu hình lúc khởi động (ADR-007).
 * Local/dev có default an toàn để `start:dev` vẫn trả GET / khi DB chưa chạy;
 * production bắt buộc phải cung cấp DATABASE_URL và JWT_SECRET riêng.
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const nodeEnv = readString(config.NODE_ENV) ?? 'development';
  const isProduction = nodeEnv === 'production';
  const port = Number(config.PORT ?? 3000);

  const databaseUrl =
    readString(config.DATABASE_URL) ?? (isProduction ? '' : LOCAL_DATABASE_URL);
  const jwtSecret = readString(config.JWT_SECRET) ?? (isProduction ? '' : LOCAL_JWT_SECRET);
  const corsOrigin =
    readString(config.CORS_ORIGIN) ?? 'http://localhost:3001,http://127.0.0.1:3001';
  const logLevel = readString(config.LOG_LEVEL) ?? 'info';
  const paymentProvider = readString(config.PAYMENT_PROVIDER) ?? 'mock';

  const errors: string[] = [];

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push('PORT phải là số nguyên trong khoảng 1..65535.');
  }

  if (!databaseUrl) {
    errors.push('DATABASE_URL là bắt buộc ở production.');
  } else if (!/^postgres(ql)?:\/\//.test(databaseUrl)) {
    errors.push('DATABASE_URL phải là URL PostgreSQL (postgresql://...).');
  }

  if (!jwtSecret) {
    errors.push('JWT_SECRET là bắt buộc ở production.');
  } else if (jwtSecret.length < 32) {
    errors.push('JWT_SECRET phải có tối thiểu 32 ký tự.');
  } else if (isProduction && jwtSecret === LOCAL_JWT_SECRET) {
    errors.push('JWT_SECRET không được dùng giá trị local ở production.');
  }

  if (!corsOrigin) {
    errors.push('CORS_ORIGIN không được để trống.');
  }

  if (!LOG_LEVELS.includes(logLevel as (typeof LOG_LEVELS)[number])) {
    errors.push(`LOG_LEVEL phải là một trong: ${LOG_LEVELS.join(', ')}.`);
  }

  if (errors.length > 0) {
    throw new Error(`Cấu hình môi trường không hợp lệ:\n- ${errors.join('\n- ')}`);
  }

  return {
    ...config,
    NODE_ENV: nodeEnv,
    PORT: port,
    DATABASE_URL: databaseUrl,
    JWT_SECRET: jwtSecret,
    CORS_ORIGIN: corsOrigin,
    LOG_LEVEL: logLevel,
    PAYMENT_PROVIDER: paymentProvider,
  };
}
