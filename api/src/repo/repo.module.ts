import { Module } from '@nestjs/common';
import { GithubModule } from '../github/github.module.js';
import { ReportModule } from '../report/report.module.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';
import { RepoController } from './repo.controller.js';
import { SubscriptionsController } from './subscriptions.controller.js';

/** HTTP layer only: routes and DTOs. The use cases live in report/ and subscriptions/. */
@Module({
  imports: [GithubModule, ReportModule, SubscriptionsModule],
  controllers: [RepoController, SubscriptionsController],
})
export class RepoModule {}
