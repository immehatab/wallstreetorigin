import { NextResponse } from "next/server";
import { getMacroSeries } from "@/store/macroRepo";
import { computeMacroBias } from "@/macro/signals";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const series = getMacroSeries();
    const bias = computeMacroBias(series);
    return NextResponse.json(
      { series, bias, serverTime: Date.now() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "macro failed" },
      { status: 500 },
    );
  }
}
