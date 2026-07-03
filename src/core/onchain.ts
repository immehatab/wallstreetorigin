export type Lean = "bullish" | "bearish" | "neutral";

export interface DerivMetric {
  label: string;
  value: string;
  interpretation: string;
  bias: Lean;
}

export interface BtcOnchain {
  generatedAt: number;
  source: string;
  markPrice: number | null;
  fundingRate: number | null; // fraction per 8h (e.g. 0.0001 = 0.01%)
  openInterest: number | null; // BTC
  openInterestUsd: number | null;
  oiChangePct24h: number | null;
  longShortRatio: number | null; // global account ratio
  takerBuySellRatio: number | null;
  stablecoinMcap: number | null; // USDT+USDC total (liquidity proxy)
  metrics: DerivMetric[];
  signal: {
    bias: Lean;
    risk: "risk-on" | "risk-off" | "neutral";
    confidence: number;
    reasons: string[];
  };
  missing: string[];
}
