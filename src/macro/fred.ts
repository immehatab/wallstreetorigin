import { fetchText } from "@/ingestion/adapter";
import {
  MACRO_SERIES,
  type GoldReaction,
  type MacroSeries,
  type MacroSeriesDef,
} from "@/core/macro";
import { writeMacroSeries } from "@/store/macroRepo";

/**
 * FRED macro adapter — KEYLESS via the fredgraph CSV export
 * (fredgraph.csv?id=SERIES). Verified live 2026-07-02. If
 * FRED_API_KEY is later added, a keyed path could replace this for
 * higher limits, but the CSV export needs no key at all.
 */

interface Point {
  date: string;
  value: number;
}

function parseCsv(csv: string): Point[] {
  const lines = csv.trim().split("\n");
  const out: Point[] = [];
  // First line is the header: "observation_date,SERIES" (or "DATE,SERIES").
  for (let i = 1; i < lines.length; i++) {
    const [date, raw] = lines[i].split(",");
    if (!date || raw == null) continue;
    const v = Number(raw);
    if (raw.trim() === "." || !Number.isFinite(v)) continue; // FRED marks gaps with "."
    out.push({ date: date.trim(), value: v });
  }
  return out; // ascending by date (FRED default)
}

/** Nearest observation at or before (latestDate - days). */
function pointDaysBefore(points: Point[], days: number): Point | null {
  if (points.length === 0) return null;
  const latestMs = Date.parse(points[points.length - 1].date);
  const targetMs = latestMs - days * 86_400_000;
  for (let i = points.length - 1; i >= 0; i--) {
    if (Date.parse(points[i].date) <= targetMs) return points[i];
  }
  return null;
}

function classifyGoldBias(
  change: number | null,
  value: number,
  unit: string,
  goldOnRise: GoldReaction,
): GoldReaction {
  if (change == null || goldOnRise === "neutral") return "neutral";
  // Deadband: ignore noise. 2bps for %-series, 0.3% relative otherwise.
  const rel = unit === "%" ? Math.abs(change) : value !== 0 ? Math.abs(change / value) : 0;
  const deadband = unit === "%" ? 0.02 : 0.003;
  if (rel < deadband) return "neutral";
  const rising = change > 0;
  return rising === (goldOnRise === "bullish") ? "bullish" : "bearish";
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

async function fetchSeries(def: MacroSeriesDef): Promise<MacroSeries | null> {
  const start = isoDaysAgo(430); // ~14 months: enough for YoY + monthly trend
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${def.fredId}&cosd=${start}`;
  const points = parseCsv(await fetchText(url, { timeoutMs: 9000 }));
  if (points.length === 0) return null;

  const latest = points[points.length - 1];
  let value = latest.value;
  let change: number | null = null;
  let changeLabel = "30d";

  if (def.yoy) {
    // value = latest YoY %, change = acceleration vs the prior month's YoY.
    const y0 = pointDaysBefore(points, 365);
    const m1 = pointDaysBefore(points, 30);
    const y1 = pointDaysBefore(points, 395);
    if (y0) {
      value = (latest.value / y0.value - 1) * 100;
      if (m1 && y1) {
        const prevYoY = (m1.value / y1.value - 1) * 100;
        change = value - prevYoY;
      }
    }
    changeLabel = "YoY Δ";
  } else {
    const past = pointDaysBefore(points, 30);
    change = past ? latest.value - past.value : null;
  }

  return {
    key: def.key,
    fredId: def.fredId,
    label: def.label,
    category: def.category,
    unit: def.unit,
    decimals: def.decimals,
    value,
    date: latest.date,
    change,
    changeLabel,
    goldBias: classifyGoldBias(change, value, def.unit, def.goldOnRise),
    why: def.why,
    updatedAt: Date.now(),
  };
}

/** Scheduler job: fetch all series (sequential, gentle) and persist. */
export async function runFredJob(): Promise<number> {
  const rows: MacroSeries[] = [];
  let lastErr: unknown = null;
  for (const def of MACRO_SERIES) {
    try {
      const s = await fetchSeries(def);
      if (s) rows.push(s);
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  if (rows.length === 0) throw new Error(`fred: no series fetched (${lastErr})`);
  writeMacroSeries(rows);
  return rows.length;
}
