import { Injectable, LoggerService } from '@nestjs/common';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function readLogLevel(): LogLevel {
  const value = process.env.LOG_LEVEL;
  if (value === 'debug' || value === 'info' || value === 'warn' || value === 'error') {
    return value;
  }
  return 'info';
}

/**
 * Logger JSON tối giản, không phụ thuộc thư viện ngoài.
 * Mỗi dòng log là một JSON object để Render/GitHub Actions dễ thu thập.
 * Mức tối thiểu lấy từ LOG_LEVEL (đã được validate trong env.validation.ts).
 */
@Injectable()
export class JsonLogger implements LoggerService {
  private readonly minLevel: LogLevel = readLogLevel();

  log(message: unknown, context?: string): void {
    this.write('info', message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write('error', message, context, trace);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  private write(level: LogLevel, message: unknown, context?: string, trace?: string): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.minLevel]) {
      return;
    }

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: 'brewlite-api',
      context,
      message: this.normalize(message),
      ...(trace ? { trace } : {}),
    };
    process.stdout.write(`${JSON.stringify(entry)}\n`);
  }

  private normalize(message: unknown): unknown {
    if (message instanceof Error) {
      return { name: message.name, message: message.message };
    }
    return message;
  }
}
