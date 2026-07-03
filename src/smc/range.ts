import type { Candle, DealingRange } from "@/core/smc";

/**
 * Premium / Discount via the current dealing range. Take the extreme
 * high and low over a recent window; the midpoint is equilibrium.
 * Above ~55% of the range = premium (institutions look to SELL);
 * below ~45% = discount (look to BUY); the band around 50% is
 * equilibrium. This is the ICT premium/discount framework.
 */
export function dealingRange(candles: Candle[], lookback = 60): DealingRange {
  const window = candles.slice(-lookback);
  let high = -Infinity;
  let low = Infinity;
  for (const c of window) {
    if (c.high > high) high = c.high;
    if (c.low < low) low = c.low;
  }
  const equilibrium = (high + low) / 2;
  const price = candles[candles.length - 1].close;
  const positionPct = high > low ? (price - low) / (high - low) : 0.5;
  const zone =
    positionPct > 0.55 ? "premium" : positionPct < 0.45 ? "discount" : "equilibrium";
  return { high, low, equilibrium, positionPct, zone };
}
