import { DatabaseSync } from 'node:sqlite';
import { CURRENT_VERSION, MIGRATIONS, migrate } from './migrations.js';

const version = (db: DatabaseSync) =>
  (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
const columns = (db: DatabaseSync) =>
  (db.prepare('PRAGMA table_info(subscriptions)').all() as Array<{ name: string }>).map(({ name }) => name);

const LEGACY_TABLE = `
  CREATE TABLE subscriptions (
    id INTEGER PRIMARY KEY, owner TEXT NOT NULL, repo TEXT NOT NULL, email TEXT NOT NULL,
    period_hours INTEGER NOT NULL, token TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, last_sent_at INTEGER,
    UNIQUE (owner, repo, email)
  )`;

describe('migrations', () => {
  it('are numbered consecutively from 1', () => {
    expect(MIGRATIONS.map(({ version }) => version)).toEqual(MIGRATIONS.map((_, index) => index + 1));
    expect(CURRENT_VERSION).toBe(MIGRATIONS.length);
  });

  it('bring an empty database to the current version and are then a no-op', () => {
    const db = new DatabaseSync(':memory:');

    expect(migrate(db)).toEqual({ from: 0, to: CURRENT_VERSION });
    expect(version(db)).toBe(CURRENT_VERSION);
    expect(columns(db)).toContain('confirmed_at');

    expect(migrate(db)).toEqual({ from: CURRENT_VERSION, to: CURRENT_VERSION });
  });

  it('upgrade a database created before confirmations without losing rows', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(LEGACY_TABLE);
    db.prepare('INSERT INTO subscriptions VALUES (1, ?, ?, ?, 24, ?, 0, NULL)').run(
      'a',
      'b',
      'c@example.com',
      't'.repeat(32),
    );

    expect(migrate(db)).toEqual({ from: 1, to: CURRENT_VERSION });
    expect(db.prepare('SELECT confirmed_at FROM subscriptions WHERE id = 1').get()).toEqual({ confirmed_at: null });
  });

  it('stamp a database created with the full schema before versioning existed', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(LEGACY_TABLE);
    db.exec('ALTER TABLE subscriptions ADD COLUMN confirmed_at INTEGER');

    expect(migrate(db)).toEqual({ from: 2, to: CURRENT_VERSION });
    expect(version(db)).toBe(CURRENT_VERSION);
  });

  it('roll back a failing migration and leave the version untouched', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db);
    db.exec(`PRAGMA user_version = ${CURRENT_VERSION - 1}`);

    // confirmed_at already exists, so the last migration fails
    expect(() => migrate(db)).toThrow(/duplicate column/);
    expect(version(db)).toBe(CURRENT_VERSION - 1);
  });
});
