// Generates docs/openapi.json from the live DTO decorators.
// Run with `npm run openapi` after `nest build`; see api/package.json.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NestFactory } from '@nestjs/core';
import prettier from 'prettier';
// @ts-expect-error -- imports the build output; api/tsconfig.json does not type-check this script.
import { AppModule } from '../dist/app.module.js';
// @ts-expect-error -- imports the build output; api/tsconfig.json does not type-check this script.
import { configureApp } from '../dist/app.setup.js';
// @ts-expect-error -- imports the build output; api/tsconfig.json does not type-check this script.
import { buildOpenApiDocument } from '../dist/openapi.js';

process.env.TOKEN ??= 'stub';
process.env.DATABASE_PATH ??= ':memory:';

const app = configureApp(await NestFactory.create(AppModule, { logger: false }));
await app.init();

const document = buildOpenApiDocument(app);
const here = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(here, '../../docs/openapi.json');

// Formatted with the repo's prettier config so `npm run format:check` stays green.
const prettierConfig = await prettier.resolveConfig(outPath);
const formatted = await prettier.format(JSON.stringify(document, null, 2) + '\n', {
  ...prettierConfig,
  filepath: outPath,
});
await writeFile(outPath, formatted);

await app.close();
process.exit(0);
