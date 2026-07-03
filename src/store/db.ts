import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * File-based SQLite store. Zero external services — perfect for a
 * single-user terminal on a Mac. WAL mode so the ingestion writer and
 * the Next.js API readers never block each other.
 *
 * Kept as a process-wide singleton on globalThis so Next.js dev's
 * module reloading doesn't open a second handle to the same file.
 */
const DB_PATH = resolve(process.cwd(), "data", "terminal.db");

declare global {
  // eslint-disable-next-line no-var
  var __terminalDb: Database.Database | undefined;
}

function open(): Database.Database {
  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("busy_timeout = 5000");

  db.exec(`
    -- Append-only tick log. History for later modules (SMC candles,
    -- change% backfill, backtests). Never mutated in place.
    CREATE TABLE IF NOT EXISTS quotes (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      asset        TEXT    NOT NULL,
      price        REAL    NOT NULL,
      change_pct   REAL,
      bid          REAL,
      ask          REAL,
      currency     TEXT    NOT NULL,
      source       TEXT    NOT NULL,
      source_symbol TEXT   NOT NULL,
      ts           INTEGER NOT NULL,
      ingested_at  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_quotes_asset_ts ON quotes (asset, ts DESC);

    -- Current best snapshot per (asset, source). Upserted each cycle.
    CREATE TABLE IF NOT EXISTS latest (
      asset        TEXT NOT NULL,
      source       TEXT NOT NULL,
      price        REAL NOT NULL,
      change_pct   REAL,
      bid          REAL,
      ask          REAL,
      currency     TEXT NOT NULL,
      source_symbol TEXT NOT NULL,
      ts           INTEGER NOT NULL,
      ingested_at  INTEGER NOT NULL,
      PRIMARY KEY (asset, source)
    );

    -- Live per-source health. One row per source id.
    CREATE TABLE IF NOT EXISTS source_health (
      id                   TEXT PRIMARY KEY,
      status               TEXT NOT NULL,
      last_success         INTEGER,
      last_error           TEXT,
      last_error_at        INTEGER,
      last_latency_ms      INTEGER,
      consecutive_failures INTEGER NOT NULL DEFAULT 0,
      quotes_last_cycle    INTEGER NOT NULL DEFAULT 0
    );

    -- MACRO ENGINE: one row per FRED series, upserted each poll.
    CREATE TABLE IF NOT EXISTS macro_series (
      key          TEXT PRIMARY KEY,
      fred_id      TEXT NOT NULL,
      label        TEXT NOT NULL,
      category     TEXT NOT NULL,
      unit         TEXT NOT NULL,
      decimals     INTEGER NOT NULL,
      value        REAL NOT NULL,
      date         TEXT NOT NULL,
      change       REAL,
      change_label TEXT NOT NULL,
      gold_bias    TEXT NOT NULL,
      why          TEXT NOT NULL,
      updated_at   INTEGER NOT NULL
    );

    -- NEWS ENGINE: scored items. id = hash(url+title), dedup on conflict.
    CREATE TABLE IF NOT EXISTS news_items (
      id           TEXT PRIMARY KEY,
      feed_id      TEXT NOT NULL,
      feed_name    TEXT NOT NULL,
      category     TEXT NOT NULL,
      title        TEXT NOT NULL,
      url          TEXT NOT NULL,
      summary      TEXT NOT NULL,
      published_at INTEGER NOT NULL,
      ingested_at  INTEGER NOT NULL,
      score_json   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_news_published ON news_items (published_at DESC);

    -- SMC ENGINE: OHLC candles, keyed by (asset, timeframe, open time).
    CREATE TABLE IF NOT EXISTS candles (
      asset     TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      ts        INTEGER NOT NULL,
      open      REAL NOT NULL,
      high      REAL NOT NULL,
      low       REAL NOT NULL,
      close     REAL NOT NULL,
      volume    REAL NOT NULL,
      source    TEXT NOT NULL,
      PRIMARY KEY (asset, timeframe, ts)
    );
    CREATE INDEX IF NOT EXISTS idx_candles_lookup ON candles (asset, timeframe, ts DESC);

    -- BTC ENGINE: latest derivatives snapshot (single row).
    CREATE TABLE IF NOT EXISTS btc_onchain (
      id         INTEGER PRIMARY KEY,
      json       TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  return db;
}

export const db: Database.Database = globalThis.__terminalDb ?? open();
if (process.env.NODE_ENV !== "production") globalThis.__terminalDb = db;

export { DB_PATH };
