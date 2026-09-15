import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration.js';

export const HOUR_MS = 3_600_000;

export interface Subscription {
  id: number;
  owner: string;
  repo: string;
  email: string;
  periodHours: number;
  /** Secret that authorises unsubscribing without an account. */
  token: string;
  createdAt: number;
  lastSentAt: number | null;
}

export type SubscriptionKey = Pick<Subscription, 'owner' | 'repo' | 'email'>;
export type NewSubscription = SubscriptionKey & Pick<Subscription, 'periodHours'>;

// GitHub names and email addresses are case-insensitive, so the unique key is too.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS subscriptions (
    id           INTEGER PRIMARY KEY,
    owner        TEXT    NOT NULL COLLATE NOCASE,
    repo         TEXT    NOT NULL COLLATE NOCASE,
    email        TEXT    NOT NULL COLLATE NOCASE,
    period_hours INTEGER NOT NULL CHECK (period_hours > 0),
    token        TEXT    NOT NULL UNIQUE,
    created_at   INTEGER NOT NULL,
    last_sent_at INTEGER,
    UNIQUE (owner, repo, email)
  );
`;

@Injectable()
export class SubscriptionsRepository implements OnModuleDestroy {
  private readonly db: DatabaseSync;
  private readonly upsertStatement: StatementSync;
  private readonly findStatement: StatementSync;
  private readonly markSentStatement: StatementSync;

  constructor(config: ConfigService<AppConfig, true>) {
    const path = config.get('databasePath', { infer: true });
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true });
    }

    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec(SCHEMA);

    this.upsertStatement = this.db.prepare(`
      INSERT INTO subscriptions (owner, repo, email, period_hours, token, created_at)
      VALUES (:owner, :repo, :email, :periodHours, :token, :now)
      ON CONFLICT (owner, repo, email) DO UPDATE SET period_hours = excluded.period_hours
      RETURNING *
    `);
    this.findStatement = this.db.prepare(
      'SELECT * FROM subscriptions WHERE owner = :owner AND repo = :repo AND email = :email',
    );
    this.markSentStatement = this.db.prepare('UPDATE subscriptions SET last_sent_at = :at WHERE id = :id');
  }

  /** Creates the subscription, or updates the period of an existing one and keeps its token. */
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

  markSent(id: number, at = Date.now()): void {
    this.markSentStatement.run({ id, at });
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
    lastSentAt: row.last_sent_at === null ? null : Number(row.last_sent_at),
  };
}
