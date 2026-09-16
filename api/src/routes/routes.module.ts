import { Module } from '@nestjs/common';
import { GithubModule } from '../github/github.module.js';
import { ReportModule } from '../report/report.module.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';
import { RepositoriesController } from './repositories.controller.js';
import { SubscriptionsController } from './subscriptions.controller.js';

/** HTTP layer only: the /v1 routes and their DTOs. The use cases live in report/ and subscriptions/. */
@Module({
  imports: [GithubModule, ReportModule, SubscriptionsModule],
  controllers: [RepositoriesController, SubscriptionsController],
})
export class RoutesModule {}
