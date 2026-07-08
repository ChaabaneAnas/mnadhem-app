import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe, type ValidationError } from '@nestjs/common';
import { AppModule } from './app.module';

/**
 * Turns class-validator failures into a coded response the frontend can
 * translate. DTO validators set their `message` to a stable code (e.g.
 * `SLUG_INVALID_FORMAT`); we surface the first one as `code`, plus a
 * per-field breakdown. Unknown/default messages fall back client-side.
 */
function validationExceptionFactory(errors: ValidationError[]) {
  const fields = errors.map((e) => ({
    field: e.property,
    code: Object.values(e.constraints ?? {})[0] ?? 'INVALID',
  }));
  return new BadRequestException({
    code: fields[0]?.code ?? 'VALIDATION_ERROR',
    message: 'Validation failed',
    fields,
  });
}

async function bootstrap() {
  console.log('[bootstrap] Starting NestJS...');
  console.log('[bootstrap] DATABASE_URL loaded:', !!process.env['DATABASE_URL']);

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );

  const port = process.env['PORT'] ?? 3000;
  await app.listen(port);
  console.log(`[bootstrap] Listening on http://localhost:${port}`);
}

bootstrap().catch((err) => {
  console.error('[bootstrap] FATAL ERROR:', err);
  process.exit(1);
});
