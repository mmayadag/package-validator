import { Module } from '@nestjs/common';
import { DependenciesModule } from '../dependencies/dependencies.module.js';
import { EmailModule } from '../email/email.module.js';
import { GithubModule } from '../github/github.module.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';
import { ReportSchedulerService } from './report-scheduler.service.js';
import { RepoController } from './repo.controller.js';
import { RepoService } from './repo.service.js';

@Module({
  imports: [GithubModule, DependenciesModule, EmailModule, SubscriptionsModule],
  controllers: [RepoController],
  providers: [RepoService, ReportSchedulerService],
})
export class RepoModule {}
