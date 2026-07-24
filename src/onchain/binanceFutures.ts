import { fetchJson, retryFn } from "@/ingestion/adapter";
import type { BtcOnchain, DerivMetric, Lean } from "@/core/onchain";
import { writeOnchain } from "@/store/onchainRepo";

// ============================================================
//  BTC derivatives engine — KEYLESS via Binance USDⓈ-M futures +
//  CoinGecko stablecoin caps. On-chain whale flows / ETF flows /
//  liquidation maps need Coinglass/Glassnode keys (declared, off).
// ============================================================

const FAPI = "https://fapi.binance.com";

async function get<T>(url: string): Promise<T> {
  return retryFn(() => fetchJson<T>(url, { timeoutMs: 8000 }));
}

export async function runOnchainJob(): Promise<number> {
  let missing: string[] = [];
  let markPrice: number | null = null;
  let fundingRate: number | null = null;
  let openInterest: number | null = null;
  let openInterestUsd: number | null = null;
  let oiChangePct24h: number | null = null;
  let longShortRatio: number | null = null;
  let takerBuySellRatio: number | null = null;
  let stablecoinMcap: number | null = null;

  const results = await Promise.allSettled([
    get<{ markPrice: string; lastFundingRate: string }>(`${FAPI}/fapi/v1/premiumIndex?symbol=BTCUSDT`),
    get<{ openInterest: string }>(`${FAPI}/fapi/v1/openInterest?symbol=BTCUSDT`),
    get<Array<{ sumOpenInterest: string; sumOpenInterestValue: string }>>(`${FAPI}/futures/data/openInterestHist?symbol=BTCUSDT&period=1h&limit=24`),
    get<Array<{ longShortRatio: string }>>(`${FAPI}/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=1h&limit=1`),
    get<Array<{ buySellRatio: string }>>(`${FAPI}/futures/data/takerlongshortRatio?symbol=BTCUSDT&period=1h&limit=1`),
    get<Record<string, { usd_market_cap?: number }>>(`https://api.coingecko.com/api/v3/simple/price?ids=tether,usd-coin&vs_currencies=usd&include_market_cap=true`),
  ]);

  const [prem, oi, oiHist, lsr, taker, stable] = results;
  if (prem.status === "fulfilled") {
    markPrice = Number(prem.value.markPrice);
    fundingRate = Number(prem.value.lastFundingRate);
  } else missing.push("funding/mark price");
  if (oi.status === "fulfilled") openInterest = Number(oi.value.openInterest);
  else missing.push("open interest");

  // Binance fapi geo-blocks datacenter IPs (451). Fall back to Bybit for the
  // core metrics (mark price, funding, open interest) so the engine still runs.
  if (markPrice == null || openInterest == null) {
    try {
      const dr = await get<{ result?: { mark_price?: number; funding_8h?: number; open_interest?: number } }>(
        "https://www.deribit.com/api/v2/public/ticker?instrument_name=BTC-PERPETUAL",
      );
      const t = dr.result;
      if (t && typeof t.mark_price === "number") {
        if (markPrice == null) { markPrice = t.mark_price; fundingRate = t.funding_8h ?? null; }
        if (openInterest == null && typeof t.open_interest === "number") {
          openInterestUsd = t.open_interest; // Deribit reports OI in USD
          openInterest = t.mark_price > 0 ? t.open_interest / t.mark_price : null;
        }
        missing = missing.filter((m) => m !== "funding/mark price" && m !== "open interest");
      }
    } catch {
      /* Deribit also unavailable — leave as missing */
    }
  }
  if (oiHist.status === "fulfilled" && oiHist.value.length > 1) {
    const first = Number(oiHist.value[0].sumOpenInterest);
    const lastRow = oiHist.value[oiHist.value.length - 1];
    const lastOi = Number(lastRow.sumOpenInterest);
    openInterestUsd = Number(lastRow.sumOpenInterestValue);
    oiChangePct24h = first > 0 ? ((lastOi - first) / first) * 100 : null;
  } else missing.push("OI history");
  if (lsr.status === "fulfilled" && lsr.value[0]) longShortRatio = Number(lsr.value[0].longShortRatio);
  else missing.push("long/short ratio");
  if (taker.status === "fulfilled" && taker.value[0]) takerBuySellRatio = Number(taker.value[0].buySellRatio);
  else missing.push("taker ratio");
  if (stable.status === "fulfilled") {
    const t = stable.value.tether?.usd_market_cap ?? 0;
    const u = stable.value["usd-coin"]?.usd_market_cap ?? 0;
    stablecoinMcap = t + u || null;
  } else missing.push("stablecoin caps");

  // ---- transparent signal ----
  const metrics: DerivMetric[] = [];
  const votes: number[] = [];
  const reasons: string[] = [];

  if (fundingRate != null) {
    const pct = fundingRate * 100;
    const bias: Lean = fundingRate > 0.0005 ? "bearish" : fundingRate < -0.0001 ? "bullish" : "neutral";
    metrics.push({
      label: "Funding Rate",
      value: `${pct.toFixed(4)}% /8h`,
      interpretation: fundingRate > 0.0005 ? "Longs crowded — squeeze risk" : fundingRate < 0 ? "Shorts pay longs — squeeze fuel" : "Balanced",
      bias,
    });
    votes.push(bias === "bullish" ? 1 : bias === "bearish" ? -1 : 0);
    if (bias !== "neutral") reasons.push(`Funding ${pct.toFixed(3)}% → ${bias}.`);
  }
  if (oiChangePct24h != null) {
    const bias: Lean = "neutral";
    metrics.push({
      label: "Open Interest 24h",
      value: `${oiChangePct24h >= 0 ? "+" : ""}${oiChangePct24h.toFixed(1)}%`,
      interpretation: oiChangePct24h > 3 ? "Positions building (conviction/froth)" : oiChangePct24h < -3 ? "De-leveraging" : "Stable",
      bias,
    });
  }
  if (longShortRatio != null) {
    const bias: Lean = longShortRatio > 2 ? "bearish" : longShortRatio < 1 ? "bullish" : "neutral";
    metrics.push({
      label: "Long/Short Ratio",
      value: longShortRatio.toFixed(2),
      interpretation: longShortRatio > 2 ? "Retail heavily long (contrarian bearish)" : longShortRatio < 1 ? "Crowd short (contrarian bullish)" : "Balanced",
      bias,
    });
    votes.push(bias === "bullish" ? 1 : bias === "bearish" ? -1 : 0);
    if (bias !== "neutral") reasons.push(`L/S ${longShortRatio.toFixed(2)} → contrarian ${bias}.`);
  }
  if (takerBuySellRatio != null) {
    const bias: Lean = takerBuySellRatio > 1.05 ? "bullish" : takerBuySellRatio < 0.95 ? "bearish" : "neutral";
    metrics.push({
      label: "Taker Buy/Sell",
      value: takerBuySellRatio.toFixed(2),
      interpretation: takerBuySellRatio > 1.05 ? "Aggressive buying" : takerBuySellRatio < 0.95 ? "Aggressive selling" : "Balanced flow",
      bias,
    });
    votes.push(bias === "bullish" ? 1 : bias === "bearish" ? -1 : 0);
    if (bias !== "neutral") reasons.push(`Taker flow ${takerBuySellRatio.toFixed(2)} → ${bias}.`);
  }

  const net = votes.reduce((a, b) => a + b, 0);
  const signalBias: Lean = net > 0 ? "bullish" : net < 0 ? "bearish" : "neutral";
  const risk = signalBias === "bullish" ? "risk-on" : signalBias === "bearish" ? "risk-off" : "neutral";
  const confidence = Math.min(85, 40 + Math.abs(net) * 12);
  if (reasons.length === 0) reasons.push("No decisive derivatives skew.");

  const data: BtcOnchain = {
    generatedAt: Date.now(),
    source: "binance-futures + coingecko",
    markPrice, fundingRate, openInterest, openInterestUsd, oiChangePct24h,
    longShortRatio, takerBuySellRatio, stablecoinMcap,
    metrics,
    signal: { bias: signalBias, risk, confidence, reasons },
    missing,
  };

  if (metrics.length === 0) throw new Error(`btc onchain: no metrics (${missing.join(", ")})`);
  writeOnchain(data);
  return metrics.length;
}
