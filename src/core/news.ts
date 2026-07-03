import type { AssetId } from "./types";

// ============================================================
//  NEWS ENGINE contracts.
//  Items come from real, keyless RSS feeds. Scores are produced
//  by a TRANSPARENT rule engine (see src/news/scoring.ts) — every
//  score traces to explicit keyword/source rules, not a black box.
//  When ANTHROPIC_API_KEY is present, an LLM scorer can augment it.
// ============================================================

export type NewsFeedCategory =
  | "central_bank"
  | "macro"
  | "markets"
  | "fx"
  | "crypto"
  | "geopolitics";

export interface FeedDef {
  id: string;
  name: string;
  url: string;
  category: NewsFeedCategory;
  /** Baseline importance for anything from this source (0..100). */
  baseWeight: number;
}

/** Keyless RSS feeds verified live 2026-07-02. */
export const FEEDS: FeedDef[] = [
  {
    id: "fed",
    name: "US Federal Reserve",
    url: "https://www.federalreserve.gov/feeds/press_all.xml",
    category: "central_bank",
    baseWeight: 85,
  },
  {
    id: "ecb",
    name: "European Central Bank",
    url: "https://www.ecb.europa.eu/rss/press.html",
    category: "central_bank",
    baseWeight: 70,
  },
  {
    id: "marketwatch",
    name: "MarketWatch",
    url: "https://feeds.content.dowjones.io/public/rss/mw_topstories",
    category: "markets",
    baseWeight: 45,
  },
  {
    id: "fxstreet",
    name: "FXStreet",
    url: "https://www.fxstreet.com/rss/news",
    category: "fx",
    baseWeight: 40,
  },
  {
    id: "cointelegraph",
    name: "Cointelegraph",
    url: "https://cointelegraph.com/rss",
    category: "crypto",
    baseWeight: 35,
  },
];

export interface NewsItem {
  id: string; // stable hash of url+title
  feedId: string;
  feedName: string;
  category: NewsFeedCategory;
  title: string;
  url: string;
  summary: string;
  publishedAt: number; // ms epoch
  ingestedAt: number;
}

export type Horizon = "short" | "medium" | "long";

export interface NewsScore {
  /** 0..100 — how important the event is in absolute terms. */
  importance: number;
  /** 0..100 — expected magnitude of market reaction. */
  marketImpact: number;
  /** 0..100 — confidence the event is real/material (rumor vs release). */
  probability: number;
  /** 0..100 — engine confidence in its own scoring. */
  confidence: number;
  /** Directional lean per horizon for the PRIMARY asset (gold). */
  horizon: Record<Horizon, "bullish" | "bearish" | "neutral">;
  /** Assets this item plausibly moves. */
  affectedAssets: AssetId[];
  /** Human-readable rationale. */
  why: string;
  how: string;
  when: string;
  goldRationale: string;
  btcRationale: string;
  /** Which scorer produced this: transparent rules or an LLM. */
  engine: "heuristic" | "llm";
  /** The concrete rules/keywords that fired (auditability). */
  matched: string[];
}

export interface ScoredNews extends NewsItem {
  score: NewsScore;
}
