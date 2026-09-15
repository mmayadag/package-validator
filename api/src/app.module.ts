import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { RateLimitGuard } from './common/rate-limit/rate-limit.guard.js';
import { loadConfig } from './config/configuration.js';
import { HealthController } from './health/health.controller.js';
import { RepoModule } from './repo/repo.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // api/.env when run from api/, the shared root .env otherwise
      envFilePath: ['.env', '../.env'],
      load: [() => loadConfig(process.env)],
    }),
    ScheduleModule.forRoot(),
    RepoModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: RateLimitGuard }],
})
export class AppModule {}
