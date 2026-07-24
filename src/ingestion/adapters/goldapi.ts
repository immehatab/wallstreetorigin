import type { Quote } from "@/core/types";
import { type Adapter, fetchJson, makeQuote, retryFn } from "../adapter";

interface GoldApiResp {
  price: number;
  currency: string;
  symbol: string;
  updatedAt: string; // ISO
}

/**
 * gold-api.com — keyless live gold spot. This is the PRIMARY source
 * for the terminal's PRIMARY asset, so it gets its own adapter and a
 * tight-ish poll. It does not expose a change%, so we leave changePct
 * null (honest) — a later module backfills it from our own tick log.
 */
export const goldApiAdapter: Adapter = {
  id: "goldapi",
  async poll(): Promise<Quote[]> {
    const data = await retryFn(() =>
      fetchJson<GoldApiResp>("https://api.gold-api.com/price/XAU", {
        timeoutMs: 6000,
      })
    );
    const ts = Date.parse(data.updatedAt);
    return [
      makeQuote({
        asset: "XAUUSD",
        price: data.price,
        changePct: null,
        currency: data.currency || "USD",
        source: "goldapi",
        sourceSymbol: data.symbol || "XAU",
        ts: Number.isFinite(ts) ? ts : Date.now(),
      }),
    ];
  },
};
