import type { Candle, SmcAnalysis } from "@/core/smc";

// Logical canvas; scales to container via viewBox.
const W = 1040;
const H = 460;
const PAD = { top: 14, right: 74, bottom: 22, left: 8 };
const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;

export function SmcChart({
  candles,
  analysis,
}: {
  candles: Candle[];
  analysis: SmcAnalysis;
}) {
  if (candles.length < 2) {
    return (
      <div className="chart-empty mono">
        no candles to plot — {analysis.missing[0] ?? "awaiting data"}
      </div>
    );
  }

  // Price scale from visible candles (+ small padding).
  let pMin = Infinity;
  let pMax = -Infinity;
  for (const c of candles) {
    if (c.low < pMin) pMin = c.low;
    if (c.high > pMax) pMax = c.high;
  }
  const pad = (pMax - pMin) * 0.06 || 1;
  pMin -= pad;
  pMax += pad;

  const n = candles.length;
  const cw = plotW / n;
  const bodyW = Math.max(1, cw * 0.62);
  const xAt = (i: number) => PAD.left + i * cw + cw / 2;
  const y = (price: number) =>
    PAD.top + ((pMax - price) / (pMax - pMin)) * plotH;

  // ts -> x, clamped to the visible window's left edge for older overlays.
  const firstTs = candles[0].ts;
  const idxForTs = (ts: number) => {
    if (ts <= firstTs) return 0;
    for (let i = 0; i < n; i++) if (candles[i].ts >= ts) return i;
    return n - 1;
  };
  const xForTs = (ts: number) => xAt(idxForTs(ts));

  const dp = (v: number) =>
    v.toLocaleString("en-US", { maximumFractionDigits: v < 10 ? 4 : 2 });

  const priceRight = PAD.left + plotW;
  const lastPrice = candles[n - 1].close;

  // ---- premium / discount shading ----
  const r = analysis.range;
  const yHigh = y(r.high);
  const yEq = y(r.equilibrium);
  const yLow = y(r.low);

  // Grid price labels (5 lines).
  const gridLines = Array.from({ length: 5 }, (_, i) => {
    const price = pMin + ((pMax - pMin) * (i + 0.5)) / 5;
    return { price, yy: y(price) };
  });

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="smc-svg" preserveAspectRatio="none">
        {/* premium / discount zones */}
        {r.high > r.low ? (
          <>
            <rect x={PAD.left} y={yHigh} width={plotW} height={Math.max(0, yEq - yHigh)} fill="rgba(255,84,112,0.05)" />
            <rect x={PAD.left} y={yEq} width={plotW} height={Math.max(0, yLow - yEq)} fill="rgba(38,214,138,0.05)" />
            <line x1={PAD.left} y1={yEq} x2={priceRight} y2={yEq} stroke="var(--border-2)" strokeDasharray="4 4" />
            <text x={PAD.left + 4} y={yHigh + 11} className="chart-tag" fill="var(--down)">PREMIUM</text>
            <text x={PAD.left + 4} y={yLow - 4} className="chart-tag" fill="var(--up)">DISCOUNT</text>
            <text x={priceRight + 3} y={yEq + 3} className="chart-axis">EQ {dp(r.equilibrium)}</text>
          </>
        ) : null}

        {/* grid labels */}
        {gridLines.map((g, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={g.yy} x2={priceRight} y2={g.yy} stroke="var(--border)" strokeOpacity="0.4" />
            <text x={priceRight + 3} y={g.yy + 3} className="chart-axis">{dp(g.price)}</text>
          </g>
        ))}

        {/* FVG boxes (unfilled) extend to the right edge */}
        {analysis.fvgs.slice(0, 6).map((f, i) => {
          const x0 = xForTs(f.ts);
          const top = y(f.top);
          const h = Math.max(1, y(f.bottom) - top);
          const col = f.kind === "bullish" ? "38,214,138" : "255,84,112";
          return (
            <rect key={"fvg" + i} x={x0} y={top} width={priceRight - x0} height={h}
              fill={`rgba(${col},0.10)`} stroke={`rgba(${col},0.35)`} strokeWidth="0.5" />
          );
        })}

        {/* Order block boxes (active) */}
        {analysis.orderBlocks.map((o, i) => {
          const x0 = xForTs(o.ts);
          const top = y(o.top);
          const h = Math.max(1, y(o.bottom) - top);
          const col = o.kind === "bullish" ? "38,214,138" : "255,84,112";
          return (
            <g key={"ob" + i}>
              <rect x={x0} y={top} width={priceRight - x0} height={h}
                fill={`rgba(${col},0.06)`} stroke={`rgba(${col},0.6)`} strokeWidth="1" strokeDasharray="2 2" />
              <text x={x0 + 3} y={top + 10} className="chart-tag" fill={`rgb(${col})`}>OB</text>
            </g>
          );
        })}

        {/* candles */}
        {candles.map((c, i) => {
          const up = c.close >= c.open;
          const col = up ? "var(--up)" : "var(--down)";
          const x = xAt(i);
          const yO = y(c.open);
          const yC = y(c.close);
          const bodyTop = Math.min(yO, yC);
          const bodyH = Math.max(1, Math.abs(yC - yO));
          return (
            <g key={i}>
              <line x1={x} y1={y(c.high)} x2={x} y2={y(c.low)} stroke={col} strokeWidth="1" />
              <rect x={x - bodyW / 2} y={bodyTop} width={bodyW} height={bodyH} fill={col} />
            </g>
          );
        })}

        {/* structure events: BOS / CHOCH */}
        {analysis.structure.events.slice(-4).map((e, i) => {
          const x0 = xForTs(e.ts);
          const yy = y(e.brokenLevel);
          const col = e.direction === "bullish" ? "var(--up)" : "var(--down)";
          return (
            <g key={"se" + i}>
              <line x1={x0} y1={yy} x2={priceRight} y2={yy} stroke={col} strokeWidth="1" strokeDasharray="6 3" strokeOpacity="0.8" />
              <text x={x0 + 3} y={yy - 3} className="chart-tag" fill={col}>
                {e.type} {e.direction === "bullish" ? "▲" : "▼"}
              </text>
            </g>
          );
        })}

        {/* liquidity pools */}
        {analysis.liquidity.slice(0, 5).map((l, i) => {
          const yy = y(l.price);
          const col = l.kind === "buyside" ? "var(--gold)" : "var(--blue)";
          return (
            <g key={"lq" + i} opacity={l.taken ? 0.3 : 0.9}>
              <line x1={PAD.left} y1={yy} x2={priceRight} y2={yy} stroke={col} strokeWidth="0.75" strokeDasharray="1 4" />
              <text x={PAD.left + 4} y={yy - 2} className="chart-tag" fill={col}>
                {l.kind === "buyside" ? "BSL" : "SSL"}{l.taken ? " ✓" : ""}
              </text>
            </g>
          );
        })}

        {/* current price line */}
        <line x1={PAD.left} y1={y(lastPrice)} x2={priceRight} y2={y(lastPrice)} stroke="var(--text)" strokeWidth="0.75" strokeOpacity="0.6" />
        <rect x={priceRight} y={y(lastPrice) - 8} width={PAD.right} height={16} fill="var(--panel-2)" stroke="var(--border-2)" />
        <text x={priceRight + 4} y={y(lastPrice) + 3} className="chart-price">{dp(lastPrice)}</text>
      </svg>
    </div>
  );
}
