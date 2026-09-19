/**
 * Shapes exchanged between the API and the UI. The API validates and
 * documents them with class-validator and OpenAPI decorators; the UI reads
 * them as plain types. Both import from here so they cannot drift apart.
 */

/** GitHub's naming rules for users, organisations and repositories, as regex sources without anchors. */
export const GITHUB_OWNER_PATTERN = '[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})';
export const GITHUB_REPO_PATTERN = '[A-Za-z0-9._-]{1,100}';

export interface RepositoryRef {
  owner: string;
  repo: string;
}

export const DEPENDENCY_SECTIONS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

export type DependencySection = (typeof DEPENDENCY_SECTIONS)[number];

/** Semver distance between the declared range and the latest release; `major` may break. */
export const CHANGE_KINDS = ['major', 'minor', 'patch', 'unknown'] as const;

export type ChangeKind = (typeof CHANGE_KINDS)[number];

export interface OutdatedDependency {
  name: string;
  /** Range declared in package.json. */
  current: string;
  /** Range for the latest release on npm. */
  latest: string;
  change: ChangeKind;
}

/** Only sections with outdated packages are present. */
export type OutdatedDependencies = Partial<Record<DependencySection, OutdatedDependency[]>>;

export interface RepoReport extends RepositoryRef {
  outdated: OutdatedDependencies;
  /** ISO timestamp of the registry lookup; a report is reused for up to an hour. */
  generatedAt: string;
}

export interface ValidityResponse {
  valid: boolean;
}

/** Hours between two scheduled reports. */
export const REPORT_PERIODS = [6, 12, 24, 168] as const;

export type ReportPeriod = (typeof REPORT_PERIODS)[number];

/** Human-readable label for a report period, e.g. `'6 hours'` or `'1 week'`. */
export function formatPeriod(hours: ReportPeriod): string {
  return hours === 168 ? '1 week' : `${hours} hours`;
}

export const SUBSCRIPTION_STATUSES = ['pending', 'active'] as const;

/** `pending` until the address owner confirms by email; only active subscriptions receive scheduled reports. */
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export interface SubscriptionRequest extends RepositoryRef {
  email: string;
  period: ReportPeriod;
}

export interface SubscriptionSummary {
  status: SubscriptionStatus;
  periodHours: ReportPeriod;
  /** When the next report is due; null until the first one has been delivered. */
  nextReportAt: string | null;
}

export interface ScheduledReport extends RepoReport {
  /** Whether an email (confirmation request or report) was sent. */
  emailSent: boolean;
  subscription: SubscriptionSummary;
}

export interface ConfirmedSubscription extends RepositoryRef {
  email: string;
  subscription: SubscriptionSummary;
}

export interface HealthResponse {
  status: 'ok';
}

/** Body of every error response; `message` is a list for failed validation rules. */
export interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
}
