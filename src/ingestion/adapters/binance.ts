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

export const binanceAdapter: Adapter = {
  id: "binance",
  async poll(): Promise<Quote[]> {
    const symbols = Object.keys(MAP);
    const param = encodeURIComponent(JSON.stringify(symbols));
    const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${param}`;
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
  },
};
