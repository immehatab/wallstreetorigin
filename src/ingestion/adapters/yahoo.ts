import type { AssetId, Quote } from "@/core/types";
import { type Adapter, curlJson, makeQuote } from "../adapter";

/**
 * Our asset -> Yahoo symbol. XAUUSD maps to gold FUTURES (GC=F) as a
 * secondary cross-check; gold-api provides primary spot. All symbols
 * verified live on 2026-07-02.
 */
const MAP: Array<{ asset: AssetId; symbol: string }> = [
  { asset: "XAUUSD", symbol: "GC=F" },
  { asset: "SP500", symbol: "^GSPC" },
  { asset: "NASDAQ", symbol: "^IXIC" },
  { asset: "DXY", symbol: "DX-Y.NYB" },
  { asset: "US10Y", symbol: "^TNX" },
  { asset: "XAGUSD", symbol: "SI=F" },
  { asset: "WTIUSD", symbol: "CL=F" },
  { asset: "EURUSD", symbol: "EURUSD=X" },
];

const SYMBOL_TO_ASSET: Record<string, AssetId> = Object.fromEntries(
  MAP.map((m) => [m.symbol, m.asset]),
);

/**
 * Yahoo "spark" response: a flat object keyed by symbol. One request
 * returns ALL symbols — critical, because Yahoo aggressively 429s a
 * burst of per-symbol requests over Node's pooled connection. Batching
 * to a single call keeps us well under the throttle.
 */
interface SparkEntry {
  symbol: string;
  close: (number | null)[];
  timestamp: (number | null)[];
  previousClose: number | null;
  chartPreviousClose: number | null;
}
type SparkResponse = Record<string, SparkEntry>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry a thunk with fixed spacing — Yahoo throttles ~1 in 4 requests. */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3, gapMs = 2500): Promise<T> {
  let err: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      err = e;
      if (i < attempts - 1) await sleep(gapMs);
    }
  }
  throw err;
}

function lastFinite(arr: (number | null)[]): { value: number; index: number } | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    const v = arr[i];
    if (typeof v === "number" && Number.isFinite(v)) return { value: v, index: i };
  }
  return null;
}

export const yahooAdapter: Adapter = {
  id: "yahoo",
  async poll(): Promise<Quote[]> {
    const symbols = MAP.map((m) => m.symbol);
    const enc = encodeURIComponent(symbols.join(","));
    const url = `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${enc}&range=1d&interval=5m`;

    // Via curl, not fetch: Yahoo 429s undici's TLS fingerprint. See curlJson.
    // Yahoo also 429s intermittently even from curl, so retry with spacing.
    const data = await withRetry(
      () => curlJson<SparkResponse>(url, { timeoutMs: 9000 }),
      2,
      4000,
    );

    const quotes: Quote[] = [];
    for (const symbol of symbols) {
      const entry = data[symbol];
      if (!entry || !Array.isArray(entry.close)) continue;

      const last = lastFinite(entry.close);
      if (!last) continue;

      const price = last.value;
      const prev = entry.chartPreviousClose ?? entry.previousClose;
      const changePct =
        typeof prev === "number" && prev !== 0 ? ((price - prev) / prev) * 100 : null;

      const tsSec = entry.timestamp?.[last.index] ?? entry.timestamp?.at(-1) ?? null;
      const ts = typeof tsSec === "number" ? tsSec * 1000 : Date.now();

      quotes.push(
        makeQuote({
          asset: SYMBOL_TO_ASSET[symbol],
          price,
          changePct,
          currency: "USD",
          source: "yahoo",
          sourceSymbol: symbol,
          ts,
        }),
      );
    }

    if (quotes.length === 0) {
      throw new Error("yahoo: spark returned no usable symbols");
    }
    return quotes;
  },
};
