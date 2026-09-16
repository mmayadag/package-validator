import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { requestLog } from './common/request-log/request-log.middleware.js';
import type { AppConfig } from './config/configuration.js';
import { DOCS_PATH, setupOpenApi } from './openapi.js';

/** Settings shared by the real server and the e2e tests. */
export function configureApp(app: INestApplication): INestApplication {
  // Caddy forwards requests from the private Docker network; trust its
  // X-Forwarded-For so rate limits apply to the real client address.
  const express = app.getHttpAdapter().getInstance() as { set(setting: string, value: unknown): void };
  express.set('trust proxy', 'loopback, linklocal, uniquelocal');
  const docsEnabled = app.get<ConfigService<AppConfig, true>>(ConfigService).get('docsEnabled', { infer: true });

  // First, so every later log line (and the response) carries the request id.
  app.use(requestLog());

  // The API only serves JSON, so the strict helmet defaults apply unchanged.
  // Swagger UI boots from an inline script, so /docs gets a relaxed script-src.
  const apiHeaders = helmet();
  const docsHeaders = helmet({
    contentSecurityPolicy: {
      directives: { scriptSrc: ["'self'", "'unsafe-inline'"] },
    },
  });
  app.use((request: Request, response: Response, next: NextFunction) => {
    const isDocs = docsEnabled && (request.path === `/${DOCS_PATH}` || request.path.startsWith(`/${DOCS_PATH}/`));
    return (isDocs ? docsHeaders : apiHeaders)(request, response, next);
  });

  // Every controller answers under /v1 unless it opts out with VERSION_NEUTRAL (health).
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();
  if (docsEnabled) {
    setupOpenApi(app);
  }
  return app;
}
