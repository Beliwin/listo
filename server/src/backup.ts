import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import Database from "better-sqlite3";

/**
 * Consistent hot backup via `VACUUM INTO` — works while the server runs (WAL),
 * producing a single defragmented snapshot file (no -wal/-shm sidecars to worry
 * about). Restore = stop the server, replace listo.db, delete -wal/-shm, restart.
 */
export function runBackup(dataDir: string, target?: string, stamp = String(Date.now())): string {
  const dbPath = join(dataDir, "listo.db");
  const out = target ? resolve(target) : join(dataDir, "backups", `listo-${stamp}.db`);
  mkdirSync(dirname(out), { recursive: true });

  const db = new Database(dbPath);
  try {
    db.exec(`VACUUM INTO '${out.replace(/'/g, "''")}'`);
  } finally {
    db.close();
  }
  return out;
}
