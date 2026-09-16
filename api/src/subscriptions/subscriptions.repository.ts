import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration.js';
import { migrate } from './migrations.js';

export const HOUR_MS = 3_600_000;
/** Unconfirmed subscriptions are removed after this long. */
export const PENDING_TTL_MS = 24 * HOUR_MS;

export interface Subscription {
  id: number;
  owner: string;
  repo: string;
  email: string;
  periodHours: number;
  /** Secret in the confirmation and unsubscribe links; never returned by the API. */
  token: string;
  createdAt: number;
  /** Set once the address owner clicked the confirmation link. */
  confirmedAt: number | null;
  lastSentAt: number | null;
}

export type SubscriptionKey = Pick<Subscription, 'owner' | 'repo' | 'email'>;
export type NewSubscription = SubscriptionKey & Pick<Subscription, 'periodHours'>;

@Injectable()
export class SubscriptionsRepository implements OnModuleDestroy {
  private readonly logger = new Logger(SubscriptionsRepository.name);
  private readonly db: DatabaseSync;
  private readonly upsertStatement: StatementSync;
  private readonly findStatement: StatementSync;
  private readonly findByTokenStatement: StatementSync;
  private readonly findDueStatement: StatementSync;
  private readonly confirmStatement: StatementSync;
  private readonly markSentStatement: StatementSync;
  private readonly deleteByTokenStatement: StatementSync;
  private readonly deleteExpiredPendingStatement: StatementSync;

  constructor(config: ConfigService<AppConfig, true>) {
    const path = config.get('databasePath', { infer: true });
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true });
    }

    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode = WAL');
    const { from, to } = migrate(this.db);
    if (to !== from) {
      this.logger.log(`Migrated the database schema from version ${from} to ${to}`);
    }

    this.upsertStatement = this.db.prepare(`
      INSERT INTO subscriptions (owner, repo, email, period_hours, token, created_at)
      VALUES (:owner, :repo, :email, :periodHours, :token, :now)
      ON CONFLICT (owner, repo, email) DO UPDATE SET period_hours = excluded.period_hours
      RETURNING *
    `);
    this.findStatement = this.db.prepare(
      'SELECT * FROM subscriptions WHERE owner = :owner AND repo = :repo AND email = :email',
    );
    this.findByTokenStatement = this.db.prepare('SELECT * FROM subscriptions WHERE token = :token');
    this.findDueStatement = this.db.prepare(`
      SELECT * FROM subscriptions
      WHERE confirmed_at IS NOT NULL
        AND (last_sent_at IS NULL OR last_sent_at + period_hours * ${HOUR_MS} <= :now)
      ORDER BY id
    `);
    this.confirmStatement = this.db.prepare(
      'UPDATE subscriptions SET confirmed_at = COALESCE(confirmed_at, :now) WHERE token = :token RETURNING *',
    );
    this.markSentStatement = this.db.prepare('UPDATE subscriptions SET last_sent_at = :at WHERE id = :id');
    this.deleteByTokenStatement = this.db.prepare('DELETE FROM subscriptions WHERE token = :token');
    this.deleteExpiredPendingStatement = this.db.prepare(
      'DELETE FROM subscriptions WHERE confirmed_at IS NULL AND created_at < :before',
    );
  }

  /** Creates the subscription, or updates the period of an existing one and keeps its token and confirmation. */
  upsert({ owner, repo, email, periodHours }: NewSubscription, now = Date.now()): Subscription {
    const token = randomBytes(24).toString('base64url');
    const row = this.upsertStatement.get({ owner, repo, email, periodHours, token, now });
    if (!row) {
      throw new Error('Subscription upsert returned no row');
    }
    return toSubscription(row);
  }

  find({ owner, repo, email }: SubscriptionKey): Subscription | null {
    const row = this.findStatement.get({ owner, repo, email });
    return row ? toSubscription(row) : null;
  }

  findByToken(token: string): Subscription | null {
    const row = this.findByTokenStatement.get({ token });
    return row ? toSubscription(row) : null;
  }

  /** Confirmed subscriptions that have never been delivered or whose period has elapsed. */
  findDue(now = Date.now()): Subscription[] {
    return this.findDueStatement.all({ now }).map(toSubscription);
  }

  /** Marks the subscription confirmed; a second confirmation keeps the original time. */
  confirm(token: string, now = Date.now()): Subscription | null {
    const row = this.confirmStatement.get({ token, now });
    return row ? toSubscription(row) : null;
  }

  markSent(id: number, at = Date.now()): void {
    this.markSentStatement.run({ id, at });
  }

  /** Returns whether a subscription with this token existed. */
  deleteByToken(token: string): boolean {
    return Number(this.deleteByTokenStatement.run({ token }).changes) > 0;
  }

  /** Removes subscriptions that were never confirmed within the pending TTL. Returns how many. */
  deleteExpiredPending(now = Date.now()): number {
    return Number(this.deleteExpiredPendingStatement.run({ before: now - PENDING_TTL_MS }).changes);
  }

  onModuleDestroy(): void {
    this.db.close();
  }
}

function toSubscription(row: Record<string, unknown>): Subscription {
  return {
    id: Number(row.id),
    owner: String(row.owner),
    repo: String(row.repo),
    email: String(row.email),
    periodHours: Number(row.period_hours),
    token: String(row.token),
    createdAt: Number(row.created_at),
    confirmedAt: row.confirmed_at === null ? null : Number(row.confirmed_at),
    lastSentAt: row.last_sent_at === null ? null : Number(row.last_sent_at),
  };
}
