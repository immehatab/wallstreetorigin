import type { AssetId } from "@/core/types";
import type { DecisionInputs } from "@/core/decision";
import type { SmcAnalysis } from "@/core/smc";
import { getSnapshot } from "@/store/repo";
import { getMacroSeries } from "@/store/macroRepo";
import { getTopNews } from "@/store/newsRepo";
import { computeMacroBias } from "@/macro/signals";
import { analyzeSmc } from "@/smc/engine";

/**
 * Assemble the compact, REAL context the decision engine reasons over.
 * Kept small on purpose — every field is a fact from Modules 1–3, and
 * `missing` records anything that wasn't available so the model can
 * lower confidence honestly instead of inventing.
 */
export function gatherContext(asset: AssetId, now: number): {
  inputs: DecisionInputs;
  smcFull: SmcAnalysis | null;
  missing: string[];
} {
  const missing: string[] = [];

  const snap = getSnapshot(now);
  const assetSnap = snap.assets.find((a) => a.meta.id === asset);
  const price = assetSnap?.quote?.price ?? null;
  if (price == null) missing.push(`No live price for ${asset}.`);

  const macroBias = computeMacroBias(getMacroSeries());
  if (!macroBias) missing.push("Macro engine has no data yet.");

  // Prefer H1 structure; fall back to D1 if H1 candles are absent.
  let smcFull = analyzeSmc(asset, "H1", now);
  if (smcFull.candleCount === 0) smcFull = analyzeSmc(asset, "D1", now);
  if (smcFull.candleCount === 0) {
    missing.push(`No candles for ${asset} — SMC structure unavailable.`);
  }

  const topNews = getTopNews(6).map((n) => ({
    title: n.title,
    impact: n.score.marketImpact,
    goldLean: n.score.horizon.short,
    source: n.feedName,
  }));
  if (topNews.length === 0) missing.push("No scored news yet.");

  const inputs: DecisionInputs = {
    asset,
    price,
    macroBias: macroBias
      ? { bias: macroBias.bias, score: macroBias.score, confidence: macroBias.confidence }
      : null,
    smc:
      smcFull.candleCount > 0
        ? {
            timeframe: smcFull.timeframe,
            trend: smcFull.trend,
            structure: smcFull.structure.state,
            zone: smcFull.range.zone,
            confidence: smcFull.bias.confidence,
          }
        : null,
    topNews,
  };

  return { inputs, smcFull: smcFull.candleCount > 0 ? smcFull : null, missing };
}
