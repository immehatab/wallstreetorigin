import { FEEDS, type NewsItem, type NewsScore } from "@/core/news";
import type { AssetId } from "@/core/types";

// ============================================================
//  TRANSPARENT heuristic scorer.
//  Every number below traces to an explicit rule that "fired" on the
//  headline text — surfaced in score.matched for full auditability.
//  This is deliberately NOT a black box. When ANTHROPIC_API_KEY is
//  present, scoreWithLLM (future) can override, but the rules remain
//  the honest, offline default.
// ============================================================

interface TopicRule {
  tag: string;
  re: RegExp;
  weight: number; // added to importance/impact
  assets: AssetId[];
}

/** Topics that carry market weight, with the assets they touch. */
const TOPIC_RULES: TopicRule[] = [
  { tag: "Fed policy", re: /\bfomc\b|federal open market|fed(?:eral reserve)?\b|rate decision|powell/i, weight: 38, assets: ["XAUUSD", "DXY", "US10Y", "SP500", "NASDAQ"] },
  { tag: "Interest rates", re: /interest rate|rate (?:cut|hike)|basis points|\bbps\b|monetary policy|tighten|easing/i, weight: 34, assets: ["XAUUSD", "DXY", "US10Y"] },
  { tag: "Inflation", re: /\bcpi\b|\bppi\b|\bpce\b|inflation|deflation|price index/i, weight: 32, assets: ["XAUUSD", "US10Y", "DXY"] },
  { tag: "Jobs", re: /nonfarm|payroll|jobless|unemployment|labor market|jobs report/i, weight: 28, assets: ["XAUUSD", "DXY", "SP500"] },
  { tag: "Growth", re: /\bgdp\b|recession|economic growth|pmi|ism\b/i, weight: 22, assets: ["SP500", "NASDAQ", "DXY"] },
  { tag: "Central banks", re: /\becb\b|\bboj\b|\bboe\b|\bpboc\b|central bank|christine lagarde/i, weight: 24, assets: ["EURUSD", "DXY", "XAUUSD"] },
  { tag: "Geopolitics", re: /\bwar\b|invasion|missile|nuclear|military|conflict|attack|sanction|embargo/i, weight: 40, assets: ["XAUUSD", "WTIUSD"] },
  { tag: "Trade/Tariffs", re: /tariff|trade war|trade deal|export ban|import duty/i, weight: 30, assets: ["XAUUSD", "DXY", "SP500"] },
  { tag: "Gold", re: /\bgold\b|bullion|xau|precious metal|central bank gold/i, weight: 26, assets: ["XAUUSD", "XAGUSD"] },
  { tag: "Dollar", re: /\bdollar\b|greenback|\bdxy\b|reserve currency/i, weight: 20, assets: ["DXY", "XAUUSD", "EURUSD"] },
  { tag: "Crypto", re: /bitcoin|\bbtc\b|ethereum|\beth\b|crypto|stablecoin|\bsec\b|spot etf|halving|liquidation/i, weight: 22, assets: ["BTCUSD", "ETHUSD"] },
  { tag: "Energy", re: /\boil\b|crude|\bopec\b|\bwti\b|brent|energy prices/i, weight: 18, assets: ["WTIUSD", "XAUUSD"] },
];

/** Directional rules for GOLD specifically (+ bullish, − bearish). */
const GOLD_DIRECTION: Array<{ re: RegExp; dir: 1 | -1; tag: string }> = [
  { re: /rate cut|dovish|ease|easing|stimulus|liquidity|weaker dollar|dollar falls|safe haven|haven demand|war|invasion|crisis|uncertainty|debt|default/i, dir: 1, tag: "dovish/haven → gold up" },
  { re: /rate hike|hawkish|tighten|tightening|stronger dollar|dollar rises|higher yields|yields rise|risk-on|risk on/i, dir: -1, tag: "hawkish/strong USD → gold down" },
];

const RUMOR = /reportedly|rumou?r|sources say|speculat|could |may |might |unconfirmed|alleged/i;
const OFFICIAL_RELEASE = /issues|announces|statement|press release|decision|releases|publishes/i;

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function baseWeight(feedId: string): number {
  return FEEDS.find((f) => f.id === feedId)?.baseWeight ?? 30;
}

export function scoreNews(item: NewsItem): NewsScore {
  const text = `${item.title} ${item.summary}`;
  const matched: string[] = [];
  const affected = new Set<AssetId>();

  const hitWeights: number[] = [];
  for (const rule of TOPIC_RULES) {
    if (rule.re.test(text)) {
      matched.push(rule.tag);
      hitWeights.push(rule.weight);
      rule.assets.forEach((a) => affected.add(a));
    }
  }
  // Diminishing returns on stacked topics so importance stays discriminating:
  // full weight for the strongest topic, then 0.5x, then 0.25x for the rest.
  hitWeights.sort((a, b) => b - a);
  const topicWeight = hitWeights.reduce(
    (sum, w, i) => sum + w * (i === 0 ? 1 : i === 1 ? 0.5 : 0.25),
    0,
  );

  let goldDir = 0;
  for (const d of GOLD_DIRECTION) {
    if (d.re.test(text)) {
      goldDir += d.dir;
      matched.push(d.tag);
    }
  }

  // Default asset exposure by feed category if nothing specific fired.
  if (affected.size === 0) {
    if (item.category === "crypto") ["BTCUSD", "ETHUSD"].forEach((a) => affected.add(a as AssetId));
    else if (item.category === "fx") ["EURUSD", "DXY"].forEach((a) => affected.add(a as AssetId));
    else if (item.category === "central_bank") ["XAUUSD", "DXY", "US10Y"].forEach((a) => affected.add(a as AssetId));
    else if (item.category === "markets") ["SP500", "NASDAQ"].forEach((a) => affected.add(a as AssetId));
  }

  const base = baseWeight(item.feedId);
  const importance = clamp(base * 0.6 + topicWeight);
  const marketImpact = clamp(base * 0.4 + topicWeight * 0.9);

  let probability = 70;
  if (item.category === "central_bank" && OFFICIAL_RELEASE.test(text)) probability = 92;
  if (RUMOR.test(text)) {
    probability = Math.min(probability, 50);
    matched.push("rumor/unconfirmed");
  }

  // Confidence in our own read: more matched rules + a clear direction = higher.
  const confidence = clamp(
    35 + matched.length * 10 + (goldDir !== 0 ? 15 : 0) + (probability >= 90 ? 10 : 0),
  );

  const goldLean = goldDir > 0 ? "bullish" : goldDir < 0 ? "bearish" : "neutral";
  const horizon = {
    short: goldLean,
    medium: goldDir !== 0 ? goldLean : "neutral",
    long: "neutral", // headlines rarely justify a confident long-horizon gold call
  } as NewsScore["horizon"];

  const affectedList = [...affected];
  const touchesGold = affectedList.includes("XAUUSD");
  const touchesBtc = affectedList.includes("BTCUSD") || affectedList.includes("ETHUSD");

  const goldRationale = touchesGold
    ? goldLean === "neutral"
      ? `Gold is exposed via ${matched[0] ?? "macro linkage"}, but direction is ambiguous from the headline alone.`
      : `${goldLean === "bullish" ? "Supports" : "Pressures"} gold: ${matched.find((m) => m.includes("→")) ?? "rates/USD/haven channel"}.`
    : "No direct gold transmission identified in this item.";

  const btcRationale = touchesBtc
    ? "Bitcoin reacts through the risk-on/off and liquidity channel this item implies."
    : /liquidity|dollar|rate|fed|risk/i.test(text)
      ? "Indirect BTC exposure via macro liquidity/risk sentiment."
      : "No direct bitcoin transmission identified.";

  return {
    importance,
    marketImpact,
    probability,
    confidence,
    horizon,
    affectedAssets: affectedList,
    why: matched.length
      ? `Matched: ${matched.join("; ")}.`
      : "No high-impact keywords matched — treated as low-signal.",
    how: affectedList.length
      ? `Transmits to ${affectedList.join(", ")} via rates, the dollar, and safe-haven flows.`
      : "No clear transmission channel.",
    when:
      probability >= 90
        ? "Immediate — this is a confirmed release."
        : "Watch next sessions; impact conditional on confirmation.",
    goldRationale,
    btcRationale,
    engine: "heuristic",
    matched,
  };
}
