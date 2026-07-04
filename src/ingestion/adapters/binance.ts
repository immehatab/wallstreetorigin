import type { AssetId, Quote } from "@/core/types";
import { type Adapter, fetchJson, makeQuote } from "../adapter";

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

interface CoinGeckoResp {
  bitcoin?: { usd: number; usd_24h_change?: number };
  ethereum?: { usd: number; usd_24h_change?: number };
}

/** Fallback: CoinGecko is datacenter-friendly (Binance 451s cloud IPs). */
async function coingeckoQuotes(): Promise<Quote[]> {
  const url =
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true";
  const d = await fetchJson<CoinGeckoResp>(url, { timeoutMs: 8000 });
  const now = Date.now();
  const out: Quote[] = [];
  const push = (asset: AssetId, o?: { usd: number; usd_24h_change?: number }, sym = "") => {
    if (!o) return;
    out.push(
      makeQuote({
        asset,
        price: o.usd,
        changePct: o.usd_24h_change ?? null,
        currency: "USD",
        source: "coingecko",
        sourceSymbol: sym,
        ts: now,
      }),
    );
  };
  push("BTCUSD", d.bitcoin, "bitcoin");
  push("ETHUSD", d.ethereum, "ethereum");
  if (out.length === 0) throw new Error("coingecko: no prices");
  return out;
}

export const binanceAdapter: Adapter = {
  id: "binance",
  async poll(): Promise<Quote[]> {
    const symbols = Object.keys(MAP);
    const param = encodeURIComponent(JSON.stringify(symbols));
    const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${param}`;
    try {
      const data = await fetchJson<BinanceTicker[]>(url, { timeoutMs: 6000 });
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
      // Binance geo-blocks datacenter IPs (HTTP 451) — fall back to CoinGecko.
      return coingeckoQuotes();
    }
  },
};
