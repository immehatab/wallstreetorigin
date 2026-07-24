import type { AssetId } from "@/core/types";
import type { Candle, SmcAnalysis, SwingPoint, Timeframe, Trend, BreakerBlock, RejectionBlock } from "@/core/smc";
import { getCandles, candleSource } from "@/store/candleRepo";
import { detectSwings, lastSwings } from "./swings";
import { analyzeStructure } from "./structure";
import { detectFVGs } from "./fvg";
import { detectOrderBlocks } from "./orderblocks";
import { detectBreakerBlocks } from "./breaker";
import { detectRejectionBlocks } from "./rejection";
import { dealingRange } from "./range";
import { detectLiquidity } from "./liquidity";
import { sessionInfo } from "./sessions";

const MIN_CANDLES = 30;

function emptyAnalysis(
  asset: AssetId,
  tf: Timeframe,
  now: number,
  reason: string,
): SmcAnalysis {
  return {
    asset,
    timeframe: tf,
    generatedAt: now,
    candleCount: 0,
    source: "—",
    lastPrice: 0,
    lastCandleTs: 0,
    trend: "ranging",
    structure: { state: "neutral", lastBOS: null, lastCHOCH: null, events: [] },
    swings: [],
    fvgs: [],
    orderBlocks: [],
    breakerBlocks: [],
    rejectionBlocks: [],
    liquidity: [],
    range: { high: 0, low: 0, equilibrium: 0, positionPct: 0.5, zone: "equilibrium" },
    session: {
      current: "closed",
      asianHigh: null,
      asianLow: null,
      londonHigh: null,
      londonLow: null,
      nyHigh: null,
      nyLow: null,
    },
    narrative: [],
    bias: { direction: "ranging", confidence: 0, reasons: [] },
    missing: [reason],
  };
}

export function analyzeCandles(
  asset: AssetId,
  tf: Timeframe,
  candles: Candle[],
  source: string,
  now: number,
): SmcAnalysis {
  const swings = detectSwings(candles, 2);
  const structure = analyzeStructure(candles, swings, 2);
  const allFvgs = detectFVGs(candles);
  const orderBlocks = detectOrderBlocks(candles, structure.events, 10);
  const breakerBlocks = detectBreakerBlocks(candles, orderBlocks);
  const rejectionBlocks = detectRejectionBlocks(candles, orderBlocks);
  const range = dealingRange(candles, Math.min(60, candles.length));
  const liquidity = detectLiquidity(candles, swings);
  const session = sessionInfo(candles, tf, now);

  const last = candles[candles.length - 1];
  const lastPrice = last.close;

  // Recent, still-relevant FVGs: unfilled, newest first, capped.
  const fvgs = allFvgs
    .filter((f) => !f.filled)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 8);
  const activeOBs = orderBlocks.filter((o) => !o.mitigated).slice(-6);
  const activeBreakers = breakerBlocks.filter((b) => !b.mitigated).slice(-6);
  const activeRejections = rejectionBlocks.filter((r) => !r.mitigated).slice(-6);

  // Calculate Optimal Trade Entry (OTE) - ICT concept
  const { high: recentHigh, low: recentLow } = lastSwings(swings);
  const ote = calculateOTE(recentHigh, recentLow, structure.state);

  // ---- Trend ----
  const trend: Trend = structure.state === "neutral" ? "ranging" : structure.state;

  // ---- Reasoning (built BEFORE the bias line, per the house rule) ----
  const narrative: string[] = [];
  const dp = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

  if (structure.lastBOS) {
    narrative.push(
      `Last BOS: ${structure.lastBOS.direction} — price broke ${dp(structure.lastBOS.brokenLevel)}, confirming ${structure.lastBOS.direction} intent.`,
    );
  }
  if (structure.lastCHOCH) {
    narrative.push(
      `Last CHOCH: ${structure.lastCHOCH.direction} at ${dp(structure.lastCHOCH.brokenLevel)} — the most recent character change.`,
    );
  }
  narrative.push(
    `Dealing range ${dp(range.low)}–${dp(range.high)}; price at ${(range.positionPct * 100).toFixed(0)}% → ${range.zone.toUpperCase()}.`,
  );
  const draws = liquidity.filter((l) => !l.taken).slice(0, 3);
  if (draws.length) {
    narrative.push(
      `Liquidity draws: ${draws.map((l) => `${l.label} @ ${dp(l.price)}`).join(", ")}.`,
    );
  }
  narrative.push(
    `${fvgs.length} unfilled FVG(s), ${activeOBs.length} unmitigated order block(s), ${activeBreakers.length} untouched breaker block(s), ${activeRejections.length} active rejection block(s) in view.`,
  );
  if (session.current !== "closed") {
    narrative.push(`Active session: ${session.current.toUpperCase()}.`);
  }
  if (ote) {
    const { low, high, range: oteRange } = ote;
    narrative.push(
      `OTE (Optimal Trade Entry): ${dp(low)}–${dp(high)} (${oteRange}% retracement zone).`,
    );
  }

  // ---- Final bias with transparent confidence ----
  const reasons: string[] = [];
  let confidence = 50;

  if (trend === "bullish" || trend === "bearish") {
    reasons.push(`Market structure is ${trend} (${structure.state}).`);
    confidence += 12;
  } else {
    reasons.push("No decisive structure — treat as ranging.");
    confidence -= 5;
  }

  // Premium/discount alignment.
  if (trend === "bullish" && range.zone === "discount") {
    reasons.push("Bullish structure in DISCOUNT — high-quality longs.");
    confidence += 16;
  } else if (trend === "bearish" && range.zone === "premium") {
    reasons.push("Bearish structure in PREMIUM — high-quality shorts.");
    confidence += 16;
  } else if (trend === "bullish" && range.zone === "premium") {
    reasons.push("Bullish but in PREMIUM — extended; wait for a discount pullback.");
    confidence -= 10;
  } else if (trend === "bearish" && range.zone === "discount") {
    reasons.push("Bearish but in DISCOUNT — extended; wait for a premium retrace.");
    confidence -= 10;
  }

  // Continuation vs fresh reversal.
  const lastEvent = structure.events[structure.events.length - 1];
  if (lastEvent?.type === "BOS") {
    reasons.push("Latest break was a BOS (continuation).");
    confidence += 8;
  } else if (lastEvent?.type === "CHOCH") {
    reasons.push("Latest break was a CHOCH (reversal — less confirmed).");
    confidence += 2;
  }

  if (activeOBs.some((o) => o.kind === trend)) {
    reasons.push(`Unmitigated ${trend} order block available as entry.`);
    confidence += 6;
  }

  // Consider breaker blocks as confluence factors
  if (activeBreakers.some((b) => b.kind === trend)) {
    reasons.push(`Unmitigated ${trend} breaker block provides confluence.`);
    confidence += 4;
  }

  // Consider rejection blocks as confirmation
  if (activeRejections.some((r) => r.kind === trend)) {
    reasons.push(`Recent ${trend} rejection shows strong institutional interest.`);
    confidence += 5;
  }

  // OTE confluence bonus
  if (
    ote &&
    ((trend === "bullish" && lastPrice >= ote.low && lastPrice <= ote.high) ||
      (trend === "bearish" && lastPrice >= ote.low && lastPrice <= ote.high))
  ) {
    reasons.push("Price is within OTE zone — optimal entry area.");
    confidence += 5;
  }

  confidence = Math.max(35, Math.min(90, Math.round(confidence)));

  // ---- Missing / caveats ----
  const missing: string[] = [];
  if (candles.length < 60) {
    missing.push(`Only ${candles.length} candles — structure read is preliminary.`);
  }
  if (tf === "D1") missing.push("Session ranges are intraday-only (N/A on D1).");

  return {
    asset,
    timeframe: tf,
    generatedAt: now,
    candleCount: candles.length,
    source,
    lastPrice,
    lastCandleTs: last.ts,
    trend,
    structure,
    swings: swings.slice(-40),
    fvgs,
    orderBlocks: activeOBs,
    breakerBlocks: activeBreakers,
    rejectionBlocks: activeRejections,
    liquidity,
    range,
    session,
    narrative,
    bias: { direction: trend, confidence, reasons },
    missing,
    ...(ote && { ote }),
  };
}

/**
 * Calculate Optimal Trade Entry (OTE) zone - ICT concept
 * Returns the 62% to 79% Fibonacci retracement zone of the last swing
 */
function calculateOTE(
  high: SwingPoint | null,
  low: SwingPoint | null,
  structureState: "bullish" | "bearish" | "neutral"
): { low: number; high: number; range: number } | null {
  if (!high || !low) return null;

  const range = Math.abs(high.price - low.price);
  if (range === 0) return null;

  let fib62: number, fib79: number;

  if (structureState === "bullish") {
    // For bullish structure, OTE is retracement from low to high
    fib62 = low.price + range * 0.62;
    fib79 = low.price + range * 0.79;
  } else if (structureState === "bearish") {
    // For bearish structure, OTE is retracement from high to low
    fib62 = high.price - range * 0.62;
    fib79 = high.price - range * 0.79;
  } else {
    // Ranging - use last swing
    fib62 = low.price + range * 0.62;
    fib79 = low.price + range * 0.79;
  }

  // Ensure low < high
  const oteLow = Math.min(fib62, fib79);
  const oteHigh = Math.max(fib62, fib79);
  const oteRange = Math.abs(fib79 - fib62);

  return {
    low: oteLow,
    high: oteHigh,
    range: ((oteHigh - oteLow) / range) * 100,
  };
}

/** Read stored candles and analyze. */
export function analyzeSmc(asset: AssetId, tf: Timeframe, now: number): SmcAnalysis {
  const candles = getCandles(asset, tf, 400);
  if (candles.length < MIN_CANDLES) {
    return emptyAnalysis(
      asset,
      tf,
      now,
      candles.length === 0
        ? `No ${tf} candles ingested yet for ${asset}.`
        : `Insufficient ${tf} candles for ${asset} (${candles.length} < ${MIN_CANDLES}).`,
    );
  }
  return analyzeCandles(asset, tf, candles, candleSource(asset, tf) ?? "—", now);
}