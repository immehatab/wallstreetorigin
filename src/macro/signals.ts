import { MACRO_SERIES } from "@/core/macro";
import type { GoldReaction, MacroBias, MacroSeries } from "@/core/macro";

const WEIGHTS = Object.fromEntries(MACRO_SERIES.map((s) => [s.key, s.weight]));

function dir(bias: GoldReaction): number {
  return bias === "bullish" ? 1 : bias === "bearish" ? -1 : 0;
}

/**
 * Aggregate the per-series gold reads into ONE macro bias for gold.
 * Transparent weighted vote — the drivers array exposes exactly which
 * series pushed which way and how hard. No hidden model.
 */
export function computeMacroBias(series: MacroSeries[]): MacroBias | null {
  if (series.length === 0) return null;

  let net = 0;
  let totalW = 0;
  let agreeW = 0;
  const drivers: MacroBias["drivers"] = [];

  for (const s of series) {
    const w = WEIGHTS[s.key] ?? 0.3;
    totalW += w;
    const d = dir(s.goldBias);
    net += w * d;
    drivers.push({ key: s.key, label: s.label, bias: s.goldBias, weight: w });
  }

  const score = totalW > 0 ? Math.round((net / totalW) * 100) : 0;
  const netSign = Math.sign(net);
  for (const s of series) {
    const w = WEIGHTS[s.key] ?? 0.3;
    if (dir(s.goldBias) === netSign && netSign !== 0) agreeW += w;
  }

  const bias: GoldReaction = score > 10 ? "bullish" : score < -10 ? "bearish" : "neutral";
  const confidence = totalW > 0 ? Math.round((agreeW / totalW) * 100) : 0;

  // Strongest drivers first.
  drivers.sort((a, b) => b.weight - a.weight);

  return { asset: "XAUUSD", bias, score, confidence, drivers, asOf: Date.now() };
}
