"use client";

import { useEffect, useRef, useState } from "react";
import { AssetTile } from "@/components/AssetTile";
import { SourceHealthPanel } from "@/components/SourceHealthPanel";
import { MacroPanel } from "@/components/MacroPanel";
import { NewsFeed } from "@/components/NewsFeed";
import { SmcPanel } from "@/components/SmcPanel";
import { DecisionPanel } from "@/components/DecisionPanel";
import { BtcEnginePanel } from "@/components/BtcEnginePanel";
import type { TerminalSnapshot } from "@/core/types";
import type { MacroBias, MacroSeries } from "@/core/macro";
import type { ScoredNews } from "@/core/news";
import { formatClock } from "@/lib/format";

const POLL_MS = 2000;

interface MacroApi {
  series: MacroSeries[];
  bias: MacroBias | null;
}
interface NewsApi {
  items: ScoredNews[];
}

/** Poll a JSON endpoint on an interval into state. */
function usePolled<T>(url: string, ms: number): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as T;
        if (alive) setData(json);
      } catch {
        /* keep last good data */
      }
    };
    tick();
    const id = setInterval(tick, ms);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [url, ms]);
  return data;
}

export default function Page() {
  const [snap, setSnap] = useState<TerminalSnapshot | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const [connected, setConnected] = useState(false);
  const failRef = useRef(0);

  // Poll the snapshot endpoint.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/snapshot", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as TerminalSnapshot;
        if (!alive) return;
        setSnap(data);
        setConnected(true);
        failRef.current = 0;
      } catch {
        failRef.current++;
        if (failRef.current > 2) setConnected(false);
      }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // Smooth 1s clock for ages / header.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const macro = usePolled<MacroApi>("/api/macro", 60_000);
  const news = usePolled<NewsApi>("/api/news", 30_000);

  const integrity = snap?.integrity;
  const scoreColor = integrity
    ? integrity.score >= 80
      ? "var(--up)"
      : integrity.score >= 50
        ? "var(--amber)"
        : "var(--down)"
    : "var(--muted)";

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <h1>
            XAU<span className="accent">·</span>TERMINAL
          </h1>
          <span className="tag">Module 1 · Data Foundation</span>
          <span className="status-line pill">
            <span
              className="dot"
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: connected ? "var(--live)" : "var(--downdot)",
                display: "inline-block",
              }}
            />
            {connected ? "feed connected" : "connecting…"}
          </span>
        </div>

        <div className="clock">
          <span className="mono">
            <span className="label">UTC</span>
            {formatClock(now, "UTC")}
          </span>
          <span className="mono">
            <span className="label">NY</span>
            {formatClock(now, "America/New_York")}
          </span>
          {integrity ? (
            <div className="integrity">
              <span className="score mono" style={{ color: scoreColor }}>
                {integrity.score}%
              </span>
              <div className="meta">
                <span>
                  <b>{integrity.assetsWithData}</b>/{integrity.assetsTotal} assets fresh
                </span>
                <span>
                  <b>{integrity.sourcesLive}</b> sources live
                </span>
              </div>
            </div>
          ) : null}
          {macro?.bias ? (
            <div className="integrity" title="Gold macro bias from FRED (real yields, USD, inflation, policy)">
              <span
                className="score mono"
                style={{
                  color:
                    macro.bias.bias === "bullish"
                      ? "var(--up)"
                      : macro.bias.bias === "bearish"
                        ? "var(--down)"
                        : "var(--text-dim)",
                  fontSize: 13,
                  fontWeight: 800,
                  textTransform: "uppercase",
                }}
              >
                {macro.bias.bias}
              </span>
              <div className="meta">
                <span>
                  gold <b>macro</b>
                </span>
                <span>
                  {macro.bias.score > 0 ? "+" : ""}
                  {macro.bias.score} · {macro.bias.confidence}%
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <main className="wrap">
        {!snap ? (
          <div className="loading mono">initializing data foundation…</div>
        ) : (
          <>
            <div className="section-title">Live Market Grid</div>
            <div className="grid">
              {snap.assets.map((a) => (
                <AssetTile key={a.meta.id} snap={a} now={now} />
              ))}
            </div>

            <div className="section-title">AI Decision · multi-agent consensus</div>
            <DecisionPanel />

            <div className="section-title">SMC / ICT Engine · market structure</div>
            <SmcPanel />

            <div className="section-title">BTC Engine · derivatives &amp; flows</div>
            <BtcEnginePanel />

            <div className="cols">
              <div>
                <div className="section-title">Institutional News Feed · scored</div>
                <NewsFeed items={news?.items ?? []} now={now} />
              </div>
              <div>
                <div className="section-title">Macro · Gold Drivers (FRED)</div>
                <MacroPanel series={macro?.series ?? []} bias={macro?.bias ?? null} />
              </div>
            </div>

            <div className="section-title">Data Source Health</div>
            <SourceHealthPanel sources={snap.sources} now={now} />

            <div className="footnote">
              <b>Data integrity policy:</b> every price, macro read, and news score is
              traceable to a named, timestamped source. Assets with no fresh quote render{" "}
              <b>NO DATA</b> rather than a guess. Greyed sources are declared but not yet
              wired — add the listed API key and they activate automatically.
              <br />
              <b>Macro (FRED, keyless):</b> the gold bias is a transparent weighted vote of
              real yields, the dollar, inflation, policy rates and liquidity — hover any row
              for its transmission mechanism.{" "}
              <b>News (RSS, keyless):</b> scored by a transparent heuristic engine (matched
              rules shown); it is keyword-based and negation-blind — add{" "}
              <b>ANTHROPIC_API_KEY</b> to upgrade to LLM scoring. Refresh {POLL_MS / 1000}s.
            </div>
          </>
        )}
      </main>
    </>
  );
}
