import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import type { AppConfig } from './config/configuration.js';
import { createLogger } from './logging.js';

const app = configureApp(await NestFactory.create(AppModule, { logger: createLogger(process.env) }));
const config = app.get<ConfigService<AppConfig, true>>(ConfigService);

const corsOrigin = config.get('corsOrigin', { infer: true });
if (corsOrigin) {
  app.enableCors({ origin: corsOrigin.split(',').map((origin) => origin.trim()) });
}

const port = config.get('port', { infer: true });
await app.listen(port);
Logger.log(`API listening on port ${port}`, 'Bootstrap');
