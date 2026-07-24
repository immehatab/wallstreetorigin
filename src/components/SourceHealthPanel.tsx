import { SOURCE_BY_ID } from "@/core/registry";
import type { SourceHealth } from "@/core/types";
import { formatAge } from "@/lib/format";

function statusLabel(s: SourceHealth["status"]): string {
  switch (s) {
    case "fresh": return "FRESH";
    case "delayed": return "DELAYED";
    case "stale": return "STALE";
    case "offline": return "OFFLINE";
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
  // Fresh/delayed/stale/offline first, unconfigured last.
  const rank: Record<string, number> = { fresh: 0, delayed: 1, stale: 2, offline: 3, unconfigured: 4 };
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
