import type { EconomicEvent } from "@/core/economic";

// Mock data - in production this would come from a database or external API
const MOCK_ECONOMIC_EVENTS: EconomicEvent[] = [
  {
    id: "us_nfp_jul_2026",
    title: "US Non-Farm Payrolls",
    country: "United States",
    countryCode: "US",
    impact: "high",
    probability: 85, // AI-estimated probability of significant XAUUSD movement
    actual: null,
    forecast: 185000,
    previous: 206000,
    unit: "jobs",
    scheduledAt: Date.now() + 2 * 60 * 60 * 1000, // 2 hours from now
    importance: 95,
    category: "employment",
    impactDirection: "bearish", // Better jobs = stronger USD = bearish for gold
    description: "Monthly change in number of employed people in the US",
    goldRelevance: "Strong jobs data typically strengthens USD, putting downward pressure on gold prices",
  },
  {
    id: "eu_cpi_jul_2026",
    title: "Eurozone CPI Flash Estimate",
    country: "Eurozone",
    countryCode: "EU",
    impact: "high",
    probability: 78,
    actual: null,
    forecast: 2.5,
    previous: 2.6,
    unit: "%",
    scheduledAt: Date.now() + 5 * 60 * 60 * 1000, // 5 hours from now
    importance: 90,
    category: "inflation",
    impactDirection: "bullish", // Higher inflation in EURzone = weaker EUR = stronger USD = mixed for gold
    description: "Monthly inflation rate for the Eurozone",
    goldRelevance: "Mixed impact: higher EURzone inflation weakens EUR (bullish for gold via USD strength) but may prompt ECB tightening (bearish for gold)",
  },
  {
    id: "us_cpi_jul_2026",
    title: "US CPI",
    country: "United States",
    countryCode: "US",
    impact: "high",
    probability: 92,
    actual: null,
    forecast: 3.0,
    previous: 3.0,
    unit: "%",
    scheduledAt: Date.now() + 24 * 60 * 60 * 1000, // 1 day from now
    importance: 98,
    category: "inflation",
    impactDirection: "bearish", // Higher inflation = higher rates = bearish for gold
    description: "Monthly inflation rate for urban consumers",
    goldRelevance: "Higher-than-expected inflation typically leads to Fed tightening, strengthening USD and pressuring gold prices",
  },
  {
    id: "fed_fomc_aug_2026",
    title: "FOMC Interest Rate Decision",
    country: "United States",
    countryCode: "US",
    impact: "high",
    probability: 95,
    actual: null,
    forecast: 5.25,
    previous: 5.25,
    unit: "%",
    scheduledAt: Date.now() + 3 * 24 * 60 * 60 * 1000, // 3 days from now
    importance: 100,
    category: "central_bank",
    impactDirection: "bullish", // Hold/cut = bullish, hike = bearish (forecast suggests hold)
    description: "Federal Open Market Committee decision on short-term interest rates",
    goldRelevance: "No change in rates expected, but any hints of future cuts would be bullish for gold while hawkish talk would be bearish",
  },
  {
    id: "us_gdp_q2_2026",
    title: "US GDP Advance Estimate Q2",
    country: "United States",
    countryCode: "US",
    impact: "medium",
    probability: 65,
    actual: null,
    forecast: 2.1,
    previous: 1.4,
    unit: "%",
    scheduledAt: Date.now() + 48 * 60 * 60 * 1000, // 2 days from now
    importance: 85,
    category: "growth",
    impactDirection: "bearish", // Stronger growth = rate hike expectations = bearish for gold
    description: "Quarterly annualized GDP growth rate",
    goldRelevance: "Stronger GDP growth increases likelihood of rate hikes, which is bearish for gold",
  },
];

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    // Filter for upcoming events (within next 7 days)
    const now = Date.now();
    const oneWeekFromNow = now + 7 * 24 * 60 * 60 * 1000;
    const upcomingEvents = MOCK_ECONOMIC_EVENTS.filter(
      (event) => event.scheduledAt >= now && event.scheduledAt <= oneWeekFromNow
    );

    // Sort by scheduled time
    upcomingEvents.sort((a, b) => a.scheduledAt - b.scheduledAt);

    return new Response(JSON.stringify(upcomingEvents), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Failed to fetch economic events" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}