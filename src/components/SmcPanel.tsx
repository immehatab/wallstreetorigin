"use client";

import { useEffect, useState } from "react";
import type { AssetId } from "@/core/types";
import type { Candle, SmcAnalysis, Timeframe } from "@/core/smc";
import { SmcChart } from "./SmcChart";

type SmcApi = SmcAnalysis & { candles: Candle[] };

const ASSETS: AssetId[] = [
  "XAUUSD", "BTCUSD", "ETHUSD", "SP500", "NASDAQ", "DXY", "EURUSD", "XAGUSD", "WTIUSD",
];
const TFS: Timeframe[] = ["H1", "D1"];

export function SmcPanel() {
  const [asset, setAsset] = useState<AssetId>("XAUUSD");
  const [tf, setTf] = useState<Timeframe>("H1");
  const [data, setData] = useState<SmcApi | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const tick = async () => {
      try {
        const res = await fetch(`/api/smc?asset=${asset}&tf=${tf}`, { cache: "no-store" });
        const json = (await res.json()) as SmcApi;
        if (alive) {
          setData(json);
          setLoading(false);
        }
      } catch {
        if (alive) setLoading(false);
      }
    };
    tick();
    const id = setInterval(tick, 15_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [asset, tf]);

  const biasColor = (d: string) =>
    d === "bullish" ? "var(--up)" : d === "bearish" ? "var(--down)" : "var(--text-dim)";

  const noData = data && data.candleCount === 0;

  return (
    <div className="smc-panel">
      <div className="smc-controls">
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
        <div className="tf-toggle">
          {TFS.map((t) => (
            <button key={t} className={`tf ${t === tf ? "active" : ""}`} onClick={() => setTf(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {data && !noData ? (
        <>
          <div className="smc-summary">
            <span className="smc-bias" style={{ color: biasColor(data.bias.direction), borderColor: biasColor(data.bias.direction) }}>
              {data.bias.direction} · {data.bias.confidence}%
            </span>
            <span className="smc-stat">structure <b style={{ color: biasColor(data.structure.state) }}>{data.structure.state}</b></span>
            <span className="smc-stat">zone <b>{data.range.zone}</b> ({(data.range.positionPct * 100).toFixed(0)}%)</span>
            <span className="smc-stat">FVG <b>{data.fvgs.length}</b></span>
            <span className="smc-stat">OB <b>{data.orderBlocks.length}</b></span>
            <span className="smc-stat">session <b>{data.session.current}</b></span>
            <span className="smc-stat mono" style={{ marginLeft: "auto" }}>
              {data.candleCount} candles · {data.source}
            </span>
          </div>

          <SmcChart candles={data.candles} analysis={data} />

          <div className="smc-detail">
            <div>
              <div className="smc-h">Reasoning</div>
              <ul className="smc-ul">
                {data.narrative.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
              <div className="smc-h" style={{ marginTop: 10 }}>
                Bias — {data.bias.direction.toUpperCase()} @ {data.bias.confidence}%
              </div>
              <ul className="smc-ul">
                {data.bias.reasons.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="smc-h">Key Levels</div>
              <table className="smc-levels mono">
                <tbody>
                  <tr><td>Range High</td><td>{data.range.high.toLocaleString()}</td></tr>
                  <tr><td>Equilibrium</td><td>{data.range.equilibrium.toLocaleString()}</td></tr>
                  <tr><td>Range Low</td><td>{data.range.low.toLocaleString()}</td></tr>
                  {data.structure.lastBOS ? (
                    <tr><td>Last BOS ({data.structure.lastBOS.direction})</td><td>{data.structure.lastBOS.brokenLevel.toLocaleString()}</td></tr>
                  ) : null}
                  {data.structure.lastCHOCH ? (
                    <tr><td>Last CHOCH ({data.structure.lastCHOCH.direction})</td><td>{data.structure.lastCHOCH.brokenLevel.toLocaleString()}</td></tr>
                  ) : null}
                </tbody>
              </table>
              <div className="smc-h" style={{ marginTop: 10 }}>Liquidity Draws</div>
              <div className="liq-list">
                {data.liquidity.filter((l) => !l.taken).slice(0, 5).map((l, i) => (
                  <div key={i} className="liq-row">
                    <span className={l.kind === "buyside" ? "bsl" : "ssl"}>
                      {l.kind === "buyside" ? "BSL" : "SSL"}
                    </span>
                    <span>{l.label}</span>
                    <span className="mono">{l.price.toLocaleString()}</span>
                  </div>
                ))}
                {data.liquidity.filter((l) => !l.taken).length === 0 ? (
                  <div className="liq-row" style={{ color: "var(--muted)" }}>none untaken in view</div>
                ) : null}
              </div>
            </div>
          </div>

          {data.missing.length ? (
            <div className="smc-missing">⚠ {data.missing.join(" · ")}</div>
          ) : null}
        </>
      ) : (
        <div className="chart-empty mono">
          {loading
            ? "loading SMC analysis…"
            : `NO CANDLES for ${asset} ${tf} — ${data?.missing[0] ?? "not ingested yet"}`}
        </div>
      )}
    </div>
  );
}
