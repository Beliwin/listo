import type { Logger } from "../logger.js";
import type { Db } from "./index.js";
import { MIGRATIONS, type Migration } from "./migrations.js";

/**
 * Apply any not-yet-applied migrations, each in its own transaction. Idempotent:
 * already-applied migrations (tracked in `_migrations`) are skipped. Run at boot.
 */
export function migrate(db: Db, logger?: Logger, migrations: Migration[] = MIGRATIONS): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)`,
  );
  const applied = new Set(
    (db.prepare(`SELECT name FROM _migrations`).all() as { name: string }[]).map((r) => r.name),
  );
  const insert = db.prepare(`INSERT INTO _migrations (name, applied_at) VALUES (?, ?)`);

  for (const m of migrations) {
    if (applied.has(m.name)) continue;
    const run = db.transaction(() => {
      db.exec(m.sql);
      insert.run(m.name, Date.now());
    });
    run();
    logger?.info("migration applied", { migration: m.name });
  }
}
