"use client";

import { useState } from "react";
import type { AssetId } from "@/core/types";
import type { TradeDecision } from "@/core/decision";

const ASSETS: AssetId[] = ["XAUUSD", "BTCUSD", "ETHUSD"];

function biasColor(b: string) {
  return b === "Buy" ? "var(--up)" : b === "Sell" ? "var(--down)" : "var(--text-dim)";
}
function stanceColor(s: string) {
  return s === "bullish" ? "var(--up)" : s === "bearish" ? "var(--down)" : "var(--muted)";
}
const fmt = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("en-US", { maximumFractionDigits: v < 10 ? 4 : 2 });

export function DecisionPanel() {
  const [asset, setAsset] = useState<AssetId>("XAUUSD");
  const [dec, setDec] = useState<TradeDecision | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/decision?asset=${asset}`, { cache: "no-store" });
      const json = await res.json();
      if (json.error) setErr(json.error);
      else setDec(json as TradeDecision);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="decision-panel">
      <div className="dec-controls">
        <div className="asset-tabs">
          {ASSETS.map((a) => (
            <button
              key={a}
              className={`atab ${a === asset ? "active" : ""} ${a === "XAUUSD" ? "gold" : ""}`}
              onClick={() => setAsset(a)}
            >
              {a}
            </button>
          ))}
        </div>
        <button className="run-btn" onClick={run} disabled={loading}>
          {loading ? "agents deliberating…" : "⚡ Generate Decision"}
        </button>
      </div>

      {err ? <div className="dec-err">⚠ {err}</div> : null}

      {!dec && !loading ? (
        <div className="chart-empty mono">
          Multi-agent engine (Macro · News · Liquidity · Quant · Risk). Click Generate to run
          a full consensus on live data. On-demand only — no idle token spend.
        </div>
      ) : null}

      {dec ? (
        <>
          <div className="dec-headline">
            <div className="dec-bias" style={{ color: biasColor(dec.bias), borderColor: biasColor(dec.bias) }}>
              {dec.bias}
            </div>
            <div className="dec-metrics">
              <div><span>Confidence</span><b>{dec.confidence}%</b></div>
              <div><span>Probability</span><b>{dec.probability}%</b></div>
              <div><span>R:R</span><b>{dec.riskReward ?? "—"}</b></div>
              <div><span>Engine</span><b className="mono">{dec.engine}{dec.model ? `·${dec.model.split("-").slice(0, 2).join("-")}` : ""}</b></div>
            </div>
          </div>

          <div className="dec-plan">
            <div className="plan-cell"><span>Entry</span><b className="mono">{fmt(dec.entry)}</b></div>
            <div className="plan-cell"><span>Invalidation</span><b className="mono">{fmt(dec.invalidation)}</b></div>
            <div className="plan-cell"><span>Take Profits</span><b className="mono">{dec.takeProfits.length ? dec.takeProfits.map(fmt).join(" → ") : "—"}</b></div>
          </div>

          <div className="dec-context">
            <div><span>Session</span> {dec.expectedSession}</div>
            <div><span>Liquidity sweep</span> {dec.expectedLiquiditySweep}</div>
            <div><span>News impact</span> {dec.expectedNewsImpact}</div>
            <div><span>Best case</span> {dec.bestCase}</div>
            <div><span>Worst case</span> {dec.worstCase}</div>
          </div>

          <div className="dec-h">Agent Panel</div>
          <div className="agents-grid">
            {dec.agents.map((a, i) => (
              <div key={i} className="agent-card">
                <div className="agent-top">
                  <b>{a.agent}</b>
                  <span style={{ color: stanceColor(a.stance) }}>{a.stance} · {a.confidence}%</span>
                </div>
                <div className="agent-rat">{a.rationale}</div>
                {a.keyPoints.length ? (
                  <ul className="agent-kp">{a.keyPoints.map((k, j) => <li key={j}>{k}</li>)}</ul>
                ) : null}
              </div>
            ))}
          </div>

          <div className="dec-cols">
            <div>
              <div className="dec-h">Debate → Consensus</div>
              <ul className="smc-ul">{dec.debate.map((d, i) => <li key={i}>{d}</li>)}</ul>
              <div className="consensus-note">{dec.consensusNote}</div>
            </div>
            <div>
              <div className="dec-h">Trade Checklist</div>
              <ul className="checklist">{dec.checklist.map((c, i) => <li key={i}>{c}</li>)}</ul>
            </div>
          </div>

          {dec.missing.length ? (
            <div className="smc-missing">⚠ {dec.missing.join(" · ")}</div>
          ) : null}
          <div className="dec-foot mono">
            Generated {new Date(dec.generatedAt).toLocaleTimeString()} · inputs: price{" "}
            {dec.inputs.price != null ? "✓" : "✗"} · macro {dec.inputs.macroBias ? "✓" : "✗"} · SMC{" "}
            {dec.inputs.smc ? "✓" : "✗"} · news {dec.inputs.topNews.length}
          </div>
        </>
      ) : null}
    </div>
  );
}
