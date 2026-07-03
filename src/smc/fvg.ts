import type { Candle, FVG } from "@/core/smc";

/**
 * Fair Value Gaps (3-candle imbalance). A bullish FVG is a gap between
 * candle[i-1].high and candle[i+1].low (price ran up leaving an
 * unfilled void below = support). Bearish is the mirror. A gap is
 * "filled" once later price trades back through it.
 */
export function detectFVGs(candles: Candle[]): FVG[] {
  const fvgs: FVG[] = [];
  for (let i = 1; i < candles.length - 1; i++) {
    const a = candles[i - 1];
    const c = candles[i + 1];

    if (c.low > a.high) {
      const top = c.low;
      const bottom = a.high;
      let filled = false;
      for (let j = i + 2; j < candles.length; j++) {
        if (candles[j].low <= bottom) {
          filled = true;
          break;
        }
      }
      fvgs.push({ kind: "bullish", top, bottom, ts: candles[i].ts, filled });
    } else if (c.high < a.low) {
      const top = a.low;
      const bottom = c.high;
      let filled = false;
      for (let j = i + 2; j < candles.length; j++) {
        if (candles[j].high >= top) {
          filled = true;
          break;
        }
      }
      fvgs.push({ kind: "bearish", top, bottom, ts: candles[i].ts, filled });
    }
  }
  return fvgs;
}
