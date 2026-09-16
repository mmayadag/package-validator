import {
  type ConfirmedSubscription,
  REPORT_PERIODS,
  type ReportPeriod,
  type RepositoryRef,
  type ScheduledReport,
  type SubscriptionRequest,
  type ValidityResponse,
} from '@package-validator/contracts';

export { REPORT_PERIODS };
export type {
  ChangeKind,
  ConfirmedSubscription,
  OutdatedDependency,
  ReportPeriod,
  ScheduledReport,
  SubscriptionSummary,
} from '@package-validator/contracts';

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
  const path = `/v1/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const { valid } = await request<ValidityResponse>(path, { signal });
  return valid;
}

export function scheduleReport(body: SubscriptionRequest): Promise<ScheduledReport> {
  return request<ScheduledReport>('/v1/subscriptions', { method: 'POST', body: JSON.stringify(body) });
}

export function confirmSubscription(token: string): Promise<ConfirmedSubscription> {
  return request<ConfirmedSubscription>(`/v1/subscriptions/${encodeURIComponent(token)}/confirm`, { method: 'POST' });
}

export async function unsubscribe(token: string): Promise<void> {
  await request<null>(`/v1/subscriptions/${encodeURIComponent(token)}`, { method: 'DELETE' });
}
