import type { AssetId } from "@/core/types";
import type {
  AgentOpinion,
  DecisionInputs,
  FinalBias,
  TradeDecision,
} from "@/core/decision";
import type { SmcAnalysis } from "@/core/smc";
import { AGENT_MODEL, extractJson, llmAvailable, llmComplete } from "./llm";
import { gatherContext } from "./context";

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Compact SMC levels block for the prompt (small on purpose). */
function smcLevels(smc: SmcAnalysis | null) {
  if (!smc) return null;
  return {
    timeframe: smc.timeframe,
    lastPrice: smc.lastPrice,
    trend: smc.trend,
    structure: smc.structure.state,
    zone: smc.range.zone,
    positionPct: Math.round(smc.range.positionPct * 100),
    rangeHigh: smc.range.high,
    rangeLow: smc.range.low,
    equilibrium: smc.range.equilibrium,
    lastBOS: smc.structure.lastBOS
      ? { dir: smc.structure.lastBOS.direction, level: smc.structure.lastBOS.brokenLevel }
      : null,
    lastCHOCH: smc.structure.lastCHOCH
      ? { dir: smc.structure.lastCHOCH.direction, level: smc.structure.lastCHOCH.brokenLevel }
      : null,
    orderBlocks: smc.orderBlocks.slice(0, 3).map((o) => ({ kind: o.kind, top: o.top, bottom: o.bottom })),
    liquidity: smc.liquidity.filter((l) => !l.taken).slice(0, 4).map((l) => ({ kind: l.kind, label: l.label, price: l.price })),
  };
}

const SYSTEM = `You are the decision engine for an institutional gold (XAUUSD) trading desk.
Simulate FIVE specialist agents who each give an INDEPENDENT stance, then DEBATE and reach a consensus:
- Macro: real yields, USD, inflation, policy.
- News: event risk and headline flow.
- Liquidity: SMC/ICT structure, order blocks, FVGs, liquidity pools, premium/discount.
- Quant: alignment/divergence across signals, probability.
- Risk: invalidation, position sizing, worst-case.
RULES: Reason ONLY from the provided data. If a data field is null/missing, say so and LOWER confidence — never invent prices or facts. Derive entry/invalidation/take-profits from the provided SMC levels only; if SMC is missing, set those to null.
Return STRICT JSON only, no prose, matching the requested schema exactly.`;

function buildUserPrompt(inputs: DecisionInputs, smc: SmcAnalysis | null, missing: string[]): string {
  const ctx = {
    asset: inputs.asset,
    livePrice: inputs.price,
    macro: inputs.macroBias,
    news: inputs.topNews,
    smc: smcLevels(smc),
    missingData: missing,
  };
  return `DATA:\n${JSON.stringify(ctx)}\n\nReturn JSON with EXACTLY these keys:
{
 "bias": "Buy|Sell|Neutral",
 "confidence": 0-100, "probability": 0-100,
 "entry": number|null, "invalidation": number|null, "takeProfits": [number,...],
 "riskReward": number|null,
 "expectedSession": "short string", "expectedLiquiditySweep": "short string",
 "expectedNewsImpact": "short string", "worstCase": "short string", "bestCase": "short string",
 "checklist": ["short item", ...],
 "agents": [{"agent":"Macro|News|Liquidity|Quant|Risk","stance":"bullish|bearish|neutral","confidence":0-100,"rationale":"1-2 sentences","keyPoints":["..."]}],
 "debate": ["point of disagreement / how consensus formed", ...],
 "consensusNote": "1-2 sentences"
}`;
}

function normalizeAgents(raw: unknown): AgentOpinion[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 5).map((a) => {
    const o = a as Record<string, unknown>;
    const stance = o.stance === "bullish" || o.stance === "bearish" ? o.stance : "neutral";
    return {
      agent: String(o.agent ?? "Agent"),
      stance,
      confidence: clamp(Number(o.confidence) || 0),
      rationale: String(o.rationale ?? ""),
      keyPoints: Array.isArray(o.keyPoints) ? o.keyPoints.map(String).slice(0, 4) : [],
    };
  });
}

// ---------------- heuristic fallback ----------------

function heuristicDecision(
  asset: AssetId,
  inputs: DecisionInputs,
  smc: SmcAnalysis | null,
  missing: string[],
  now: number,
): TradeDecision {
  // Vote: macro + SMC trend + news lean.
  let score = 0;
  const agents: AgentOpinion[] = [];

  if (inputs.macroBias) {
    const s = inputs.macroBias.bias === "bullish" ? 1 : inputs.macroBias.bias === "bearish" ? -1 : 0;
    score += s * (inputs.macroBias.confidence / 100);
    agents.push({
      agent: "Macro", stance: s > 0 ? "bullish" : s < 0 ? "bearish" : "neutral",
      confidence: inputs.macroBias.confidence,
      rationale: `Macro bias ${inputs.macroBias.bias} (score ${inputs.macroBias.score}).`,
      keyPoints: ["Real yields / USD / inflation weighted vote"],
    });
  }
  if (smc) {
    const s = smc.trend === "bullish" ? 1 : smc.trend === "bearish" ? -1 : 0;
    score += s * (smc.bias.confidence / 100);
    agents.push({
      agent: "Liquidity", stance: s > 0 ? "bullish" : s < 0 ? "bearish" : "neutral",
      confidence: smc.bias.confidence,
      rationale: `${smc.timeframe} structure ${smc.structure.state}, price in ${smc.range.zone}.`,
      keyPoints: smc.bias.reasons.slice(0, 2),
    });
  }
  const newsLean = inputs.topNews.reduce(
    (a, n) => a + (n.goldLean === "bullish" ? 1 : n.goldLean === "bearish" ? -1 : 0) * (n.impact / 100),
    0,
  );
  score += Math.max(-1, Math.min(1, newsLean)) * 0.5;
  agents.push({
    agent: "News", stance: newsLean > 0.3 ? "bullish" : newsLean < -0.3 ? "bearish" : "neutral",
    confidence: 50,
    rationale: `Net headline lean ${newsLean.toFixed(1)} across ${inputs.topNews.length} items.`,
    keyPoints: inputs.topNews.slice(0, 2).map((n) => n.title.slice(0, 60)),
  });
  agents.push({
    agent: "Quant", stance: score > 0 ? "bullish" : score < 0 ? "bearish" : "neutral",
    confidence: clamp(40 + Math.abs(score) * 30),
    rationale: `Aggregate signal score ${score.toFixed(2)} (macro+SMC+news).`,
    keyPoints: ["Alignment of independent signals"],
  });
  agents.push({
    agent: "Risk", stance: "neutral", confidence: 55,
    rationale: missing.length ? `Elevated: ${missing.length} data gap(s).` : "Standard: full data set.",
    keyPoints: missing.length ? missing.slice(0, 2) : ["All engines reporting"],
  });

  const bias: FinalBias = score > 0.35 ? "Buy" : score < -0.35 ? "Sell" : "Neutral";
  const confidence = clamp(40 + Math.abs(score) * 35 - missing.length * 6);

  // Levels from SMC range if available.
  const price = inputs.price ?? smc?.lastPrice ?? null;
  let entry = price;
  let invalidation: number | null = null;
  let takeProfits: number[] = [];
  if (smc && price != null) {
    if (bias === "Buy") {
      invalidation = smc.range.low;
      takeProfits = [smc.range.equilibrium, smc.range.high].filter((x) => x > price);
    } else if (bias === "Sell") {
      invalidation = smc.range.high;
      takeProfits = [smc.range.equilibrium, smc.range.low].filter((x) => x < price);
    }
  }
  const rr =
    entry != null && invalidation != null && takeProfits[0] != null && entry !== invalidation
      ? Math.abs((takeProfits[0] - entry) / (entry - invalidation))
      : null;

  return {
    asset, generatedAt: now, engine: "heuristic", model: null,
    bias, confidence, probability: clamp(45 + Math.abs(score) * 25),
    entry, invalidation, takeProfits, riskReward: rr ? Math.round(rr * 100) / 100 : null,
    expectedSession: smc?.session.current ?? "n/a",
    expectedLiquiditySweep:
      smc?.liquidity.find((l) => !l.taken)?.label ?? "no clean pool identified",
    expectedNewsImpact:
      inputs.topNews[0] ? `Top: "${inputs.topNews[0].title.slice(0, 50)}" (impact ${inputs.topNews[0].impact})` : "no high-impact news",
    worstCase: invalidation != null ? `Stop at ${invalidation} hit — thesis invalid.` : "Structure breaks against bias.",
    bestCase: takeProfits[0] != null ? `Runs to ${takeProfits[takeProfits.length - 1]}.` : "Trend extends.",
    checklist: [
      "Confirm HTF bias alignment",
      "Wait for entry at SMC level (OB/FVG/discount)",
      "Set invalidation beyond structure",
      "Size to fixed risk %",
      missing.length ? "⚠ Account for data gaps" : "All engines confirmed",
    ],
    agents,
    debate: [
      `Signal score ${score.toFixed(2)}: macro/SMC/news ${score > 0 ? "lean long" : score < 0 ? "lean short" : "conflict → neutral"}.`,
      missing.length ? `Confidence reduced by ${missing.length} data gap(s).` : "No data gaps.",
    ],
    consensusNote: `Deterministic fallback (no LLM). ${bias} at ${confidence}% conviction.`,
    inputs, missing,
  };
}

// ---------------- public entry ----------------

export async function generateDecision(asset: AssetId, now: number): Promise<TradeDecision> {
  const { inputs, smcFull, missing } = gatherContext(asset, now);

  if (!llmAvailable()) {
    return heuristicDecision(asset, inputs, smcFull, [...missing, "LLM not configured — heuristic used."], now);
  }

  try {
    const text = await llmComplete({
      system: SYSTEM,
      user: buildUserPrompt(inputs, smcFull, missing),
      model: AGENT_MODEL,
      maxTokens: 1500,
      temperature: 0.3,
    });
    const p = extractJson<Record<string, unknown>>(text);

    const bias: FinalBias =
      p.bias === "Buy" || p.bias === "Sell" ? (p.bias as FinalBias) : "Neutral";
    const tps = Array.isArray(p.takeProfits)
      ? (p.takeProfits.map(num).filter((x): x is number => x != null))
      : [];

    return {
      asset, generatedAt: now, engine: "llm", model: AGENT_MODEL,
      bias,
      confidence: clamp(Number(p.confidence) || 0),
      probability: clamp(Number(p.probability) || 0),
      entry: num(p.entry),
      invalidation: num(p.invalidation),
      takeProfits: tps,
      riskReward: num(p.riskReward),
      expectedSession: String(p.expectedSession ?? "n/a"),
      expectedLiquiditySweep: String(p.expectedLiquiditySweep ?? "n/a"),
      expectedNewsImpact: String(p.expectedNewsImpact ?? "n/a"),
      worstCase: String(p.worstCase ?? "n/a"),
      bestCase: String(p.bestCase ?? "n/a"),
      checklist: Array.isArray(p.checklist) ? p.checklist.map(String).slice(0, 8) : [],
      agents: normalizeAgents(p.agents),
      debate: Array.isArray(p.debate) ? p.debate.map(String).slice(0, 6) : [],
      consensusNote: String(p.consensusNote ?? ""),
      inputs, missing,
    };
  } catch (err) {
    // Any LLM/parse failure -> honest deterministic fallback, with the reason.
    return heuristicDecision(
      asset, inputs, smcFull,
      [...missing, `LLM error: ${err instanceof Error ? err.message.slice(0, 80) : "unknown"}`],
      now,
    );
  }
}
