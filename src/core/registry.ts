import type { SourceDef } from "./types";

/**
 * THE SOURCE REGISTRY.
 *
 * Every provider the terminal knows about is declared here — its
 * coverage, whether it needs a key, and its poll cadence. Module 1
 * ships the three keyless price sources (all verified live on
 * 2026-07-02). The keyed entries are declared but disabled; they
 * flip to "unconfigured" in the health panel until you add a key,
 * so the UI always tells you exactly what is and isn't wired.
 *
 * This is the single place the rest of the system asks "what data
 * do we actually have?" — no source is used unless it lives here.
 */
export const SOURCES: SourceDef[] = [
  {
    id: "binance",
    name: "Binance (public)",
    category: "crypto",
    assets: ["BTCUSD", "ETHUSD"],
    url: "https://binance-docs.github.io/apidocs/spot/en/",
    requiresKey: false,
    note: "Keyless REST 24hr ticker. Best free crypto spot. ~1200 req/min budget.",
    pollMs: 5_000,
    enabled: true,
  },
  {
    id: "goldapi",
    name: "gold-api.com",
    category: "price",
    assets: ["XAUUSD"],
    url: "https://gold-api.com",
    requiresKey: false,
    note: "Keyless live gold spot (XAU/USD). Primary source for the primary asset.",
    pollMs: 15_000,
    enabled: true,
  },
  {
    id: "yahoo",
    name: "Yahoo Finance (public chart)",
    category: "price",
    // Covers everything else + gold FUTURES as a cross-check on spot.
    assets: ["XAUUSD", "SP500", "NASDAQ", "DXY", "US10Y", "XAGUSD", "WTIUSD", "EURUSD"],
    url: "https://finance.yahoo.com",
    requiresKey: false,
    note: "Keyless v8 spark batch (1 request/cycle via curl). Delayed ~real-time; stale on market close.",
    pollMs: 20_000,
    enabled: true,
  },

  {
    id: "fred",
    name: "FRED (St. Louis Fed)",
    category: "macro",
    assets: [],
    url: "https://fred.stlouisfed.org",
    requiresKey: false, // keyless via the fredgraph.csv export
    keyEnv: "FRED_API_KEY",
    note: "Keyless CSV: real yields, CPI, fed funds, USD, balance sheet. Drives the gold macro bias.",
    pollMs: 1_800_000, // 30 min — FRED series update at most daily
    enabled: true,
  },
  {
    id: "rss",
    name: "News RSS (Fed · ECB · MarketWatch · FXStreet · Cointelegraph)",
    category: "news",
    assets: [],
    url: "https://www.federalreserve.gov/feeds/press_all.xml",
    requiresKey: false,
    note: "Keyless multi-feed aggregation, scored by the transparent heuristic engine.",
    pollMs: 120_000, // 2 min
    enabled: true,
  },

  {
    id: "candles_binance",
    name: "Binance klines (OHLC)",
    category: "crypto",
    assets: ["BTCUSD", "ETHUSD"],
    url: "https://binance-docs.github.io/apidocs/spot/en/",
    requiresKey: false,
    note: "Keyless OHLC candles (H1/D1) — feeds the SMC/ICT engine.",
    pollMs: 300_000, // 5 min
    enabled: true,
  },
  {
    id: "candles_yahoo",
    name: "Yahoo OHLC candles",
    category: "price",
    assets: ["XAUUSD", "XAGUSD", "DXY", "SP500", "NASDAQ", "EURUSD", "WTIUSD", "US10Y"],
    url: "https://finance.yahoo.com",
    requiresKey: false,
    note: "Keyless OHLC via curl for XAUUSD + others — feeds the SMC/ICT engine.",
    pollMs: 300_000, // 5 min
    enabled: true,
  },

  {
    id: "binance_futures",
    name: "Binance Futures (derivatives)",
    category: "onchain",
    assets: ["BTCUSD"],
    url: "https://binance-docs.github.io/apidocs/futures/en/",
    requiresKey: false,
    note: "Keyless: funding, open interest, long/short & taker ratios — BTC engine.",
    pollMs: 60_000,
    enabled: true,
  },

  // ---- Declared but not yet wired (light up when keyed) ----
  {
    id: "twelvedata",
    name: "Twelve Data",
    category: "price",
    assets: ["XAUUSD", "XAGUSD", "EURUSD"],
    url: "https://twelvedata.com",
    requiresKey: true,
    keyEnv: "TWELVEDATA_API_KEY",
    note: "Free 800 req/day. Cleaner XAUUSD spot + intraday candles. Module 3 upgrade.",
    pollMs: 60_000,
    enabled: false,
  },
  {
    id: "finnhub",
    name: "Finnhub",
    category: "news",
    assets: [],
    url: "https://finnhub.io",
    requiresKey: true,
    keyEnv: "FINNHUB_API_KEY",
    note: "Free tier: market news + economic calendar. Powers Module 2 (News Engine).",
    pollMs: 60_000,
    enabled: false,
  },
  {
    id: "coinglass",
    name: "Coinglass",
    category: "onchain",
    assets: ["BTCUSD", "ETHUSD"],
    url: "https://coinglass.com",
    requiresKey: true,
    keyEnv: "COINGLASS_API_KEY",
    note: "Funding, open interest, liquidation maps. Powers Module 5 (BTC engine).",
    pollMs: 30_000,
    enabled: false,
  },
];

export const ENABLED_SOURCES = () => SOURCES.filter((s) => s.enabled);
export const SOURCE_BY_ID = Object.fromEntries(SOURCES.map((s) => [s.id, s]));
