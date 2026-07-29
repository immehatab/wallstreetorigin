import type { GeopoliticalItem } from "@/core/geopolitical";
import { formatClock } from "@/lib/format";
import { useEffect, useState } from "react";

export function GeopoliticalLeaders() {
  const [items, setItems] = useState<GeopoliticalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchGeopoliticalData() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/geopolitical", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status}`);
        }
        const data = await response.json();
        setItems(data);
      } catch (err) {
        setError("Failed to load geopolitical data");
        console.error("Error fetching geopolitical data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchGeopoliticalData();
  }, []);

  if (error) {
    return (
      <div className="error mono">
        {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading mono">
        Loading geopolitical developments...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="loading mono">
        No significant geopolitical developments in the near term
      </div>
    );
  }

  return (
    <div className="geopolitical-leaders">
      {items.map((item) => (
        <div key={item.id} className="geo-card">
          <div className="geo-header">
            <div className="geo-type-icon">
              {item.type === "person" ? "👤" :
               item.type === "institution" ? "🏛️" :
               item.type === "event" ? "📅" :
               item.type === "policy" ? "📜" : "⚔️"}
            </div>
            <div className="geo-info">
              <h3 className="geo-title">{item.title}</h3>
              <p className="geo-desc">{item.description}</p>
            </div>
          </div>

          <div className="geo-details">
            <div className="geo-meta">
              <span className={`geo-impact impact-${item.impact}`}>
                {item.impact.toUpperCase()} IMPACT
              </span>
              <span className="geo-probability">
                AI Impact Prob: {item.probability}%
              </span>
              <span className={`geo-sentiment sent-${item.sentiment}`}>
                {item.sentiment === "bullish" ? "▲" :
                 item.sentiment === "bearish" ? "▼" : "•"}
              </span>
            </div>

            <div className="geo-key-factors">
              <strong>Key Factors:</strong>
              <ul className="geo-factors-list">
                {item.keyFactors.map((factor, index) => (
                  <li key={index}>{factor}</li>
                ))}
              </ul>
            </div>

            <div className="geo-gold-impact">
              <strong>Gold Impact Analysis:</strong> {item.goldImpact}
            </div>

            <div className="geo-source">
              <small>Source: {item.source}</small>
            </div>

            <div className="geo-time">
              <strong>Timeframe:</strong> {item.urgency === "ongoing" ? "Ongoing" : item.urgency === "soon" ? "Within days" : item.urgency === "upcoming" ? "Within weeks" : "TBD"}
              {item.timestamp > 0 && (
                <>
                  <br />
                  <small>Updated: {formatClock(item.timestamp, "UTC")}</small>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}