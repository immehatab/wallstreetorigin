import type { AssetId } from "@/core/types";
import type { Candle, Timeframe } from "@/core/smc";
import { curlJson, fetchJson } from "./adapter";
import { writeCandles } from "@/store/candleRepo";

// ============================================================
//  Candle ingestion for the SMC engine.
//  Crypto  -> Binance klines (native fetch, deep history, keyless)
//  Others  -> Yahoo chart OHLC (curl — Yahoo blocks undici)
//  Timeframes: H1 + D1 (engine is TF-agnostic; H4 trivial to add).
// ============================================================

const TIMEFRAMES: Timeframe[] = ["H1", "D1"];

const BINANCE_ASSETS: Array<{ asset: AssetId; symbol: string }> = [
  { asset: "BTCUSD", symbol: "BTCUSDT" },
  { asset: "ETHUSD", symbol: "ETHUSDT" },
];

// XAUUSD FIRST — the primary asset gets first claim on Yahoo's throttled
// quota. Others are best-effort behind it.
const YAHOO_ASSETS: Array<{ asset: AssetId; symbol: string }> = [
  { asset: "XAUUSD", symbol: "GC=F" },
  { asset: "DXY", symbol: "DX-Y.NYB" },
  { asset: "SP500", symbol: "^GSPC" },
  { asset: "NASDAQ", symbol: "^IXIC" },
  { asset: "EURUSD", symbol: "EURUSD=X" },
  { asset: "XAGUSD", symbol: "SI=F" },
  { asset: "WTIUSD", symbol: "CL=F" },
];

const BINANCE_INTERVAL: Record<Timeframe, { interval: string; limit: number }> = {
  H1: { interval: "1h", limit: 400 },
  H4: { interval: "4h", limit: 400 },
  D1: { interval: "1d", limit: 365 },
};

const YAHOO_PARAMS: Record<Timeframe, { interval: string; range: string }> = {
  H1: { interval: "60m", range: "1mo" },
  H4: { interval: "60m", range: "3mo" }, // aggregated client-side if needed
  D1: { interval: "1d", range: "1y" },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------- Binance klines ----------------

type Kline = [number, string, string, string, string, string, ...unknown[]];

async function fetchBinance(symbol: string, tf: Timeframe): Promise<Candle[]> {
  const { interval, limit } = BINANCE_INTERVAL[tf];
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const data = await fetchJson<Kline[]>(url, { timeoutMs: 8000 });
  return data.map((k) => ({
    ts: k[0],
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
  }));
}

// ---------------- Yahoo chart OHLC ----------------

interface YahooChart {
  chart: {
    result: Array<{
      timestamp?: number[];
      indicators: {
        quote: Array<{
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }> | null;
  };
}

async function fetchYahooOnce(symbol: string, tf: Timeframe): Promise<Candle[]> {
  const { interval, range } = YAHOO_PARAMS[tf];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?interval=${interval}&range=${range}`;
  const data = await curlJson<YahooChart>(url, { timeoutMs: 9000 });
  const r = data.chart.result?.[0];
  if (!r?.timestamp || !r.indicators?.quote?.[0]) return [];
  const q = r.indicators.quote[0];
  const out: Candle[] = [];
  for (let i = 0; i < r.timestamp.length; i++) {
    const o = q.open?.[i];
    const h = q.high?.[i];
    const l = q.low?.[i];
    const c = q.close?.[i];
    if (o == null || h == null || l == null || c == null) continue; // skip gaps
    out.push({
      ts: r.timestamp[i] * 1000,
      open: o,
      high: h,
      low: l,
      close: c,
      volume: q.volume?.[i] ?? 0,
    });
  }
  return out;
}

/** Retry Yahoo chart on transient 429s (spaced, to let the throttle ease). */
async function fetchYahoo(symbol: string, tf: Timeframe): Promise<Candle[]> {
  const gaps = [2500, 5000];
  let err: unknown;
  for (let i = 0; i <= gaps.length; i++) {
    try {
      return await fetchYahooOnce(symbol, tf);
    } catch (e) {
      err = e;
      if (i < gaps.length) await sleep(gaps[i]);
    }
  }
  throw err;
}

// ---------------- jobs ----------------

/** Crypto candles. Parallel is safe here — Binance is generous. */
export async function runBinanceCandlesJob(): Promise<number> {
  let total = 0;
  const tasks = BINANCE_ASSETS.flatMap((a) =>
    TIMEFRAMES.map(async (tf) => {
      const candles = await fetchBinance(a.symbol, tf);
      if (candles.length) total += writeCandles(a.asset, tf, "binance", candles);
    }),
  );
  const settled = await Promise.allSettled(tasks);
  if (total === 0) {
    const err = settled.find((s) => s.status === "rejected") as PromiseRejectedResult | undefined;
    throw new Error(`binance klines: no candles (${err?.reason ?? "unknown"})`);
  }
  return total;
}

/** Yahoo candles — SEQUENTIAL with spacing (Yahoo throttles bursts). */
export async function runYahooCandlesJob(): Promise<number> {
  let total = 0;
  let lastErr: unknown = null;
  for (const a of YAHOO_ASSETS) {
    for (const tf of TIMEFRAMES) {
      try {
        const candles = await fetchYahoo(a.symbol, tf);
        if (candles.length) total += writeCandles(a.asset, tf, "yahoo", candles);
      } catch (e) {
        lastErr = e;
      }
      await sleep(200);
    }
  }
  if (total === 0) throw new Error(`yahoo candles: none fetched (${lastErr})`);
  return total;
}
