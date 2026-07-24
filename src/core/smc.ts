import type { AssetId } from "./types";

// ============================================================
//  SMC / ICT ENGINE contracts.
//  Everything here is DERIVED from real candles. Each analysis
//  carries the candle count and a `missing` list so the UI can
//  say exactly what it could and couldn't compute.
// ============================================================

export type Timeframe = "H1" | "H4" | "D1";

export interface Candle {
  ts: number; // candle OPEN time, ms epoch
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Direction = "bullish" | "bearish";
export type Trend = "bullish" | "bearish" | "ranging";

export interface SwingPoint {
  index: number;
  ts: number;
  price: number;
  kind: "high" | "low";
}

export type StructureType = "BOS" | "CHOCH";

export interface StructureEvent {
  type: StructureType; // Break of Structure or Change of Character
  direction: Direction;
  ts: number; // when the break confirmed
  price: number; // close that broke the level
  brokenLevel: number; // the swing level that was taken
}

export interface FVG {
  kind: Direction; // bullish = gap below price (support), bearish = above (resistance)
  top: number;
  bottom: number;
  ts: number; // middle candle time
  filled: boolean;
}

export interface OrderBlock {
  kind: Direction;
  top: number;
  bottom: number;
  ts: number;
  mitigated: boolean; // price has returned into it
}

export interface BreakerBlock {
  kind: Direction; // opposite of original OB direction
  top: number;
  bottom: number;
  ts: number; // when the OB was broken
  mitigated: boolean; // price has returned into the breaker
  origin: {
    top: number;
    bottom: number;
    ts: number;
  }; // original OB that was broken
}

export interface RejectionBlock {
  kind: Direction; // same as original OB direction
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

export interface OtEdit {
  low: number;
  high: number;
  range: number;
}

export interface LiquidityPool {
  kind: "buyside" | "sellside"; // resting liquidity above highs / below lows
  price: number;
  ts: number;
  label: string; // e.g. "Equal highs (x3)"
  taken: boolean;
}

export interface DealingRange {
  high: number;
  low: number;
  equilibrium: number;
  /** 0..1 position of current price within the range. */
  positionPct: number;
  zone: "premium" | "discount" | "equilibrium";
}

export interface SessionInfo {
  current: "asian" | "london" | "newyork" | "closed";
  asianHigh: number | null;
  asianLow: number | null;
  londonHigh: number | null;
  londonLow: number | null;
  nyHigh: number | null;
  nyLow: number | null;
}

export interface SmcAnalysis {
  asset: AssetId;
  timeframe: Timeframe;
  generatedAt: number;
  candleCount: number;
  source: string;
  lastPrice: number;
  lastCandleTs: number;

  trend: Trend;
  structure: {
    state: Direction | "neutral";
    lastBOS: StructureEvent | null;
    lastCHOCH: StructureEvent | null;
    events: StructureEvent[]; // recent, newest last
  };
  swings: SwingPoint[];
  fvgs: FVG[]; // recent unfilled first
  orderBlocks: OrderBlock[];
  breakerBlocks: BreakerBlock[]; // breaker blocks (mitigated OBs that have been broken)
  rejectionBlocks: RejectionBlock[]; // rejection tests of order blocks that held
  liquidity: LiquidityPool[];
  range: DealingRange;
  session: SessionInfo;
  ote?: OtEdit; // Optimal Trade Entry (62-79% Fibonacci retracement zone)

  /** Human-readable reasoning, built BEFORE the final bias line. */
  narrative: string[];
  bias: {
    direction: Trend;
    confidence: number; // 0..100
    reasons: string[];
  };
  /** What could not be computed and why. */
  missing: string[];
}
