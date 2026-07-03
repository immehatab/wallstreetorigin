import type { Candle, SwingPoint } from "@/core/smc";

/**
 * Fractal swing detection. A swing HIGH is a candle whose high is the
 * strict max of a window of `strength` candles on each side; swing LOW
 * symmetric. This is the standard ICT/price-action definition and the
 * foundation every downstream structure read depends on.
 */
export function detectSwings(candles: Candle[], strength = 2): SwingPoint[] {
  const swings: SwingPoint[] = [];
  for (let i = strength; i < candles.length - strength; i++) {
    const c = candles[i];
    let isHigh = true;
    let isLow = true;
    for (let j = i - strength; j <= i + strength; j++) {
      if (j === i) continue;
      if (candles[j].high >= c.high) isHigh = false;
      if (candles[j].low <= c.low) isLow = false;
    }
    if (isHigh) swings.push({ index: i, ts: c.ts, price: c.high, kind: "high" });
    if (isLow) swings.push({ index: i, ts: c.ts, price: c.low, kind: "low" });
  }
  return swings;
}

/** Most recent confirmed swing of each kind. */
export function lastSwings(swings: SwingPoint[]): {
  high: SwingPoint | null;
  low: SwingPoint | null;
} {
  let high: SwingPoint | null = null;
  let low: SwingPoint | null = null;
  for (const s of swings) {
    if (s.kind === "high") high = s;
    else low = s;
  }
  return { high, low };
}
