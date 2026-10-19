import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { JsonLogger } from './common/logging/json-logger';

async function bootstrap(): Promise<void> {
  const logger = new JsonLogger();
  const app = await NestFactory.create(AppModule, { logger });
  const config = app.get(ConfigService);

  const corsOrigins = String(config.get('CORS_ORIGIN') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({ origin: corsOrigins, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();

  const port = Number(config.get('PORT') ?? 3000);
  await app.listen(port, '0.0.0.0');
  logger.log(`BrewLite API listening on port ${port}`, 'Bootstrap');
}

void bootstrap();
