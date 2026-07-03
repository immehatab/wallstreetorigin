"use client";

import { useEffect, useState } from "react";
import type { BtcOnchain } from "@/core/onchain";

function leanColor(b: string) {
  return b === "bullish" ? "var(--up)" : b === "bearish" ? "var(--down)" : "var(--text-dim)";
}
const usd = (v: number | null, digits = 0) =>
  v == null ? "—" : "$" + v.toLocaleString("en-US", { maximumFractionDigits: digits });
const bn = (v: number | null) => (v == null ? "—" : "$" + (v / 1e9).toFixed(1) + "B");

export function BtcEnginePanel() {
  const [d, setD] = useState<BtcOnchain | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch("/api/onchain", { cache: "no-store" });
        const j = await r.json();
        if (alive) setD(j.data ?? null);
      } catch {
        /* keep last */
      }
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!d) return <div className="chart-empty mono">BTC derivatives engine warming up…</div>;

  const s = d.signal;
  return (
    <div className="btc-panel">
      <div className="btc-signal">
        <span className="btc-bias" style={{ color: leanColor(s.bias), borderColor: leanColor(s.bias) }}>
          {s.bias} · {s.risk}
        </span>
        <span className="btc-conf">confidence {s.confidence}%</span>
        <span className="btc-mark mono" style={{ marginLeft: "auto" }}>
          BTC {usd(d.markPrice, 1)}
        </span>
      </div>

      <div className="btc-metrics">
        {d.metrics.map((m, i) => (
          <div key={i} className="btc-metric">
            <div className="bm-top">
              <span>{m.label}</span>
              <b className="mono" style={{ color: leanColor(m.bias) }}>{m.value}</b>
            </div>
            <div className="bm-int">{m.interpretation}</div>
          </div>
        ))}
      </div>

      <div className="btc-extra mono">
        <span>OI <b>{d.openInterest ? d.openInterest.toLocaleString("en-US", { maximumFractionDigits: 0 }) + " BTC" : "—"}</b> ({bn(d.openInterestUsd)})</span>
        <span>Stablecoin cap <b>{bn(d.stablecoinMcap)}</b></span>
      </div>

      <ul className="smc-ul" style={{ marginTop: 8 }}>
        {s.reasons.map((r, i) => <li key={i}>{r}</li>)}
      </ul>

      {d.missing.length ? (
        <div className="smc-missing">⚠ needs keyed sources for: whale/exchange flows, ETF flows, liquidation maps (Coinglass/Glassnode). Missing now: {d.missing.join(", ")}</div>
      ) : null}
    </div>
  );
}
