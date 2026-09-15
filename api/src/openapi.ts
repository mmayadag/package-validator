import { createRequire } from 'node:module';
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const DOCS_PATH = 'docs';
export const OPENAPI_JSON_PATH = `${DOCS_PATH}/openapi.json`;

const { version } = createRequire(import.meta.url)('../package.json') as { version: string };

/** Serves Swagger UI at /docs and the OpenAPI document at /docs/openapi.json. */
export function setupOpenApi(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Package Validator API')
    .setDescription(
      'Reports outdated package.json dependencies of a public GitHub repository and emails the report on a schedule. ' +
        'Requests are rate limited per client IP; a rejected request gets 429 with Retry-After.',
    )
    .setVersion(version)
    .setContact('Murat Mayadağ', 'https://github.com/mmayadag', '')
    .setLicense('MIT', 'https://github.com/mmayadag/package-validator/blob/main/LICENSE')
    .setExternalDoc('Source code and documentation', 'https://github.com/mmayadag/package-validator')
    .addTag('repositories', 'Validate a repository and build its dependency report')
    .addTag('subscriptions', 'Email delivery on a 6, 12 or 24 hour schedule')
    .addTag('health', 'Liveness probe')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(DOCS_PATH, app, document, {
    jsonDocumentUrl: OPENAPI_JSON_PATH,
    customSiteTitle: 'Package Validator API',
    swaggerOptions: { displayRequestDuration: true },
  });
}
