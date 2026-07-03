import { db } from "./db";
import type { BtcOnchain } from "@/core/onchain";

const upsert = db.prepare(`
  INSERT INTO btc_onchain (id, json, updated_at) VALUES (1, @json, @updatedAt)
  ON CONFLICT(id) DO UPDATE SET json=excluded.json, updated_at=excluded.updated_at
`);

export function writeOnchain(data: BtcOnchain): void {
  upsert.run({ json: JSON.stringify(data), updatedAt: data.generatedAt });
}

const select = db.prepare(`SELECT json FROM btc_onchain WHERE id = 1`) as unknown as {
  get: () => { json: string } | undefined;
};

export function getOnchain(): BtcOnchain | null {
  const row = select.get();
  return row ? (JSON.parse(row.json) as BtcOnchain) : null;
}
