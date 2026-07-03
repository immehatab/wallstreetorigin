import { SOURCE_BY_ID } from "@/core/registry";
import type { SourceHealth } from "@/core/types";
import { formatAge } from "@/lib/format";

function statusLabel(s: SourceHealth["status"]): string {
  switch (s) {
    case "live": return "LIVE";
    case "degraded": return "DEGRADED";
    case "down": return "DOWN";
    case "unconfigured": return "NOT WIRED";
  }
}

export function SourceHealthPanel({
  sources,
  now,
}: {
  sources: SourceHealth[];
  now: number;
}) {
  // Live/degraded/down first, unconfigured last.
  const rank: Record<string, number> = { live: 0, degraded: 1, down: 2, unconfigured: 3 };
  const ordered = [...sources].sort((a, b) => rank[a.status] - rank[b.status]);

  return (
    <div className="sources">
      {ordered.map((h) => {
        const def = SOURCE_BY_ID[h.id];
        const unconf = h.status === "unconfigured";
        return (
          <div key={h.id} className={`shealth ${unconf ? "unconf" : ""}`}>
            <span className={`dot ${h.status}`} />
            <div className="body">
              <div className="name">
                {def?.name ?? h.id}
                <span className="cat">{def?.category ?? "?"}</span>
                <span style={{ marginLeft: "auto", fontSize: 9, color: "var(--muted)" }}>
                  {statusLabel(h.status)}
                </span>
              </div>
              {unconf ? (
                <div className="stat">
                  {def?.requiresKey ? (
                    <>needs <b className="keyhint">{def.keyEnv}</b> · {def?.note}</>
                  ) : (
                    def?.note
                  )}
                </div>
              ) : (
                <>
                  <div className="stat">
                    <b>{h.quotesLastCycle}</b> quotes/cycle · latency{" "}
                    <b>{h.lastLatencyMs ?? "—"}ms</b> · last ok{" "}
                    <b>{h.lastSuccess ? formatAge(now - h.lastSuccess) : "never"}</b>
                    {h.lastSuccess ? " ago" : ""}
                  </div>
                  {h.lastError ? (
                    <div className="stat err">
                      ⚠ {h.lastError.slice(0, 80)}
                      {h.consecutiveFailures > 0 ? ` (×${h.consecutiveFailures})` : ""}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
