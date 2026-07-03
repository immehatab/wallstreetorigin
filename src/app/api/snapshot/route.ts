import { NextResponse } from "next/server";
import { getSnapshot } from "@/store/repo";

// Always fresh, always Node runtime (better-sqlite3 is native).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const snapshot = getSnapshot(Date.now());
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "snapshot failed" },
      { status: 500 },
    );
  }
}
