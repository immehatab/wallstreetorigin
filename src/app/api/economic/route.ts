import type { EconomicEvent } from "@/core/economic";
import { getCurrentEconomicEvents } from "@/lib/economicEvents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const events = await getCurrentEconomicEvents();
    return new Response(JSON.stringify(events), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (err) {
    console.error("Error fetching economic events:", err);
    return new Response(JSON.stringify({ error: "Failed to fetch economic events" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}