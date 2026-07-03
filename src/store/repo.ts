import { db } from "./db";
import { ASSETS, ASSET_MAP, STALE_THRESHOLD_MS } from "@/core/assets";
import type {
  AssetId,
  AssetSnapshot,
  Quote,
  SourceHealth,
  TerminalSnapshot,
} from "@/core/types";

/**
 * Source preference per asset. First source wins unless it is stale
 * and a lower-priority source is fresh. For gold we prefer keyless
 * SPOT (gold-api) over Yahoo's gold FUTURES (GC=F), falling back to
 * futures only if spot goes dark.
 */
const SOURCE_PRIORITY: Record<AssetId, string[]> = {
  XAUUSD: ["goldapi", "yahoo"],
  BTCUSD: ["binance"],
  ETHUSD: ["binance"],
  NASDAQ: ["yahoo"],
  SP500: ["yahoo"],
  EURUSD: ["yahoo"],
  DXY: ["yahoo"],
  US10Y: ["yahoo"],
  XAGUSD: ["yahoo"],
  WTIUSD: ["yahoo"],
};

// ---------------- writes ----------------

const insertQuote = db.prepare(`
  INSERT INTO quotes (asset, price, change_pct, bid, ask, currency, source, source_symbol, ts, ingested_at)
  VALUES (@asset, @price, @changePct, @bid, @ask, @currency, @source, @sourceSymbol, @ts, @ingestedAt)
`);

const upsertLatest = db.prepare(`
  INSERT INTO latest (asset, source, price, change_pct, bid, ask, currency, source_symbol, ts, ingested_at)
  VALUES (@asset, @source, @price, @changePct, @bid, @ask, @currency, @sourceSymbol, @ts, @ingestedAt)
  ON CONFLICT(asset, source) DO UPDATE SET
    price=excluded.price, change_pct=excluded.change_pct, bid=excluded.bid, ask=excluded.ask,
    currency=excluded.currency, source_symbol=excluded.source_symbol, ts=excluded.ts,
    ingested_at=excluded.ingested_at
`);

export const writeQuotes = db.transaction((quotes: Quote[]) => {
  for (const q of quotes) {
    insertQuote.run(q);
    upsertLatest.run(q);
  }
});

const upsertHealthStmt = db.prepare(`
  INSERT INTO source_health (id, status, last_success, last_error, last_error_at, last_latency_ms, consecutive_failures, quotes_last_cycle)
  VALUES (@id, @status, @lastSuccess, @lastError, @lastErrorAt, @lastLatencyMs, @consecutiveFailures, @quotesLastCycle)
  ON CONFLICT(id) DO UPDATE SET
    status=excluded.status, last_success=excluded.last_success, last_error=excluded.last_error,
    last_error_at=excluded.last_error_at, last_latency_ms=excluded.last_latency_ms,
    consecutive_failures=excluded.consecutive_failures, quotes_last_cycle=excluded.quotes_last_cycle
`);

export function upsertHealth(h: SourceHealth): void {
  upsertHealthStmt.run(h);
}

// ---------------- reads ----------------

interface LatestRow {
  asset: string;
  source: string;
  price: number;
  change_pct: number | null;
  bid: number | null;
  ask: number | null;
  currency: string;
  source_symbol: string;
  ts: number;
  ingested_at: number;
}

const latestForAsset = db.prepare(
  `SELECT * FROM latest WHERE asset = ?`,
) as unknown as { all: (asset: string) => LatestRow[] };

function rowToQuote(r: LatestRow): Quote {
  return {
    asset: r.asset as AssetId,
    price: r.price,
    changePct: r.change_pct,
    bid: r.bid,
    ask: r.ask,
    currency: r.currency,
    source: r.source,
    sourceSymbol: r.source_symbol,
    ts: r.ts,
    ingestedAt: r.ingested_at,
  };
}

/** Pick the best available quote for one asset per the priority rule. */
function bestQuote(asset: AssetId, now: number): Quote | null {
  const rows = latestForAsset.all(asset);
  if (rows.length === 0) return null;

  const threshold = STALE_THRESHOLD_MS[ASSET_MAP[asset].class];
  const priority = SOURCE_PRIORITY[asset] ?? [];
  const ordered = [...rows].sort(
    (a, b) => priority.indexOf(a.source) - priority.indexOf(b.source),
  );

  // Prefer the highest-priority source that is still fresh.
  const fresh = ordered.find((r) => now - r.ts <= threshold);
  if (fresh) return rowToQuote(fresh);

  // Otherwise fall back to whichever source has the newest observation.
  const newest = ordered.reduce((a, b) => (b.ts > a.ts ? b : a));
  return rowToQuote(newest);
}

const allHealth = db.prepare(`SELECT * FROM source_health`) as unknown as {
  all: () => Array<{
    id: string;
    status: string;
    last_success: number | null;
    last_error: string | null;
    last_error_at: number | null;
    last_latency_ms: number | null;
    consecutive_failures: number;
    quotes_last_cycle: number;
  }>;
};

export function getHealth(): SourceHealth[] {
  return allHealth.all().map((r) => ({
    id: r.id,
    status: r.status as SourceHealth["status"],
    lastSuccess: r.last_success,
    lastError: r.last_error,
    lastErrorAt: r.last_error_at,
    lastLatencyMs: r.last_latency_ms,
    consecutiveFailures: r.consecutive_failures,
    quotesLastCycle: r.quotes_last_cycle,
  }));
}

/** Assemble the full snapshot the dashboard renders. */
export function getSnapshot(now: number): TerminalSnapshot {
  const assets: AssetSnapshot[] = ASSETS.map((meta) => {
    const quote = bestQuote(meta.id, now);
    const ageMs = quote ? now - quote.ts : null;
    const stale =
      quote != null && ageMs != null && ageMs > STALE_THRESHOLD_MS[meta.class];
    return { meta, quote, ageMs, stale };
  });

  const sources = getHealth();
  const assetsWithData = assets.filter((a) => a.quote && !a.stale).length;
  const sourcesLive = sources.filter((s) => s.status === "live").length;
  // Only count sources that are actually meant to be running.
  const activeSourceCount = sources.length;

  return {
    serverTime: now,
    assets,
    sources,
    integrity: {
      assetsWithData,
      assetsTotal: assets.length,
      sourcesLive,
      sourcesTotal: activeSourceCount,
      score: Math.round((assetsWithData / assets.length) * 100),
    },
  };
}
