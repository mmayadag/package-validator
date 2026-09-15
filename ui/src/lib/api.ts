import type { RepositoryRef } from './git-url';

export const REPORT_PERIODS = [6, 12, 24] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export type ChangeKind = 'major' | 'minor' | 'patch' | 'unknown';

export interface OutdatedDependency {
  name: string;
  current: string;
  latest: string;
  /** Semver distance to the latest release; `major` may break. */
  change: ChangeKind;
}

export interface SubscriptionSummary {
  /** `pending` until the address owner confirms by email. */
  status: 'pending' | 'active';
  periodHours: ReportPeriod;
  /** ISO timestamp; null until the first report has been emailed. */
  nextReportAt: string | null;
}

export interface ScheduledReport extends RepositoryRef {
  outdated: Record<string, OutdatedDependency[]>;
  text: string;
  /** Whether a confirmation request or the report itself was emailed. */
  emailSent: boolean;
  subscription: SubscriptionSummary;
}

export interface ConfirmedSubscription extends RepositoryRef {
  email: string;
  subscription: SubscriptionSummary;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Nest returns `{ message: string | string[] }` for handled errors. */
function errorMessage(body: unknown, status: number): string {
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const { message } = body;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
  }
  return `Request failed with status ${status}`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(errorMessage(body, response.status), response.status);
  }
  return body as T;
}

export async function isValidRepository({ owner, repo }: RepositoryRef, signal?: AbortSignal): Promise<boolean> {
  const path = `/repo/isValid/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const { valid } = await request<{ valid: boolean }>(path, { signal });
  return valid;
}

export function scheduleReport(body: RepositoryRef & { email: string; period: ReportPeriod }): Promise<ScheduledReport> {
  return request<ScheduledReport>('/repo/schedule', { method: 'POST', body: JSON.stringify(body) });
}

export function confirmSubscription(token: string): Promise<ConfirmedSubscription> {
  return request<ConfirmedSubscription>(`/repo/subscriptions/${encodeURIComponent(token)}/confirm`, { method: 'POST' });
}

export async function unsubscribe(token: string): Promise<void> {
  await request<null>(`/repo/subscriptions/${encodeURIComponent(token)}`, { method: 'DELETE' });
}
