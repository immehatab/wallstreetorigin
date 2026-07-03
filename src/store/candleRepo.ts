import { db } from "./db";
import type { AssetId } from "@/core/types";
import type { Candle, Timeframe } from "@/core/smc";

const upsert = db.prepare(`
  INSERT INTO candles (asset, timeframe, ts, open, high, low, close, volume, source)
  VALUES (@asset, @timeframe, @ts, @open, @high, @low, @close, @volume, @source)
  ON CONFLICT(asset, timeframe, ts) DO UPDATE SET
    open=excluded.open, high=excluded.high, low=excluded.low,
    close=excluded.close, volume=excluded.volume, source=excluded.source
`);

export const writeCandles = db.transaction(
  (asset: AssetId, timeframe: Timeframe, source: string, candles: Candle[]) => {
    for (const c of candles) {
      upsert.run({ asset, timeframe, source, ...c });
    }
    return candles.length;
  },
);

interface CandleRow {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  source: string;
}

const selectRecent = db.prepare(`
  SELECT ts, open, high, low, close, volume, source FROM candles
  WHERE asset = ? AND timeframe = ?
  ORDER BY ts DESC LIMIT ?
`) as unknown as { all: (asset: string, tf: string, limit: number) => CandleRow[] };

/** Returns candles ASCENDING by time (oldest first) — what the engine expects. */
export function getCandles(asset: AssetId, tf: Timeframe, limit = 400): Candle[] {
  const rows = selectRecent.all(asset, tf, limit);
  return rows
    .map((r) => ({
      ts: r.ts,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume,
    }))
    .reverse();
}

export function candleSource(asset: AssetId, tf: Timeframe): string | null {
  const row = selectRecent.all(asset, tf, 1)[0];
  return row?.source ?? null;
}
