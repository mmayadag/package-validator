import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration.js';
import { SubscriptionsRepository } from './subscriptions.repository.js';

const config = { get: () => ':memory:' } as unknown as ConfigService<AppConfig, true>;
const input = { owner: 'mmayadag', repo: 'package-validator', email: 'dev@example.com', periodHours: 24 };

describe('SubscriptionsRepository', () => {
  let repository: SubscriptionsRepository;

  beforeEach(() => {
    repository = new SubscriptionsRepository(config);
  });

  afterEach(() => {
    repository.onModuleDestroy();
  });

  it('creates a subscription with an unguessable token', () => {
    const subscription = repository.upsert(input, 1_000);

    expect(subscription).toMatchObject({ ...input, createdAt: 1_000, lastSentAt: null });
    expect(subscription.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it('updates the period of an existing subscription, ignoring case, and keeps its token', () => {
    const first = repository.upsert(input);
    const second = repository.upsert({ ...input, owner: 'MMayadag', email: 'DEV@example.com', periodHours: 6 });

    expect(second).toMatchObject({ id: first.id, token: first.token, periodHours: 6 });
  });

  it('gives every subscription its own token', () => {
    const first = repository.upsert(input);
    const second = repository.upsert({ ...input, repo: 'other' });

    expect(second.token).not.toBe(first.token);
  });

  it('records when a report was sent', () => {
    const { id } = repository.upsert(input);

    repository.markSent(id, 5_000);

    expect(repository.find(input)?.lastSentAt).toBe(5_000);
  });

  it('finds subscriptions that were never delivered or whose period has elapsed', () => {
    const due = repository.upsert({ ...input, repo: 'due', periodHours: 6 });
    const fresh = repository.upsert({ ...input, repo: 'fresh', periodHours: 24 });
    repository.upsert({ ...input, repo: 'never-sent' });
    repository.markSent(due.id, 0);
    repository.markSent(fresh.id, 0);

    const sixHoursLater = 6 * 3_600_000;

    expect(repository.findDue(sixHoursLater).map(({ repo }) => repo)).toEqual(['due', 'never-sent']);
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
