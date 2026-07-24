import type { AssetId, Quote } from "@/core/types";
import { type Adapter, fetchJson, makeQuote, retryFn } from "../adapter";

/** Binance symbol -> our asset id. */
const MAP: Record<string, AssetId> = {
  BTCUSDT: "BTCUSD",
  ETHUSDT: "ETHUSD",
};

interface BinanceTicker {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  bidPrice: string;
  askPrice: string;
  closeTime: number;
}

interface CbStats {
  open: string;
  last: string;
}

/** Fallback: Coinbase is datacenter-friendly (Binance 451s cloud IPs;
 *  CoinGecko 429s shared IPs). One /stats call per product = price + 24h. */
async function coinbaseQuotes(): Promise<Quote[]> {
  const products: Array<{ asset: AssetId; product: string }> = [
    { asset: "BTCUSD", product: "BTC-USD" },
    { asset: "ETHUSD", product: "ETH-USD" },
  ];
  const now = Date.now();
  const settled = await Promise.allSettled(
    products.map(async ({ asset, product }) => {
      const s = await retryFn(() =>
        fetchJson<CbStats>(
          `https://api.exchange.coinbase.com/products/${product}/stats`,
          { timeoutMs: 8000 }
        )
      );
      const price = Number(s.last);
      const open = Number(s.open);
      return makeQuote({
        asset,
        price,
        changePct: open > 0 ? ((price - open) / open) * 100 : null,
        currency: "USD",
        source: "coinbase",
        sourceSymbol: product,
        ts: now,
      });
    }),
  );
  const out = settled
    .filter((r): r is PromiseFulfilledResult<Quote> => r.status === "fulfilled")
    .map((r) => r.value);
  if (out.length === 0) throw new Error("coinbase: no prices");
  return out;
}

export const binanceAdapter: Adapter = {
  id: "binance",
  async poll(): Promise<Quote[]> {
    const symbols = Object.keys(MAP);
    const param = encodeURIComponent(JSON.stringify(symbols));
    const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${param}`;
    try {
      const data = await retryFn(() =>
        fetchJson<BinanceTicker[]>(url, { timeoutMs: 6000 })
      );
      return data
        .filter((t) => MAP[t.symbol])
        .map((t) =>
          makeQuote({
            asset: MAP[t.symbol],
            price: Number(t.lastPrice),
            changePct: Number(t.priceChangePercent),
            bid: Number(t.bidPrice),
            ask: Number(t.askPrice),
            currency: "USD",
            source: "binance",
            sourceSymbol: t.symbol,
            ts: t.closeTime,
          }),
        );
    } catch {
      // Binance geo-blocks datacenter IPs (HTTP 451) — fall back to Coinbase.
      return coinbaseQuotes();
    }
  },
};
