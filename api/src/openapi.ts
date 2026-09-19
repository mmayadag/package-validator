import { createRequire } from 'node:module';
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export const DOCS_PATH = 'docs';
export const OPENAPI_JSON_PATH = `${DOCS_PATH}/openapi.json`;

const { version } = createRequire(import.meta.url)('../package.json') as { version: string };

/** Builds the OpenAPI 3 document from the DTO decorators. Shared by the server and the generator script. */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
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
    .addTag('subscriptions', 'Email delivery every 6, 12, 24 hours or a week')
    .addTag('health', 'Liveness probe')
    .build();

  return SwaggerModule.createDocument(app, config);
}

/** Serves Swagger UI at /docs and the OpenAPI document at /docs/openapi.json. */
export function setupOpenApi(app: INestApplication): void {
  const document = buildOpenApiDocument(app);
  SwaggerModule.setup(DOCS_PATH, app, document, {
    jsonDocumentUrl: OPENAPI_JSON_PATH,
    customSiteTitle: 'Package Validator API',
    swaggerOptions: { displayRequestDuration: true },
  });
}
