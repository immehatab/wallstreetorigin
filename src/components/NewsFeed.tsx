import type { ScoredNews } from "@/core/news";
import { formatAge } from "@/lib/format";

function impactClass(impact: number): string {
  return impact >= 70 ? "hi" : impact >= 45 ? "mid" : "lo";
}

export function NewsFeed({ items, now }: { items: ScoredNews[]; now: number }) {
  if (items.length === 0) {
    return <div className="loading mono">news engine warming up… (RSS)</div>;
  }

  return (
    <div className="news-list">
      {items.map((n) => {
        const s = n.score;
        const dir = s.horizon.short;
        return (
          <div key={n.id} className={`news-item ${dir}`}>
            <div className="news-top">
              <span className="news-src">{n.feedName}</span>
              <span className="news-time mono">{formatAge(now - n.publishedAt)} ago</span>
              <span className={`impact-chip ${impactClass(s.marketImpact)}`}>
                IMPACT {s.marketImpact}
              </span>
              <span className="impact-chip lo">PROB {s.probability}%</span>
              <span className={`gold-dir ${dir}`}>
                gold {dir === "bullish" ? "▲" : dir === "bearish" ? "▼" : "•"}
              </span>
            </div>

            <a className="news-title" href={n.url} target="_blank" rel="noreferrer">
              {n.title}
            </a>

            <div className="news-foot">
              <div className="news-assets">
                {s.affectedAssets.map((a) => (
                  <span key={a} className={`asset-chip ${a === "XAUUSD" ? "gold" : ""}`}>
                    {a}
                  </span>
                ))}
              </div>
              <span className="engine-tag" title="Scoring engine">
                {s.engine}
              </span>
            </div>

            {s.matched.length > 0 ? (
              <div className="news-why">{s.why}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
