import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ConfirmedSubscription,
  ReportPeriod,
  ScheduledReport,
  SubscriptionRequest,
  SubscriptionSummary,
} from '@package-validator/contracts';
import type { AppConfig } from '../config/configuration.js';
import { EmailService } from '../email/email.service.js';
import type { RenderedReport } from '../report/render-report.js';
import { ReportService } from '../report/report.service.js';
import { confirmUrl, oneClickUnsubscribeUrl, unsubscribeUrl } from './subscription-links.js';
import { HOUR_MS, type Subscription, SubscriptionsRepository } from './subscriptions.repository.js';

/** Lifecycle of an email subscription: request, confirmation, delivery and removal. */
@Injectable()
export class SubscriptionService {
  private readonly publicUrl: string;

  constructor(
    private readonly reports: ReportService,
    private readonly email: EmailService,
    private readonly subscriptions: SubscriptionsRepository,
    config: ConfigService<AppConfig, true>,
  ) {
    this.publicUrl = config.get('publicUrl', { infer: true });
  }

  /**
   * Validates the repository and stores the subscription. A new address gets a
   * confirmation request; an already confirmed one gets the report right away.
   */
  async subscribe({ owner, repo, email, period }: SubscriptionRequest): Promise<ScheduledReport> {
    const ref = { owner, repo };
    const report = await this.reports.buildReport(ref);
    const subscription = this.subscriptions.upsert({ ...ref, email, periodHours: period });

    if (subscription.confirmedAt === null) {
      const emailSent = await this.email.sendConfirmation(
        email,
        ref,
        subscription.periodHours,
        confirmUrl(this.publicUrl, subscription.token),
      );
      return { ...report, emailSent, subscription: summarize(subscription) };
    }

    const emailSent = await this.deliver(subscription, report);
    return { ...report, emailSent, subscription: summarize(this.subscriptions.findByToken(subscription.token)) };
  }

  /** Activates the subscription and sends the first report. */
  async confirm(token: string): Promise<ConfirmedSubscription> {
    const subscription = this.subscriptions.confirm(token);
    if (!subscription) {
      throw new NotFoundException('Subscription not found; the confirmation link may have expired');
    }

    const ref = { owner: subscription.owner, repo: subscription.repo };
    if (subscription.lastSentAt === null) {
      try {
        await this.deliver(subscription, await this.reports.buildReport(ref));
      } catch {
        // The repository may have gone away since; the scheduler retries on its next run.
      }
    }

    return { ...ref, email: subscription.email, subscription: summarize(this.subscriptions.findByToken(token)) };
  }

  unsubscribe(token: string): void {
    if (!this.subscriptions.deleteByToken(token)) {
      throw new NotFoundException('Subscription not found or already removed');
    }
  }

  private async deliver(subscription: Subscription, report: RenderedReport): Promise<boolean> {
    const ref = { owner: subscription.owner, repo: subscription.repo };
    const sent = await this.email.sendReport(subscription.email, ref, report, {
      page: unsubscribeUrl(this.publicUrl, subscription.token),
      oneClick: oneClickUnsubscribeUrl(this.publicUrl, subscription.token),
    });
    if (sent) {
      this.subscriptions.markSent(subscription.id);
    }
    return sent;
  }
}

function summarize(subscription: Subscription | null): SubscriptionSummary {
  if (!subscription) {
    throw new NotFoundException('Subscription not found');
  }
  const { confirmedAt, lastSentAt, periodHours } = subscription;
  return {
    status: confirmedAt === null ? 'pending' : 'active',
    // Stored as an integer; only values from REPORT_PERIODS ever get written.
    periodHours: periodHours as ReportPeriod,
    nextReportAt: lastSentAt === null ? null : new Date(lastSentAt + periodHours * HOUR_MS).toISOString(),
  };
}
