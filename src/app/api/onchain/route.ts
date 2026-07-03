import { NextResponse } from "next/server";
import { getOnchain } from "@/store/onchainRepo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(
      { data: getOnchain(), serverTime: Date.now() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "onchain failed" },
      { status: 500 },
    );
  }
}
