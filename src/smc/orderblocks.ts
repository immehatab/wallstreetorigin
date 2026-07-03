import type { Candle, OrderBlock, StructureEvent } from "@/core/smc";

/**
 * Order Blocks: the last opposing candle before an impulsive move that
 * broke structure. A bullish OB is the last DOWN candle before a
 * structure break UP (institutional demand); bearish is the mirror.
 * "Mitigated" = price has since returned into the block.
 */
export function detectOrderBlocks(
  candles: Candle[],
  events: StructureEvent[],
  lookback = 10,
): OrderBlock[] {
  const idxByTs = new Map<number, number>();
  candles.forEach((c, i) => idxByTs.set(c.ts, i));

  const blocks: OrderBlock[] = [];
  for (const e of events) {
    const bi = idxByTs.get(e.ts);
    if (bi == null) continue;
    const wantDown = e.direction === "bullish"; // bullish break -> find last down candle

    for (let k = bi - 1; k >= Math.max(0, bi - lookback); k--) {
      const c = candles[k];
      const isDown = c.close < c.open;
      if (wantDown === isDown) {
        const top = c.high;
        const bottom = c.low;
        let mitigated = false;
        for (let j = bi + 1; j < candles.length; j++) {
          if (e.direction === "bullish" && candles[j].low <= top) {
            mitigated = true;
            break;
          }
          if (e.direction === "bearish" && candles[j].high >= bottom) {
            mitigated = true;
            break;
          }
        }
        blocks.push({ kind: e.direction, top, bottom, ts: c.ts, mitigated });
        break;
      }
    }
  }
  return blocks;
}
