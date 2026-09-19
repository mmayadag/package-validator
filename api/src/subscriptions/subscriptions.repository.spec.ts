import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration.js';
import { PENDING_TTL_MS, SubscriptionsRepository } from './subscriptions.repository.js';

const config = { get: () => ':memory:' } as unknown as ConfigService<AppConfig, true>;
const input = { owner: 'mmayadag', repo: 'package-validator', email: 'dev@example.com', periodHours: 24 };
const HOUR = 3_600_000;

describe('SubscriptionsRepository', () => {
  let repository: SubscriptionsRepository;

  beforeEach(() => {
    repository = new SubscriptionsRepository(config);
  });

  afterEach(() => {
    repository.onModuleDestroy();
  });

  it('creates a pending subscription with an unguessable token', () => {
    const subscription = repository.upsert(input, 1_000);

    expect(subscription).toMatchObject({
      ...input,
      createdAt: 1_000,
      confirmedAt: null,
      lastSentAt: null,
      confirmationSentAt: null,
    });
    expect(subscription.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it('updates the period of an existing subscription, ignoring case, and keeps its token and confirmation', () => {
    const first = repository.upsert(input);
    repository.confirm(first.token, 500);

    const second = repository.upsert({ ...input, owner: 'MMayadag', email: 'DEV@example.com', periodHours: 6 });

    expect(second).toMatchObject({ id: first.id, token: first.token, periodHours: 6, confirmedAt: 500 });
  });

  it('gives every subscription its own token', () => {
    const first = repository.upsert(input);
    const second = repository.upsert({ ...input, repo: 'other' });

    expect(second.token).not.toBe(first.token);
  });

  it('confirms by token once and keeps the first confirmation time', () => {
    const { token } = repository.upsert(input);

    expect(repository.confirm(token, 700)?.confirmedAt).toBe(700);
    expect(repository.confirm(token, 900)?.confirmedAt).toBe(700);
    expect(repository.confirm('unknown')).toBeNull();
    expect(repository.findByToken(token)?.confirmedAt).toBe(700);
  });

  it('records when a report was sent', () => {
    const { id } = repository.upsert(input);

    repository.markSent(id, 5_000);

    expect(repository.find(input)?.lastSentAt).toBe(5_000);
  });

  it('records when a confirmation email was sent', () => {
    const { id } = repository.upsert(input);

    repository.markConfirmationSent(id, 5_000);

    expect(repository.find(input)?.confirmationSentAt).toBe(5_000);
  });

  it('returns null confirming a pending token that has outlived the 24-hour TTL', () => {
    const { token } = repository.upsert(input, 0);

    expect(repository.confirm(token, PENDING_TTL_MS + HOUR)).toBeNull();
    expect(repository.find(input)?.confirmedAt).toBeNull();
  });

  it('finds only confirmed subscriptions that were never delivered or whose period has elapsed', () => {
    const due = repository.upsert({ ...input, repo: 'due', periodHours: 6 });
    const fresh = repository.upsert({ ...input, repo: 'fresh', periodHours: 24 });
    const neverSent = repository.upsert({ ...input, repo: 'never-sent' });
    repository.upsert({ ...input, repo: 'pending' });
    for (const { token } of [due, fresh, neverSent]) repository.confirm(token, 0);
    repository.markSent(due.id, 0);
    repository.markSent(fresh.id, 0);

    expect(repository.findDue(6 * HOUR).map(({ repo }) => repo)).toEqual(['due', 'never-sent']);
  });

  it('removes pending subscriptions older than the TTL', () => {
    repository.upsert({ ...input, repo: 'old-pending' }, 0);
    const confirmed = repository.upsert({ ...input, repo: 'old-confirmed' }, 0);
    repository.confirm(confirmed.token, 0);
    repository.upsert({ ...input, repo: 'new-pending' }, PENDING_TTL_MS);

    expect(repository.deleteExpiredPending(PENDING_TTL_MS + 1)).toBe(1);
    expect(repository.find({ ...input, repo: 'old-pending' })).toBeNull();
    expect(repository.find({ ...input, repo: 'old-confirmed' })).not.toBeNull();
    expect(repository.find({ ...input, repo: 'new-pending' })).not.toBeNull();
  });

  it('returns null for an unknown subscription', () => {
    expect(repository.find(input)).toBeNull();
  });

  it('deletes a subscription by its token', () => {
    const { token } = repository.upsert(input);

    expect(repository.deleteByToken(token)).toBe(true);
    expect(repository.find(input)).toBeNull();
    expect(repository.deleteByToken(token)).toBe(false);
  });
});
