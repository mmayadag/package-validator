import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module.js';
import { ReportModule } from '../report/report.module.js';
import { ReportSchedulerService } from './report-scheduler.service.js';
import { SubscriptionService } from './subscription.service.js';
import { SubscriptionsRepository } from './subscriptions.repository.js';

@Module({
  imports: [ReportModule, EmailModule],
  providers: [SubscriptionsRepository, SubscriptionService, ReportSchedulerService],
  exports: [SubscriptionService],
})
export class SubscriptionsModule {}
