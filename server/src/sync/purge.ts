import type { Logger } from "../logger.js";
import type { Db } from "../db/index.js";

const ENTITY_TABLES: [entity: string, table: string][] = [
  ["list", "lists"],
  ["item", "items"],
  ["category", "categories"],
  ["catalog", "catalog"],
  ["card", "cards"],
];

export interface PurgeOptions {
  tombstoneRetentionDays: number;
  now: number;
  /** Keep at most this many purchase events per product. */
  historyPerCatalog?: number;
}

export interface PurgeResult {
  oplogDeleted: number;
  tombstonesDeleted: number;
  historyDeleted: number;
  oplogMinSeq: number;
}

/**
 * Bound the database over time. The critical invariant (from the adversarial
 * review) is that the oplog is compacted by PREFIX TRUNCATION only — never by
 * deleting a middle entry — so any client at/after `oplog_min_seq` still gets a
 * contiguous delta. Clients below it are told to snapshot-reset (see pull()).
 *
 * Tombstone rows are removed only once their delete has sunk below the
 * compaction floor (so everyone has either seen it or will reset), never on a
 * bare calendar age.
 */
export function purge(db: Db, opts: PurgeOptions): PurgeResult {
  const cutoff = opts.now - opts.tombstoneRetentionDays * 86_400_000;
  const perCatalog = opts.historyPerCatalog ?? 100;

  const run = db.transaction((): PurgeResult => {
    // Compaction floor K = highest oplog seq old enough to drop.
    const k = (db.prepare(`SELECT COALESCE(MAX(seq), 0) AS k FROM oplog WHERE created_at < ?`).get(cutoff) as {
      k: number;
    }).k;

    let oplogDeleted = 0;
    let tombstonesDeleted = 0;

    if (k > 0) {
      oplogDeleted = db.prepare(`DELETE FROM oplog WHERE seq <= ?`).run(k).changes;
      db.prepare(`UPDATE sync_meta SET oplog_min_seq = MAX(oplog_min_seq, ?) WHERE id = 1`).run(k);

      const clockStmt = db.prepare(`DELETE FROM field_clocks WHERE entity = ? AND entity_id = ?`);
      for (const [entity, table] of ENTITY_TABLES) {
        const ids = (
          db.prepare(`SELECT id FROM ${table} WHERE deleted = 1 AND updated_seq <= ?`).all(k) as { id: string }[]
        ).map((r) => r.id);
        const rowStmt = db.prepare(`DELETE FROM ${table} WHERE id = ?`);
        for (const id of ids) {
          clockStmt.run(entity, id);
          rowStmt.run(id);
          tombstonesDeleted++;
        }
      }
      // Long-settled idempotency records can go (a retry this old would reset anyway).
      db.prepare(`DELETE FROM applied_mutations WHERE applied_at < ?`).run(cutoff);
    }

    const historyDeleted = db
      .prepare(
        `DELETE FROM purchase_history WHERE seq IN (
           SELECT seq FROM (
             SELECT seq, ROW_NUMBER() OVER (PARTITION BY catalog_id ORDER BY seq DESC) AS rn FROM purchase_history
           ) WHERE rn > ?
         )`,
      )
      .run(perCatalog).changes;

    const oplogMinSeq = (db.prepare(`SELECT oplog_min_seq FROM sync_meta WHERE id = 1`).get() as {
      oplog_min_seq: number;
    }).oplog_min_seq;

    return { oplogDeleted, tombstonesDeleted, historyDeleted, oplogMinSeq };
  });

  return run();
}

/** Run purge at boot and then daily. Returns a stop function. */
export function schedulePurge(db: Db, tombstoneRetentionDays: number, logger: Logger): () => void {
  const tick = () => {
    try {
      const r = purge(db, { tombstoneRetentionDays, now: Date.now() });
      if (r.oplogDeleted || r.tombstonesDeleted || r.historyDeleted) logger.info("purge", { ...r });
    } catch (err) {
      logger.error("purge failed", { err: String(err) });
    }
  };
  tick();
  const timer = setInterval(tick, 24 * 60 * 60 * 1000);
  timer.unref?.();
  return () => clearInterval(timer);
}
