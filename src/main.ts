import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as compression from 'compression';
import { AppModule } from './app.module';
import { isSwaggerEnabled, setupSwagger } from './common/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const port = Number(process.env.PORT ?? 3000);
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const apiPrefix = process.env.API_PREFIX ?? 'api/v1';
  const swaggerEnabled = isSwaggerEnabled(nodeEnv);

  // ── Security ──────────────────────────────────────────────────
  // Relax CSP outside production so Swagger UI assets can load.
  app.use(
    helmet({
      contentSecurityPolicy: nodeEnv === 'production' ? undefined : false,
    }),
  );
  app.use(compression());

  // ── CORS ──────────────────────────────────────────────────────
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });

  // ── Global prefix ─────────────────────────────────────────────
  app.setGlobalPrefix(apiPrefix);

  // ── Global validation pipe ────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ── Swagger / OpenAPI ─────────────────────────────────────────
  if (swaggerEnabled) {
    setupSwagger(app, { apiPrefix, port, nodeEnv });
  }

  // ── Start ─────────────────────────────────────────────────────
  await app.listen(port);
  console.log(`🌱 Croply API running on http://localhost:${port}/${apiPrefix}`);
  if (swaggerEnabled) {
    console.log(
      `📖 Swagger docs at http://localhost:${port}/${apiPrefix}/docs`,
    );
  }
}

bootstrap();
