import type { Candle, Direction, StructureEvent, SwingPoint } from "@/core/smc";

interface Ref {
  price: number;
  index: number;
  ts: number;
}

/**
 * Market-structure read producing BOS and CHOCH events.
 *
 * - A close beyond the most-recent protected swing is a STRUCTURE BREAK.
 * - If the break CONTINUES the prevailing bias  -> BOS (Break of Structure).
 * - If the break REVERSES the prevailing bias   -> CHOCH (Change of Character).
 *
 * Swings are only "known" `strength` candles after they print, so the
 * walk is causal — no lookahead into the future to fake a signal.
 */
export function analyzeStructure(
  candles: Candle[],
  swings: SwingPoint[],
  strength = 2,
): {
  state: Direction | "neutral";
  lastBOS: StructureEvent | null;
  lastCHOCH: StructureEvent | null;
  events: StructureEvent[];
} {
  const events: StructureEvent[] = [];
  let bias: Direction | "neutral" = "neutral";
  let refHigh: Ref | null = null;
  let refLow: Ref | null = null;

  const known = swings
    .map((s) => ({ ...s, knownAt: s.index + strength }))
    .sort((a, b) => a.knownAt - b.knownAt);
  let ki = 0;

  for (let t = 0; t < candles.length; t++) {
    while (ki < known.length && known[ki].knownAt <= t) {
      const s = known[ki++];
      if (s.kind === "high") {
        if (!refHigh || s.index > refHigh.index)
          refHigh = { price: s.price, index: s.index, ts: s.ts };
      } else if (!refLow || s.index > refLow.index) {
        refLow = { price: s.price, index: s.index, ts: s.ts };
      }
    }

    const close = candles[t].close;
    if (refHigh && close > refHigh.price) {
      const type = bias === "bearish" ? "CHOCH" : "BOS";
      events.push({
        type,
        direction: "bullish",
        ts: candles[t].ts,
        price: close,
        brokenLevel: refHigh.price,
      });
      bias = "bullish";
      refHigh = null; // consumed — wait for a fresh swing high to form
    } else if (refLow && close < refLow.price) {
      const type = bias === "bullish" ? "CHOCH" : "BOS";
      events.push({
        type,
        direction: "bearish",
        ts: candles[t].ts,
        price: close,
        brokenLevel: refLow.price,
      });
      bias = "bearish";
      refLow = null;
    }
  }

  const lastBOS = [...events].reverse().find((e) => e.type === "BOS") ?? null;
  const lastCHOCH = [...events].reverse().find((e) => e.type === "CHOCH") ?? null;

  return { state: bias, lastBOS, lastCHOCH, events: events.slice(-12) };
}
