import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { RepoReport, RepositoryRef } from '@package-validator/contracts';
import { DependencyCheckerService, type PackageManifest } from '../dependencies/dependency-checker.service.js';
import { GithubService } from '../github/github.service.js';

export const REPORT_CACHE_TTL_MS = 60 * 60 * 1000;
/** Upper bound on cached reports; the oldest entry is evicted beyond it. */
const REPORT_CACHE_MAX_ENTRIES = 500;

/** Builds the outdated-dependency report of a repository and keeps it for an hour. */
@Injectable()
export class ReportService {
  private readonly reports = new Map<string, { report: RepoReport; expiresAt: number }>();

  constructor(
    private readonly github: GithubService,
    private readonly dependencyChecker: DependencyCheckerService,
  ) {}

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

  /** Drops every cached report; used to isolate tests. */
  clearCache(): void {
    this.reports.clear();
  }

  private async fetchReport(ref: RepositoryRef): Promise<RepoReport> {
    const { owner, repo } = ref;

    const result = await this.github.fetchPackageJson(ref);
    if (!result.exists) {
      throw new NotFoundException(`Repository ${owner}/${repo} does not exist or is not public`);
    }
    if (result.packageJson === null) {
      throw new UnprocessableEntityException(`${owner}/${repo} has no package.json on its default branch`);
    }

    const outdated = await this.dependencyChecker.findOutdated(parseManifest(result.packageJson));
    return { ...ref, outdated, generatedAt: new Date().toISOString() };
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
