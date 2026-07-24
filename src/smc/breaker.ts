import type { Candle, OrderBlock } from "@/core/smc";

export interface BreakerBlock {
  kind: "bullish" | "bearish";
  top: number;
  bottom: number;
  ts: number; // when it became a breaker
  mitigated: boolean;
  origin: {
    top: number;
    bottom: number;
    ts: number;
  };
}

export function detectBreakerBlocks(
  candles: Candle[],
  orderBlocks: OrderBlock[]
): BreakerBlock[] {
  if (candles.length === 0 || orderBlocks.length === 0) return [];

  const breakerBlocks: BreakerBlock[] = [];
  const lastPrice = candles[candles.length - 1].close;
  const lastTimestamp = candles[candles.length - 1].ts;

  for (const ob of orderBlocks) {
    // Only consider mitigated OBs for breaker status
    if (!ob.mitigated) continue;

    let isBreaker = false;
    let breakerTime = 0;

    if (ob.kind === "bullish") {
      // For bullish OB to become bearish breaker:
      // Price must have broken below the OB (swept the low) and then respected it as resistance
      const brokeBelow = candles.some(c => c.low < ob.bottom);
      
      if (brokeBelow) {
        // Find when it broke below (first close below OB)
        const breakIndex = candles.findIndex(c => c.close < ob.bottom);
        if (breakIndex !== -1) {
          // Check if price has since returned to and respected the OB area as resistance
          const afterBreak = candles.slice(breakIndex + 1);
          const respectedAsResistance = afterBreak.some(c => 
            c.high >= ob.bottom && c.high <= ob.top && c.close < ob.bottom
          );
          
          if (respectedAsResistance) {
            isBreaker = true;
            breakerTime = candles[breakIndex].ts;
          }
        }
      }
    } else if (ob.kind === "bearish") {
      // For bearish OB to become bullish breaker:
      // Price must have broken above the OB (swept the high) and then respected it as support
      const brokeAbove = candles.some(c => c.high > ob.top);
      
      if (brokeAbove) {
        // Find when it broke above (first close above OB)
        const breakIndex = candles.findIndex(c => c.close > ob.top);
        if (breakIndex !== -1) {
          // Check if price has since returned to and respected the OB area as support
          const afterBreak = candles.slice(breakIndex + 1);
          const respectedAsSupport = afterBreak.some(c => 
            c.low <= ob.top && c.low >= ob.bottom && c.close > ob.top
          );
          
          if (respectedAsSupport) {
            isBreaker = true;
            breakerTime = candles[breakIndex].ts;
          }
        }
      }
    }

    if (isBreaker) {
      // Check if this breaker has been mitigated (price returned to it)
      let mitigated = false;
      if (breakerTime > 0) {
        const breakerIndex = candles.findIndex(c => c.ts === breakerTime);
        if (breakerIndex !== -1) {
          const afterBreaker = candles.slice(breakerIndex + 1);
          
          if (ob.kind === "bullish") {
            // Bearish breaker: price came back down to it
            mitigated = afterBreaker.some(c => c.low <= ob.top && c.low >= ob.bottom);
          } else {
            // Bullish breaker: price came back up to it
            mitigated = afterBreaker.some(c => c.high >= ob.bottom && c.high <= ob.top);
          }
        }
      }

      breakerBlocks.push({
        kind: ob.kind === "bullish" ? "bearish" : "bullish",
        top: ob.top,
        bottom: ob.bottom,
        ts: breakerTime > 0 ? breakerTime : lastTimestamp,
        mitigated,
        origin: { top: ob.top, bottom: ob.bottom, ts: ob.ts }
      });
    }
  }

  return breakerBlocks;
}
