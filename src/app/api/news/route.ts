import { NextResponse } from "next/server";
import { getRecentNews, getTopNews } from "@/store/newsRepo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(
      { items: getRecentNews(40), top: getTopNews(6), serverTime: Date.now() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "news failed" },
      { status: 500 },
    );
  }
}
