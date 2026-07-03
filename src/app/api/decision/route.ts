import { NextResponse } from "next/server";
import { generateDecision } from "@/ai/decision";
import { llmAvailable } from "@/ai/llm";
import { ASSET_MAP } from "@/core/assets";
import type { AssetId } from "@/core/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// On-demand only (LLM call) — never polled. Give it room to think.
export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const asset = (searchParams.get("asset") ?? "XAUUSD") as AssetId;
    if (!ASSET_MAP[asset]) {
      return NextResponse.json({ error: `unknown asset: ${asset}` }, { status: 400 });
    }
    const decision = await generateDecision(asset, Date.now());
    return NextResponse.json(decision, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "decision failed" },
      { status: 500 },
    );
  }
}

/** Lightweight status for the UI to know if the LLM is wired. */
export async function HEAD() {
  return new NextResponse(null, {
    headers: { "x-llm": llmAvailable() ? "on" : "off" },
  });
}
