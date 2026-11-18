// Opens the SQLite connection and runs migrations.
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const schemaPath = new URL('./schema.sql', import.meta.url);

/** Opens (or creates) the database file and applies the schema. Pass ':memory:' for tests. */
export const openDb = (path) => {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(readFileSync(schemaPath, 'utf8'));
  return db;
};

/** Runs fn inside a transaction: all of its writes are saved, or none are. */
export const inTransaction = (db, fn) => {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
};
