import type { AssetId } from "./types";

// ============================================================
//  MACRO ENGINE contracts.
//  Every macro read is a real FRED observation (keyless CSV).
//  The gold interpretation is RULE-BASED and inspectable — each
//  series declares whether a RISE in it is bullish or bearish for
//  gold, and how much weight it carries. No opaque scoring.
// ============================================================

export type MacroCategory =
  | "rates"
  | "inflation"
  | "policy"
  | "dollar"
  | "liquidity"
  | "risk";

export type GoldReaction = "bullish" | "bearish" | "neutral";

export interface MacroSeriesDef {
  key: string; // our stable key
  fredId: string; // FRED series id (fredgraph.csv?id=...)
  label: string;
  category: MacroCategory;
  unit: string;
  decimals: number;
  /** If this series RISES, what does it imply for GOLD? */
  goldOnRise: GoldReaction;
  /** Weight in the aggregate gold-macro bias (0..1). */
  weight: number;
  /** Compute year-over-year % change instead of level trend (for CPI). */
  yoy?: boolean;
  /** One-line explanation of the transmission mechanism. */
  why: string;
}

/**
 * Curated series that actually move gold. Ordered by importance.
 * DFII10 (10Y real yield) is the single most important gold driver —
 * gold pays no yield, so when real yields rise, gold's opportunity
 * cost rises and it tends to fall (and vice-versa).
 */
export const MACRO_SERIES: MacroSeriesDef[] = [
  {
    key: "real_yield_10y",
    fredId: "DFII10",
    label: "10Y Real Yield (TIPS)",
    category: "rates",
    unit: "%",
    decimals: 2,
    goldOnRise: "bearish",
    weight: 1.0,
    why: "Gold yields nothing; rising real yields raise its opportunity cost → bearish gold.",
  },
  {
    key: "dxy_broad",
    fredId: "DTWEXBGS",
    label: "Broad USD Index",
    category: "dollar",
    unit: "index",
    decimals: 2,
    goldOnRise: "bearish",
    weight: 0.8,
    why: "Gold is USD-priced; a stronger dollar makes it costlier globally → bearish gold.",
  },
  {
    key: "fed_funds",
    fredId: "FEDFUNDS",
    label: "Fed Funds Rate",
    category: "policy",
    unit: "%",
    decimals: 2,
    goldOnRise: "bearish",
    weight: 0.6,
    why: "Higher policy rates lift cash/bond yields vs non-yielding gold → bearish gold.",
  },
  {
    key: "breakeven_10y",
    fredId: "T10YIE",
    label: "10Y Breakeven Inflation",
    category: "inflation",
    unit: "%",
    decimals: 2,
    goldOnRise: "bullish",
    weight: 0.6,
    why: "Rising inflation expectations boost gold's inflation-hedge demand → bullish gold.",
  },
  {
    key: "cpi_yoy",
    fredId: "CPIAUCSL",
    label: "CPI (YoY)",
    category: "inflation",
    unit: "%",
    decimals: 2,
    goldOnRise: "bullish",
    weight: 0.5,
    yoy: true,
    why: "Realized inflation supports gold as a store of value → bullish gold.",
  },
  {
    key: "nominal_10y",
    fredId: "DGS10",
    label: "10Y Treasury Yield",
    category: "rates",
    unit: "%",
    decimals: 2,
    goldOnRise: "bearish",
    weight: 0.4,
    why: "Higher nominal yields compete with gold for safe-haven capital → bearish gold.",
  },
  {
    key: "fed_balance_sheet",
    fredId: "WALCL",
    label: "Fed Balance Sheet",
    category: "liquidity",
    unit: "$M",
    decimals: 0,
    goldOnRise: "bullish",
    weight: 0.4,
    why: "Balance-sheet expansion (QE) debases the dollar and adds liquidity → bullish gold.",
  },
  {
    key: "vix",
    fredId: "VIXCLS",
    label: "VIX (Volatility)",
    category: "risk",
    unit: "index",
    decimals: 2,
    goldOnRise: "bullish",
    weight: 0.3,
    why: "Spiking volatility/fear drives safe-haven flows into gold → bullish gold.",
  },
];

/** One stored series observation with computed trend + gold read. */
export interface MacroSeries {
  key: string;
  fredId: string;
  label: string;
  category: MacroCategory;
  unit: string;
  decimals: number;
  value: number;
  date: string; // observation date (YYYY-MM-DD)
  /** Change used for the gold read: level delta over ~1m, or YoY % if yoy. */
  change: number | null;
  changeLabel: string; // e.g. "1m", "YoY"
  goldBias: GoldReaction;
  why: string;
  updatedAt: number;
}

/** Aggregate macro read for the primary asset. */
export interface MacroBias {
  asset: AssetId; // "XAUUSD"
  bias: GoldReaction;
  /** -100..+100 (negative = bearish gold, positive = bullish gold). */
  score: number;
  confidence: number; // 0..100 — share of weight that agreed
  drivers: Array<{ key: string; label: string; bias: GoldReaction; weight: number }>;
  asOf: number;
}
