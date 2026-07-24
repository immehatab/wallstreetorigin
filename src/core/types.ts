// ============================================================
//  Canonical data contracts for the whole terminal.
//  RULE: every value that reaches the UI carries its provenance
//  (source + provider timestamp) or it is not shown at all.
// ============================================================

/** The tradable universe. Matches the user's asset list 1:1. */
export type AssetId =
  | "XAUUSD" // Gold (primary focus)
  | "BTCUSD"
  | "ETHUSD"
  | "NASDAQ" // Nasdaq Composite (^IXIC)
  | "SP500" // S&P 500 (^GSPC)
  | "EURUSD"
  | "DXY" // US Dollar Index
  | "US10Y" // US 10Y Treasury yield (%)
  | "XAGUSD" // Silver
  | "WTIUSD"; // WTI Crude Oil

export type AssetClass =
  | "metal"
  | "crypto"
  | "equity_index"
  | "fx"
  | "rates"
  | "energy";

export interface AssetMeta {
  id: AssetId;
  name: string;
  short: string;
  class: AssetClass;
  /** Display decimals. */
  decimals: number;
  /** Unit label for tooltips (e.g. "USD/oz", "%"). */
  unit: string;
  /** Marks the terminal's primary instrument. */
  primary?: boolean;
}

/**
 * A single normalized price observation. This is the atom of the
 * data foundation — everything upstream (SMC engine, AI agents)
 * consumes these, never raw provider JSON.
 */
export interface Quote {
  asset: AssetId;
  /** Last / mid price in the asset's native quote currency. */
  price: number;
  /** 24h (or since-prev-close) percent change. null when the source can't provide it. */
  changePct: number | null;
  bid: number | null;
  ask: number | null;
  currency: string;
  /** Adapter id that produced this quote (e.g. "binance"). */
  source: string;
  /** The provider's own symbol (e.g. "BTCUSDT", "GC=F"). */
  sourceSymbol: string;
  /** Provider-reported observation time (ms epoch). */
  ts: number;
  /** When our ingestion received it (ms epoch). */
  ingestedAt: number;
}

export type SourceStatus = "unconfigured" | "fresh" | "delayed" | "stale" | "offline";

export type SourceCategory =
  | "price"
  | "crypto"
  | "fx"
  | "rates"
  | "macro"
  | "news"
  | "onchain";

/** Static description of a data provider — the registry entry. */
export interface SourceDef {
  id: string;
  name: string;
  category: SourceCategory;
  /** Assets this source is capable of covering in Module 1. */
  assets: AssetId[];
  /** Homepage / docs, shown in the UI. */
  url: string;
  /** Whether an API key is required to use it at all. */
  requiresKey: boolean;
  /** Env var name that unlocks it (if any). */
  keyEnv?: string;
  /** Human note about rate limits / caveats. */
  note: string;
  /** Poll cadence in ms used by the scheduler. */
  pollMs: number;
  enabled: boolean;
}

/** Live health snapshot for a source, tracked at runtime. */
export interface SourceHealth {
  id: string;
  status: SourceStatus;
  lastSuccess: number | null;
  lastError: string | null;
  lastErrorAt: number | null;
  lastLatencyMs: number | null;
  consecutiveFailures: number;
  quotesLastCycle: number;
}

/** What the dashboard consumes for one asset. */
export interface AssetSnapshot {
  meta: AssetMeta;
  quote: Quote | null; // null => NO DATA (explicit)
  ageMs: number | null;
  stale: boolean;
}

export interface TerminalSnapshot {
  serverTime: number;
  assets: AssetSnapshot[];
  sources: SourceHealth[];
  integrity: {
    assetsWithData: number;
    assetsTotal: number;
    sourcesLive: number;
    sourcesTotal: number;
    /** 0..100 — share of assets with a fresh, sourced quote. */
    score: number;
  };
}
