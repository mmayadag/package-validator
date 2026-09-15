import { type INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

/** Settings shared by the real server and the e2e tests. */
export function configureApp(app: INestApplication): INestApplication {
  // Caddy forwards requests from the private Docker network; trust its
  // X-Forwarded-For so rate limits apply to the real client address.
  const express = app.getHttpAdapter().getInstance() as { set(setting: string, value: unknown): void };
  express.set('trust proxy', 'loopback, linklocal, uniquelocal');

  // The API only serves JSON, so the strict helmet defaults apply unchanged.
  app.use(helmet());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();
  return app;
}
