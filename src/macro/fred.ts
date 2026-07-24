import { fetchText } from "@/ingestion/adapter";
import {
  MACRO_SERIES,
  type GoldReaction,
  type MacroSeries,
  type MacroSeriesDef,
} from "@/core/macro";
import { writeMacroSeries } from "@/store/macroRepo";
import { log } from "@/lib/logger";

/**
 * Simple in-memory cache with TTL.
 */
class TTLCache<K, V> {
  private map = new Map<K, { value: V; timestamp: number }>();
  private ttlMs: number;

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;
  }

  get(key: K): V | null {
    const item = this.map.get(key);
    if (!item) return null;
    const now = Date.now();
    if (now - item.timestamp > this.ttlMs) {
      this.map.delete(key);
      return null;
    }
    return item.value;
  }

  set(key: K, value: V): void {
    this.map.set(key, { value, timestamp: Date.now() });
  }

  clear(): void {
    this.map.clear();
  }
}

// Cache FRED series for 2 hours (data updates daily)
const fredSeriesCache = new TTLCache<string, MacroSeries | null>(2 * 60 * 60 * 1000);

/**
 * Fetch text with retry logic for transient failures.
 * @param url - The URL to fetch
 * @param opts - Options (timeoutMs, headers)
 * @returns The response text
 */
async function fetchTextWithRetry(
  url: string,
  opts: { timeoutMs?: number; headers?: Record<string, string> } = {}
): Promise<string> {
  const { timeoutMs = 20000, headers = {} } = opts;
  const maxRetries = 3;
  const baseDelayMs = 1000;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchText(url, { timeoutMs, headers });
    } catch (err) {
      lastError = err;
      if (attempt === maxRetries) break;
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, baseDelayMs * 2 ** attempt));
    }
  }
  throw lastError;
}

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
  // Check cache first
  const cached = fredSeriesCache.get(def.fredId);
  if (cached !== null) {
    log.debug(`FRED series ${def.fredId} served from cache`);
    return cached;
  }

  const start = isoDaysAgo(430); // ~14 months: enough for YoY + monthly trend
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${def.fredId}&cosd=${start}`;
  const points = parseCsv(await fetchTextWithRetry(url, { timeoutMs: 20000 }));
  if (points.length === 0) {
    fredSeriesCache.set(def.fredId, null);
    return null;
  }

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

  const result: MacroSeries = {
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

  fredSeriesCache.set(def.fredId, result);
  return result;
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