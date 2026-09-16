import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ConfirmedSubscription,
  RepoReport,
  ReportPeriod,
  RepositoryRef,
  ScheduledReport,
  SubscriptionRequest,
  SubscriptionSummary,
} from '@package-validator/contracts';
import type { AppConfig } from '../config/configuration.js';
import { DependencyCheckerService, type PackageManifest } from '../dependencies/dependency-checker.service.js';
import { EmailService } from '../email/email.service.js';
import { GithubService } from '../github/github.service.js';
import { type RenderedReport, renderReport } from '../report/render-report.js';
import { confirmUrl, unsubscribeUrl } from '../subscriptions/subscription-links.js';
import { HOUR_MS, type Subscription, SubscriptionsRepository } from '../subscriptions/subscriptions.repository.js';

export const REPORT_CACHE_TTL_MS = HOUR_MS;
/** Upper bound on cached reports; the oldest entry is evicted beyond it. */
const REPORT_CACHE_MAX_ENTRIES = 500;

@Injectable()
export class RepoService {
  private readonly publicUrl: string;
  private readonly reports = new Map<string, { report: RepoReport; expiresAt: number }>();

  constructor(
    private readonly github: GithubService,
    private readonly dependencyChecker: DependencyCheckerService,
    private readonly email: EmailService,
    private readonly subscriptions: SubscriptionsRepository,
    config: ConfigService<AppConfig, true>,
  ) {
    this.publicUrl = config.get('publicUrl', { infer: true });
  }

  isValid(ref: RepositoryRef): Promise<boolean> {
    return this.github.repositoryExists(ref);
  }

  /**
   * Builds the report, reusing one built within the last hour for the same
   * repository so repeated requests and scheduled deliveries do not hit
   * GitHub and the npm registry again.
   */
  async buildReport({ owner, repo }: RepositoryRef): Promise<RepoReport> {
    const key = `${owner}/${repo}`.toLowerCase();
    const cached = this.reports.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.report;
    }

    const report = await this.fetchReport({ owner, repo });
    this.reports.set(key, { report, expiresAt: Date.now() + REPORT_CACHE_TTL_MS });
    if (this.reports.size > REPORT_CACHE_MAX_ENTRIES) {
      const oldest = this.reports.keys().next().value;
      if (oldest !== undefined) this.reports.delete(oldest);
    }
    return report;
  }

  private async fetchReport(ref: RepositoryRef): Promise<RepoReport> {
    const { owner, repo } = ref;

    if (!(await this.github.repositoryExists(ref))) {
      throw new NotFoundException(`Repository ${owner}/${repo} does not exist or is not public`);
    }

    const raw = await this.github.getPackageJson(ref);
    if (raw === null) {
      throw new UnprocessableEntityException(`${owner}/${repo} has no package.json on its default branch`);
    }

    const outdated = await this.dependencyChecker.findOutdated(parseManifest(raw));
    return { ...ref, outdated, generatedAt: new Date().toISOString(), ...renderReport(ref, outdated) };
  }

  /**
   * Validates the repository and stores the subscription. A new address gets a
   * confirmation request; an already confirmed one gets the report right away.
   */
  async subscribe({ owner, repo, email, period }: SubscriptionRequest): Promise<ScheduledReport> {
    const ref = { owner, repo };
    const report = await this.buildReport(ref);
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
        await this.deliver(subscription, await this.buildReport(ref));
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
    const sent = await this.email.sendReport(
      subscription.email,
      ref,
      report,
      unsubscribeUrl(this.publicUrl, subscription.token),
    );
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

function parseManifest(raw: string): PackageManifest {
  try {
    const manifest: unknown = JSON.parse(raw);
    if (typeof manifest !== 'object' || manifest === null || Array.isArray(manifest)) {
      throw new TypeError('not an object');
    }
    return manifest as PackageManifest;
  } catch {
    throw new UnprocessableEntityException('package.json is not valid JSON');
  }
}
