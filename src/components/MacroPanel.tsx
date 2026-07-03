import type { MacroBias, MacroSeries } from "@/core/macro";

const CAT_LABEL: Record<string, string> = {
  rates: "Rates",
  inflation: "Inflation",
  policy: "Policy",
  dollar: "Dollar",
  liquidity: "Liquidity",
  risk: "Risk",
};

function fmt(v: number, decimals: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(v);
}

export function MacroPanel({
  series,
  bias,
}: {
  series: MacroSeries[];
  bias: MacroBias | null;
}) {
  if (series.length === 0) {
    return <div className="loading mono">macro engine warming up… (FRED)</div>;
  }

  // Score -100..+100 -> bar geometry centered at 0.
  const score = bias?.score ?? 0;
  const half = Math.min(Math.abs(score), 100) / 2; // percent width from center
  const fillColor =
    score > 10 ? "var(--up)" : score < -10 ? "var(--down)" : "var(--text-dim)";

  return (
    <>
      {bias ? (
        <div className="macro-bias">
          <span className={`bias-badge ${bias.bias}`}>{bias.bias}</span>
          <div className="bias-meta">
            <div className="lbl">Gold macro bias · confidence {bias.confidence}%</div>
            <div className="scorebar">
              <div className="mid" />
              <div
                className="fill"
                style={{
                  background: fillColor,
                  left: score >= 0 ? "50%" : `${50 - half}%`,
                  width: `${half}%`,
                }}
              />
            </div>
            <div className="lbl" style={{ marginTop: 6 }}>
              score {score > 0 ? "+" : ""}
              {score} · bearish ◄ ► bullish
            </div>
          </div>
        </div>
      ) : null}

      <div className="macro-list">
        {series.map((m) => {
          const chg = m.change;
          const chgStr =
            chg == null ? "—" : `${chg >= 0 ? "+" : ""}${fmt(chg, Math.max(2, m.decimals))}`;
          const chgColor =
            chg == null ? "var(--muted)" : chg >= 0 ? "var(--up)" : "var(--down)";
          return (
            <div className="macro-row" key={m.key}>
              <div className="ml">
                {m.label}
                <small>
                  {CAT_LABEL[m.category]} · {m.fredId} · {m.date}
                </small>
              </div>
              <div className="mv mono">
                {fmt(m.value, m.decimals)}{" "}
                <span style={{ color: "var(--muted)", fontSize: 10 }}>{m.unit}</span>
              </div>
              <div className="mc mono" style={{ color: chgColor }}>
                {chgStr}
                <span style={{ color: "var(--muted)", fontSize: 9 }}> {m.changeLabel}</span>
              </div>
              <div className={`gbias ${m.goldBias}`} title={m.why}>
                {m.goldBias === "bullish" ? "▲" : m.goldBias === "bearish" ? "▼" : "•"} gold
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
