"use client";

import { useEffect, useRef, useState } from "react";
import { AssetTile } from "@/components/AssetTile";
import { NewsFeed } from "@/components/NewsFeed";
import { MacroPanel } from "@/components/MacroPanel";
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

            <div className="section-title">Institutional News Feed · scored</div>
            <NewsFeed items={news?.items ?? []} now={now} />

            <div className="section-title">Macro · Gold Drivers (FRED)</div>
            <MacroPanel series={macro?.series ?? []} bias={macro?.bias ?? null} />
          </>
        )}
      </main>
    </>
  );
}