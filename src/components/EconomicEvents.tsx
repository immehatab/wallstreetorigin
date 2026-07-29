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
      <div className="loading mono">
        No upcoming economic events in the next 7 days
      </div>
    );
  }

  return (
    <div className="economic-events">
      {upcomingEvents.map((event) => (
        <div key={event.id} className="event-card">
          <div className="event-header">
            <div className="event-flag">{event.countryCode}</div>
            <div className="event-info">
              <h3 className="event-title">{event.title}</h3>
              <p className="event-desc">{event.description}</p>
            </div>
          </div>

          <div className="event-details">
            <div className="event-meta">
              <span className={`event-impact impact-${event.impact}`}>
                {event.impact.toUpperCase()}
              </span>
              <span className="event-probability">
                AI Impact Prob: {event.probability}%
              </span>
              <span className={`event-direction dir-${event.impactDirection}`}>
                {event.impactDirection === "bullish" ? "▲" :
                 event.impactDirection === "bearish" ? "▼" : "•"}
              </span>
            </div>

            {event.forecast !== null && event.previous !== null && (
              <div className="event-values">
                <div className="label">Forecast:</div>
                <div className="value">{event.forecast}{event.unit}</div>
                <div className="label">Previous:</div>
                <div className="value">{event.previous}{event.unit}</div>
                {event.actual !== null && (
                  <>
                    <div className="label">Actual:</div>
                    <div className="value">{event.actual}{event.unit}</div>
                  </>
                )}
              </div>
            )}

            <div className="event-gold-relevance">
              <strong>Gold Impact:</strong> {event.goldRelevance}
            </div>

            <div className="event-time">
              <strong>Expected:</strong> {formatClock(event.scheduledAt, "America/New_York")}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}