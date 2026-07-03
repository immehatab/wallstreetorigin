import type { AssetId } from "./types";

export type FinalBias = "Buy" | "Sell" | "Neutral";
export type Stance = "bullish" | "bearish" | "neutral";

export interface AgentOpinion {
  agent: string; // Macro / News / Liquidity / Quant / Risk
  stance: Stance;
  confidence: number; // 0..100
  rationale: string;
  keyPoints: string[];
}

/** Compact, real inputs the decision was built from (for transparency). */
export interface DecisionInputs {
  asset: AssetId;
  price: number | null;
  macroBias: { bias: string; score: number; confidence: number } | null;
  smc: {
    timeframe: string;
    trend: string;
    structure: string;
    zone: string;
    confidence: number;
  } | null;
  topNews: Array<{ title: string; impact: number; goldLean: string; source: string }>;
}

export interface TradeDecision {
  asset: AssetId;
  generatedAt: number;
  engine: "llm" | "heuristic";
  model: string | null;

  bias: FinalBias;
  confidence: number; // 0..100 — conviction in the call
  probability: number; // 0..100 — estimated win probability

  entry: number | null;
  invalidation: number | null;
  takeProfits: number[];
  riskReward: number | null;

  expectedSession: string;
  expectedLiquiditySweep: string;
  expectedNewsImpact: string;
  worstCase: string;
  bestCase: string;
  checklist: string[];

  agents: AgentOpinion[];
  debate: string[]; // points of disagreement / how consensus formed
  consensusNote: string;

  inputs: DecisionInputs;
  missing: string[];
}
