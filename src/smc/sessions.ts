import type { Candle, SessionInfo, Timeframe } from "@/core/smc";

/**
 * Trading sessions (UTC), ICT-simplified:
 *   Asian  00:00–08:00 · London 08:00–13:00 · New York 13:00–21:00
 * Session high/low are computed from the last ~24h of intraday candles.
 * Only meaningful intraday — on D1 we report the current session but
 * leave the ranges null (and the engine notes it in `missing`).
 */
function sessionOf(hourUtc: number): SessionInfo["current"] {
  if (hourUtc >= 0 && hourUtc < 8) return "asian";
  if (hourUtc >= 8 && hourUtc < 13) return "london";
  if (hourUtc >= 13 && hourUtc < 21) return "newyork";
  return "closed";
}

function rangeFor(candles: Candle[], from: number, to: number): [number | null, number | null] {
  let hi = -Infinity;
  let lo = Infinity;
  for (const c of candles) {
    const h = new Date(c.ts).getUTCHours();
    if (h >= from && h < to) {
      if (c.high > hi) hi = c.high;
      if (c.low < lo) lo = c.low;
    }
  }
  return hi === -Infinity ? [null, null] : [hi, lo];
}

export function sessionInfo(candles: Candle[], tf: Timeframe, now: number): SessionInfo {
  const current = sessionOf(new Date(now).getUTCHours());
  if (tf === "D1" || candles.length === 0) {
    return {
      current,
      asianHigh: null,
      asianLow: null,
      londonHigh: null,
      londonLow: null,
      nyHigh: null,
      nyLow: null,
    };
  }
  // Last ~28h of intraday candles.
  const recent = candles.filter((c) => now - c.ts <= 28 * 3600_000);
  const [aH, aL] = rangeFor(recent, 0, 8);
  const [lH, lL] = rangeFor(recent, 8, 13);
  const [nH, nL] = rangeFor(recent, 13, 21);
  return {
    current,
    asianHigh: aH,
    asianLow: aL,
    londonHigh: lH,
    londonLow: lL,
    nyHigh: nH,
    nyLow: nL,
  };
}
