import type { Candle, LiquidityPool, SwingPoint } from "@/core/smc";

/** Group swing points whose prices sit within a relative tolerance. */
function clusterByPrice(points: SwingPoint[], tolPct: number): SwingPoint[][] {
  const sorted = [...points].sort((a, b) => a.price - b.price);
  const clusters: SwingPoint[][] = [];
  let cur: SwingPoint[] = [];
  for (const p of sorted) {
    if (cur.length === 0) cur = [p];
    else {
      const ref = cur[cur.length - 1].price;
      if (Math.abs(p.price - ref) / ref <= tolPct) cur.push(p);
      else {
        clusters.push(cur);
        cur = [p];
      }
    }
  }
  if (cur.length) clusters.push(cur);
  return clusters;
}

/**
 * Liquidity pools = resting stops. Equal highs stack BUY-side liquidity
 * above them; equal lows stack SELL-side below. We also surface the
 * clean range extremes as the primary draw-on-liquidity targets.
 */
export function detectLiquidity(
  candles: Candle[],
  swings: SwingPoint[],
  tolPct = 0.0009,
): LiquidityPool[] {
  const price = candles[candles.length - 1].close;
  const pools: LiquidityPool[] = [];

  const addClusters = (kind: "buyside" | "sellside", pts: SwingPoint[]) => {
    for (const cl of clusterByPrice(pts, tolPct)) {
      if (cl.length < 2) continue;
      const poolPrice = cl.reduce((s, p) => s + p.price, 0) / cl.length;
      const lastTs = Math.max(...cl.map((p) => p.ts));
      const taken =
        kind === "buyside"
          ? candles.some((c) => c.ts > lastTs && c.high > poolPrice * (1 + tolPct))
          : candles.some((c) => c.ts > lastTs && c.low < poolPrice * (1 - tolPct));
      pools.push({
        kind,
        price: poolPrice,
        ts: lastTs,
        label: `Equal ${kind === "buyside" ? "highs" : "lows"} (x${cl.length})`,
        taken,
      });
    }
  };

  addClusters("buyside", swings.filter((s) => s.kind === "high"));
  addClusters("sellside", swings.filter((s) => s.kind === "low"));

  // Nearest untaken pools on each side of price first.
  return pools
    .sort((a, b) => Math.abs(a.price - price) - Math.abs(b.price - price))
    .slice(0, 8);
}
