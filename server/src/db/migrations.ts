/**
 * Schema migrations as embedded SQL strings (not files): the server is bundled
 * to a single file, so reading `.sql` from disk at runtime would be brittle.
 * Each migration runs once, in a transaction, in array order. Append-only —
 * never edit a migration that has shipped; add a new one.
 */
export interface Migration {
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    name: "001_init",
    sql: /* sql */ `
      -- Singleton row holding instance-wide sync bookkeeping.
      CREATE TABLE sync_meta (
        id             INTEGER PRIMARY KEY CHECK (id = 1),
        epoch          INTEGER NOT NULL DEFAULT 1,   -- bumped on snapshot-reset (e.g. after restore)
        oplog_min_seq  INTEGER NOT NULL DEFAULT 0,   -- oldest seq still in the oplog (compaction floor)
        schema_version INTEGER NOT NULL DEFAULT 1,
        created_at     INTEGER NOT NULL
      );
      INSERT INTO sync_meta (id, epoch, oplog_min_seq, schema_version, created_at)
      VALUES (1, 1, 0, 1, unixepoch() * 1000);
    `,
  },
  {
    name: "002_sync",
    sql: /* sql */ `
      -- The server is itself an HLC node; persist its clock so it never regresses
      -- across restarts. (foreign_keys are OFF: entities may sync out of order.)
      ALTER TABLE sync_meta ADD COLUMN server_wall INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE sync_meta ADD COLUMN server_counter INTEGER NOT NULL DEFAULT 0;

      CREATE TABLE lists (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL DEFAULT '',
        rank        TEXT NOT NULL DEFAULT '',
        deleted     INTEGER NOT NULL DEFAULT 0,
        deleted_hlc TEXT,
        updated_seq INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE items (
        id          TEXT PRIMARY KEY,
        list_id     TEXT NOT NULL DEFAULT '',
        catalog_id  TEXT,
        name        TEXT NOT NULL DEFAULT '',
        qty         REAL,
        unit_key    TEXT,
        checked     INTEGER NOT NULL DEFAULT 0,
        checked_at  INTEGER,
        added_by    TEXT,
        note        TEXT,
        rank        TEXT NOT NULL DEFAULT '',
        deleted     INTEGER NOT NULL DEFAULT 0,
        deleted_hlc TEXT,
        updated_seq INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX ix_items_list ON items(list_id);

      CREATE TABLE categories (
        id          TEXT PRIMARY KEY,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        icon        TEXT,
        deleted     INTEGER NOT NULL DEFAULT 0,
        deleted_hlc TEXT,
        updated_seq INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE catalog (
        id               TEXT PRIMARY KEY,
        display_name     TEXT NOT NULL DEFAULT '',
        normalized_name  TEXT NOT NULL DEFAULT '',
        locale           TEXT NOT NULL DEFAULT 'fr',
        category_key     TEXT,
        default_unit_key TEXT,
        use_count        INTEGER NOT NULL DEFAULT 0,
        deleted          INTEGER NOT NULL DEFAULT 0,
        deleted_hlc      TEXT,
        updated_seq      INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX ix_catalog_norm ON catalog(normalized_name, locale);

      -- Per-field HLCs (per-field LWW). Keyed by (entity, id, field).
      CREATE TABLE field_clocks (
        entity    TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        field     TEXT NOT NULL,
        hlc       TEXT NOT NULL,
        PRIMARY KEY (entity, entity_id, field)
      );

      -- The change journal: a server-assigned, monotonic, gap-free transport cursor.
      CREATE TABLE oplog (
        seq          INTEGER PRIMARY KEY AUTOINCREMENT,
        mutation_id  TEXT NOT NULL,
        entity       TEXT NOT NULL,
        entity_id    TEXT NOT NULL,
        field_deltas TEXT NOT NULL,   -- JSON FieldDelta[] actually applied
        deleted_hlc  TEXT,            -- set when this op tombstoned the entity
        resurrect    INTEGER NOT NULL DEFAULT 0, -- 1 when this op cleared a tombstone
        origin       TEXT NOT NULL,   -- authoring clientId
        created_at   INTEGER NOT NULL
      );
      CREATE INDEX ix_oplog_entity ON oplog(entity, entity_id);

      -- Idempotency + exactly-once guard for derived effects.
      CREATE TABLE applied_mutations (
        mutation_id TEXT PRIMARY KEY,
        status      TEXT NOT NULL,
        applied_at  INTEGER NOT NULL
      );
    `,
  },
  {
    name: "003_history",
    sql: /* sql */ `
      -- Append-only log of "bought" events (a 0→1 check), feeding suggestions.
      -- Written as an exactly-once derived effect of an item-check mutation.
      CREATE TABLE purchase_history (
        seq        INTEGER PRIMARY KEY AUTOINCREMENT,
        catalog_id TEXT NOT NULL,
        list_id    TEXT,
        checked_at INTEGER NOT NULL,
        origin     TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX ix_history_catalog ON purchase_history(catalog_id);
    `,
  },
  {
    name: "004_qty_text",
    sql: /* sql */ `
      -- Free-text quantity (e.g. "2 kg", "x3", "1 paquet"), replacing the numeric
      -- qty + unit pair in the UI. The old columns stay for back-compat.
      ALTER TABLE items ADD COLUMN qty_text TEXT;
    `,
  },
];
