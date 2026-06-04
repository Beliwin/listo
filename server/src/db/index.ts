import Database from "better-sqlite3";

export type Db = Database.Database;

/**
 * Open (or create) the SQLite database with the PRAGMAs Listo's sync engine
 * relies on:
 *  - WAL: concurrent readers while a single writer commits (SSE fanout reads
 *    while a push writes).
 *  - foreign_keys = OFF: a sync system applies entities out of causal order
 *    (an item may arrive before its catalog row). Referential integrity is
 *    enforced in application code, not by hard FK constraints.
 */
export function openDatabase(path: string): Db {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = OFF");
  db.pragma("busy_timeout = 5000");
  return db;
}
