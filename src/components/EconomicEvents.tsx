import type { EconomicEvent } from "@/core/economic";
import { formatClock } from "@/lib/format";
import { useEffect, useState } from "react";

export function EconomicEvents() {
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEvents() {
      try {
        setLoading(true);
        const response = await fetch("/api/economic", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        setEvents(data);
        setError(null);
      } catch (err) {
        setError("Failed to load economic events");
        console.error("Failed to fetch economic events:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, []);

  if (loading) {
    return <div className="loading mono">Loading economic events…</div>;
  }

  if (error) {
    return <div className="error mono">{error}</div>;
  }

  // Filter for upcoming events (within next 7 days)
  const now = Date.now();
  const oneWeekFromNow = now + 7 * 24 * 60 * 60 * 1000;
  const upcomingEvents = events.filter(
    (event) => event.scheduledAt >= now && event.scheduledAt <= oneWeekFromNow
  );

  // Sort by scheduled time
  upcomingEvents.sort((a, b) => a.scheduledAt - b.scheduledAt);

  if (upcomingEvents.length === 0) {
    return (
      <div className="info mono">
        No upcoming economic events in the next 7 days
      </div>
    );
  }

  return (
    <div className="economic-events">
      <div className="section-header">
        <h2>📅 Upcoming Economic Events</h2>
        <p className="subtitle">
          Market-moving events that could impact XAUUSD • Auto-updating calendar
        </p>
      </div>

      {upcomingEvents.map((event) => (
        <div key={event.id} className="event-card">
          <div className="event-header">
            <div className="event-flag">{getFlagEmoji(event.countryCode)}</div>
            <div className="event-info">
              <h3 className="event-title">{event.title}</h3>
              <p className="event-desc">{event.description}</p>
            </div>
          </div>

          <div className="event-meta">
            <div className="metric">
              <span className="label">Impact</span>
              <span className={`value impact-${event.impact.toLowerCase()}`}>
                {event.impact.toUpperCase()}
              </span>
            </div>
            <div className="metric">
              <span className="label">AI Impact Prob.</span>
              <span className="value">{event.probability}%</span>
            </div>
            <div className="metric">
              <span className="label">Expected Move</span>
              <span className="value direction-{event.impactDirection.toLowerCase()}">
                {getDirectionSymbol(event.impactDirection)} {event.impactDirection.toUpperCase()}
              </span>
            </div>
          </div>

          {event.forecast !== null && event.previous !== null && (
            <div className="event-values">
              <div className="value-pair">
                <span className="label">Forecast:</span>
                <span className="value">{event.forecast}{event.unit}</span>
              </div>
              <div className="value-pair">
                <span className="label">Previous:</span>
                <span className="value">{event.previous}{event.unit}</span>
              </div>
              {event.actual !== null && (
                <div className="value-pair">
                  <span className="label">Actual:</span>
                  <span className="value">{event.actual}{event.unit}</span>
                </div>
              )}
            </div>
          )}

          <div className="event-gold-relevance">
            <strong>Gold Impact:</strong> {event.goldRelevance}
          </div>

          <div className="event-timing">
            <div className="time-label">When:</div>
            <div className="time-value">
              {formatClock(event.scheduledAt, "America/New_York")}
              <span className="timezone-tag">ET</span>
            </div>
            <div className="time-label">In:</div>
            <div className="time-value countdown">
              {formatTimeUntil(event.scheduledAt)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Helper functions
function getFlagEmoji(countryCode: string): string {
  const flagMap: Record<string, string> = {
    US: "🇺🇸",
    EU: "🇪🇺",
    GB: "🇬🇧",
    CN: "🇨🇳",
    JP: "🇯🇵",
    CA: "🇨🇦",
    AU: "🇦🇺",
    CH: "🇨🇭",
  };
  return flagMap[countryCode] || "🏳️";
}

function getDirectionSymbol(direction: "bullish" | "bearish" | "neutral" | "mixed"): string {
  const map: Record<string, string> = {
    bullish: "▲",
    bearish: "▼",
    neutral: "•",
    mixed: "↕"
  };
  return map[direction] || "•";
}

function formatTimeUntil(timestamp: number): string {
  const now = Date.now();
  const diffMs = timestamp - now;

  if (diffMs <= 0) {
    return "LIVE";
  }

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays}d ${diffHours % 24}h`;
  } else if (diffHours > 0) {
    return `${diffHours}h ${diffMin % 60}m`;
  } else if (diffMin > 0) {
    return `${diffMin}m`;
  } else {
    return `${diffSec}s`;
  }
}