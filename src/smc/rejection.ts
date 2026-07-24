import type { Candle, OrderBlock } from "@/core/smc";

export interface RejectionBlock {
  kind: "bullish" | "bearish";
  top: number;
  bottom: number;
  ts: number; // when the rejection occurred
  mitigated: boolean; // price has since mitigated the rejection level
  origin: {
    top: number;
    bottom: number;
    ts: number;
  }; // original OB that was respected
}

export function detectRejectionBlocks(
  candles: Candle[],
  orderBlocks: OrderBlock[]
): RejectionBlock[] {
  if (candles.length === 0 || orderBlocks.length === 0) return [];

  const rejectionBlocks: RejectionBlock[] = [];
  const lastPrice = candles[candles.length - 1].close;
  const lastTimestamp = candles[candles.length - 1].ts;

  for (const ob of orderBlocks) {
    // Only consider unmitigated OBs for rejection testing
    if (ob.mitigated) continue;

    let isRejection = false;
    let rejectionTime = 0;

    if (ob.kind === "bullish") {
      // For bullish OB, look for rejection from below (price touches or goes slightly below but closes back up)
      let touchIndex = -1;
      for (let i = candles.length - 1; i >= 0; i--) {
        const c = candles[i];
        if (c.low <= ob.bottom * 1.001 && c.close >= ob.bottom) {
          touchIndex = i;
          break;
        }
      }
      
      if (touchIndex !== -1) {
        // Check if price respected it as support afterwards (continued up)
        let continuedUp = false;
        for (let i = touchIndex + 1; i < candles.length; i++) {
          if (candles[i].close > ob.top) {
            continuedUp = true;
            break;
          }
        }
        
        if (continuedUp) {
          isRejection = true;
          rejectionTime = candles[touchIndex].ts;
        }
      }
    } else if (ob.kind === "bearish") {
      // For bearish OB, look for rejection from above (price touches or goes slightly above but closes back down)
      let touchIndex = -1;
      for (let i = candles.length - 1; i >= 0; i--) {
        const c = candles[i];
        if (c.high >= ob.top * 0.999 && c.close <= ob.top) {
          touchIndex = i;
          break;
        }
      }
      
      if (touchIndex !== -1) {
        // Check if price respected it as resistance afterwards (continued down)
        let continuedDown = false;
        for (let i = touchIndex + 1; i < candles.length; i++) {
          if (candles[i].close < ob.bottom) {
            continuedDown = true;
            break;
          }
        }
        
        if (continuedDown) {
          isRejection = true;
          rejectionTime = candles[touchIndex].ts;
        }
      }
    }

    if (isRejection) {
      // Check if this rejection level has been mitigated (price went through it)
      let mitigated = false;
      if (rejectionTime > 0) {
        let rejectionIndex = -1;
        for (let i = 0; i < candles.length; i++) {
          if (candles[i].ts === rejectionTime) {
            rejectionIndex = i;
            break;
          }
        }
        
        if (rejectionIndex !== -1) {
          const afterRejection = candles.slice(rejectionIndex + 1);
          
          if (ob.kind === "bullish") {
            // Bullish OB rejection: mitigated if price went significantly below
            for (const c of afterRejection) {
              if (c.close < ob.bottom * 0.99) { // 1% below
                mitigated = true;
                break;
              }
            }
          } else {
            // Bearish OB rejection: mitigated if price went significantly above
            for (const c of afterRejection) {
              if (c.close > ob.top * 1.01) { // 1% above
                mitigated = true;
                break;
              }
            }
          }
        }
      }

      rejectionBlocks.push({
        kind: ob.kind,
        top: ob.top,
        bottom: ob.bottom,
        ts: rejectionTime > 0 ? rejectionTime : lastTimestamp,
        mitigated,
        origin: { top: ob.top, bottom: ob.bottom, ts: ob.ts }
      });
    }
  }

  return rejectionBlocks;
}
