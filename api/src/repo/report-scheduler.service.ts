import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { AppConfig } from '../config/configuration.js';
import { EmailService } from '../email/email.service.js';
import { unsubscribeUrl } from '../subscriptions/subscription-links.js';
import { SubscriptionsRepository } from '../subscriptions/subscriptions.repository.js';
import { RepoService } from './repo.service.js';

export interface DeliveryRun {
  due: number;
  sent: number;
  failed: number;
  /** Unconfirmed subscriptions removed because their confirmation window passed. */
  expired: number;
}

const NOTHING_SENT: DeliveryRun = { due: 0, sent: 0, failed: 0, expired: 0 };

@Injectable()
export class ReportSchedulerService {
  private readonly logger = new Logger(ReportSchedulerService.name);
  private readonly publicUrl: string;
  private running = false;

  constructor(
    private readonly repoService: RepoService,
    private readonly subscriptions: SubscriptionsRepository,
    private readonly email: EmailService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.publicUrl = config.get('publicUrl', { infer: true });
  }

  /**
   * Emails every confirmed subscription whose period has elapsed and drops
   * confirmation requests nobody answered. Runs hourly, so a report arrives
   * within an hour of being due; a failing repository never blocks the rest.
   */
  @Cron(CronExpression.EVERY_HOUR, { name: 'send-due-reports' })
  async sendDueReports(now = Date.now()): Promise<DeliveryRun> {
    if (this.running) {
      this.logger.warn('Previous delivery run is still in progress; skipping this one');
      return NOTHING_SENT;
    }

    this.running = true;
    try {
      const expired = this.subscriptions.deleteExpiredPending(now);
      if (expired > 0) {
        this.logger.log(`Removed ${expired} unconfirmed subscriptions`);
      }
      if (!this.email.enabled) {
        return { ...NOTHING_SENT, expired };
      }

      const due = this.subscriptions.findDue(now);
      let sent = 0;

      for (const subscription of due) {
        const ref = { owner: subscription.owner, repo: subscription.repo };
        try {
          const report = await this.repoService.buildReport(ref);
          const delivered = await this.email.sendReport(
            subscription.email,
            ref,
            report,
            unsubscribeUrl(this.publicUrl, subscription.token),
          );
          if (delivered) {
            this.subscriptions.markSent(subscription.id, now);
            sent += 1;
          }
        } catch (error) {
          this.logger.warn(`Scheduled report for ${ref.owner}/${ref.repo} failed: ${String(error)}`);
        }
      }

      if (due.length > 0) {
        this.logger.log(`Delivered ${sent} of ${due.length} due reports`);
      }
      return { due: due.length, sent, failed: due.length - sent, expired };
    } finally {
      this.running = false;
    }
  }
}
