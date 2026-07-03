import { db } from "./db";
import type { MacroSeries } from "@/core/macro";

const upsert = db.prepare(`
  INSERT INTO macro_series (key, fred_id, label, category, unit, decimals, value, date, change, change_label, gold_bias, why, updated_at)
  VALUES (@key, @fredId, @label, @category, @unit, @decimals, @value, @date, @change, @changeLabel, @goldBias, @why, @updatedAt)
  ON CONFLICT(key) DO UPDATE SET
    value=excluded.value, date=excluded.date, change=excluded.change,
    change_label=excluded.change_label, gold_bias=excluded.gold_bias,
    why=excluded.why, updated_at=excluded.updated_at
`);

export const writeMacroSeries = db.transaction((rows: MacroSeries[]) => {
  for (const r of rows) upsert.run(r);
});

interface MacroRow {
  key: string;
  fred_id: string;
  label: string;
  category: string;
  unit: string;
  decimals: number;
  value: number;
  date: string;
  change: number | null;
  change_label: string;
  gold_bias: string;
  why: string;
  updated_at: number;
}

const selectAll = db.prepare(
  `SELECT * FROM macro_series`,
) as unknown as { all: () => MacroRow[] };

export function getMacroSeries(): MacroSeries[] {
  return selectAll.all().map((r) => ({
    key: r.key,
    fredId: r.fred_id,
    label: r.label,
    category: r.category as MacroSeries["category"],
    unit: r.unit,
    decimals: r.decimals,
    value: r.value,
    date: r.date,
    change: r.change,
    changeLabel: r.change_label,
    goldBias: r.gold_bias as MacroSeries["goldBias"],
    why: r.why,
    updatedAt: r.updated_at,
  }));
}
