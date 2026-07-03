import { NextResponse } from "next/server";
import { analyzeSmc } from "@/smc/engine";
import { getCandles } from "@/store/candleRepo";
import { ASSET_MAP } from "@/core/assets";
import type { AssetId } from "@/core/types";
import type { Timeframe } from "@/core/smc";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TFS: Timeframe[] = ["H1", "H4", "D1"];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const asset = (searchParams.get("asset") ?? "XAUUSD") as AssetId;
    const tf = (searchParams.get("tf") ?? "H1") as Timeframe;

    if (!ASSET_MAP[asset]) {
      return NextResponse.json({ error: `unknown asset: ${asset}` }, { status: 400 });
    }
    if (!TFS.includes(tf)) {
      return NextResponse.json({ error: `unknown timeframe: ${tf}` }, { status: 400 });
    }

    const analysis = analyzeSmc(asset, tf, Date.now());
    // Attach the last ~180 candles so the chart can render the overlays.
    const candles = getCandles(asset, tf, 180);
    return NextResponse.json(
      { ...analysis, candles },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "smc failed" },
      { status: 500 },
    );
  }
}
