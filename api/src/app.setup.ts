import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { DOCS_PATH, setupOpenApi } from './openapi.js';

/** Settings shared by the real server and the e2e tests. */
export function configureApp(app: INestApplication): INestApplication {
  // Caddy forwards requests from the private Docker network; trust its
  // X-Forwarded-For so rate limits apply to the real client address.
  const express = app.getHttpAdapter().getInstance() as { set(setting: string, value: unknown): void };
  express.set('trust proxy', 'loopback, linklocal, uniquelocal');

  // The API only serves JSON, so the strict helmet defaults apply unchanged.
  // Swagger UI boots from an inline script, so /docs gets a relaxed script-src.
  const apiHeaders = helmet();
  const docsHeaders = helmet({
    contentSecurityPolicy: {
      directives: { scriptSrc: ["'self'", "'unsafe-inline'"] },
    },
  });
  app.use((request: Request, response: Response, next: NextFunction) => {
    const isDocs = request.path === `/${DOCS_PATH}` || request.path.startsWith(`/${DOCS_PATH}/`);
    return (isDocs ? docsHeaders : apiHeaders)(request, response, next);
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();
  setupOpenApi(app);
  return app;
}
