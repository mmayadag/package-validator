import type { DatabaseSync } from 'node:sqlite';

export interface Migration {
  /** Value of PRAGMA user_version once the migration has run; consecutive, starting at 1. */
  version: number;
  description: string;
  sql: string;
}

/**
 * Ordered schema changes. Append only: a released migration is never edited,
 * a new one gets the next version. GitHub names and email addresses are
 * case-insensitive, so the unique key is too.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: 'subscriptions table',
    sql: `
      CREATE TABLE subscriptions (
        id           INTEGER PRIMARY KEY,
        owner        TEXT    NOT NULL COLLATE NOCASE,
        repo         TEXT    NOT NULL COLLATE NOCASE,
        email        TEXT    NOT NULL COLLATE NOCASE,
        period_hours INTEGER NOT NULL CHECK (period_hours > 0),
        token        TEXT    NOT NULL UNIQUE,
        created_at   INTEGER NOT NULL,
        last_sent_at INTEGER,
        UNIQUE (owner, repo, email)
      )`,
  },
  {
    version: 2,
    description: 'confirmation state',
    sql: 'ALTER TABLE subscriptions ADD COLUMN confirmed_at INTEGER',
  },
  {
    version: 3,
    description: 'confirmation email throttle',
    sql: 'ALTER TABLE subscriptions ADD COLUMN confirmation_sent_at INTEGER',
  },
];

export const CURRENT_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export interface MigrationResult {
  from: number;
  to: number;
}

/**
 * Brings the database to CURRENT_VERSION, one transaction per migration, and
 * records the version in PRAGMA user_version. A database created before
 * versioning existed (user_version 0 with the table already present) is
 * stamped with the version its columns correspond to and migrated from there.
 */
export function migrate(db: DatabaseSync): MigrationResult {
  const from = detectVersion(db);
  if (from > 0 && recordedVersion(db) === 0) {
    db.exec(`PRAGMA user_version = ${from}`);
  }
  let version = from;

  for (const migration of MIGRATIONS) {
    if (migration.version <= version) continue;
    if (migration.version !== version + 1) {
      throw new Error(`Migration ${migration.version} does not follow version ${version}`);
    }
    db.exec('BEGIN');
    try {
      db.exec(migration.sql);
      db.exec(`PRAGMA user_version = ${migration.version}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    version = migration.version;
  }

  return { from, to: version };
}

const recordedVersion = (db: DatabaseSync): number =>
  (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;

function detectVersion(db: DatabaseSync): number {
  const recorded = recordedVersion(db);
  if (recorded > 0) return recorded;

  const columns = new Set(
    (db.prepare('PRAGMA table_info(subscriptions)').all() as Array<{ name: string }>).map(({ name }) => name),
  );
  if (columns.size === 0) return 0;
  if (columns.has('confirmation_sent_at')) return 3;
  return columns.has('confirmed_at') ? 2 : 1;
}
