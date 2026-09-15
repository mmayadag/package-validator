import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import {
  DependencyCheckerService,
  type OutdatedDependencies,
  type PackageManifest,
} from '../dependencies/dependency-checker.service.js';
import { EmailService } from '../email/email.service.js';
import { GithubService, type RepositoryRef } from '../github/github.service.js';
import { type RenderedReport, renderReport } from '../report/render-report.js';
import { HOUR_MS, SubscriptionsRepository } from '../subscriptions/subscriptions.repository.js';

export interface RepoReport extends RenderedReport, RepositoryRef {
  outdated: OutdatedDependencies;
}

export interface SubscriptionRequest extends RepositoryRef {
  email: string;
  period: number;
}

export interface ScheduledReport extends RepoReport {
  emailSent: boolean;
  subscription: {
    periodHours: number;
    /** When the next report is due; null until the first one has been delivered. */
    nextReportAt: string | null;
  };
}

@Injectable()
export class RepoService {
  constructor(
    private readonly github: GithubService,
    private readonly dependencyChecker: DependencyCheckerService,
    private readonly email: EmailService,
    private readonly subscriptions: SubscriptionsRepository,
  ) {}

  isValid(ref: RepositoryRef): Promise<boolean> {
    return this.github.repositoryExists(ref);
  }

  async buildReport({ owner, repo }: RepositoryRef): Promise<RepoReport> {
    const ref = { owner, repo };

    if (!(await this.github.repositoryExists(ref))) {
      throw new NotFoundException(`Repository ${owner}/${repo} does not exist or is not public`);
    }

    const raw = await this.github.getPackageJson(ref);
    if (raw === null) {
      throw new UnprocessableEntityException(`${owner}/${repo} has no package.json on its default branch`);
    }

    const outdated = await this.dependencyChecker.findOutdated(parseManifest(raw));
    return { ...ref, outdated, ...renderReport(ref, outdated) };
  }

  /** Validates the repository, stores the subscription and sends the first report right away. */
  async subscribe({ owner, repo, email, period }: SubscriptionRequest): Promise<ScheduledReport> {
    const ref = { owner, repo };
    const report = await this.buildReport(ref);
    const subscription = this.subscriptions.upsert({ ...ref, email, periodHours: period });

    const emailSent = await this.email.sendReport(email, ref, report);
    const now = Date.now();
    if (emailSent) {
      this.subscriptions.markSent(subscription.id, now);
    }

    return {
      ...report,
      emailSent,
      subscription: {
        periodHours: subscription.periodHours,
        nextReportAt: emailSent ? new Date(now + subscription.periodHours * HOUR_MS).toISOString() : null,
      },
    };
  }
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
