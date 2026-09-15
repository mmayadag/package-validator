import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
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
})
export class AppModule {}
