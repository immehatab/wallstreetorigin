import type { GeopoliticalItem } from "@/core/geopolitical";

// Mock data - in production this would come from a database or external API
const MOCK_GEOPOLITICAL_ITEMS: GeopoliticalItem[] = [
  {
    id: "us_fed_powell_speech_aug_2026",
    title: "Fed Chair Jerome Powell Congressional Testimony",
    type: "person",
    subject: "US",
    impact: "high",
    probability: 88,
    urgency: "soon",
    timestamp: Date.now(),
    sentiment: "neutral",
    confidence: 75,
    description: "Jeremy Powell testifies before Congressional banking committee",
    goldImpact: "Any hints of future rate cuts would be bullish for gold; hawkish remarks would be bearish",
    keyFactors: [
      "Interest rate outlook",
      "Inflation assessment",
      "Labor market views",
      "Forward guidance clues"
    ],
    source: "Federal Reserve",
  },
  {
    id: "middle_east_conflict_escalation",
    title: "Escalation in Strait of Hormuz Tensions",
    type: "event",
    subject: "Middle East",
    impact: "high",
    probability: 72,
    urgency: "ongoing",
    timestamp: Date.now() - 12 * 60 * 60 * 1000,
    sentiment: "bullish",
    confidence: 80,
    description: "Increased naval presence and verbal threats in critical oil shipping chokepoint",
    goldImpact: "Geopolitical instability in oil-producing regions traditionally increases safe-haven demand for gold",
    keyFactors: [
      "Oil supply disruption risk",
      "Shipping insurance costs",
      "Regional alliance posturing",
      "US military response options"
    ],
    source: "International Maritime Bureau",
  },
  {
    id: "china_taiwan_tension_july_2026",
    title: "China PLA Exercises Near Taiwan",
    type: "event",
    subject: "CN",
    impact: "medium",
    probability: 45,
    urgency: "soon",
    timestamp: Date.now() + 24 * 60 * 60 * 1000,
    sentiment: "bullish",
    confidence: 60,
    description: "People's Liberation Army announces live-fire drills in Taiwan Strait",
    goldImpact: "Cross-strait tensions increase geopolitical risk premium, benefiting safe-haven assets like gold",
    keyFactors: [
      "Taiwan Strait militarization",
      "US arms sales to Taiwan",
      "Cross-strait diplomatic relations",
      "Global supply chain concerns"
    ],
    source: "Ministry of National Defense (China)",
  },
  {
    id: "ecb_lagarde_speech_sep_2026",
    title: "ECB President Lagarde Speech on Euro Outlook",
    type: "person",
    subject: "EU",
    impact: "medium",
    probability: 55,
    urgency: "upcoming",
    timestamp: Date.now() + 5 * 24 * 60 * 60 * 1000,
    sentiment: "neutral",
    confidence: 70,
    description: "Christine Lagarde speaks at European Banking Congress",
    goldImpact: "ECB monetary policy stance affects EUR strength, which inversely correlates with gold USD price",
    keyFactors: [
      "Interest rate policy",
      "Eurozone growth outlook",
      "Inflation persistence views",
      "Banking sector stability"
    ],
    source: "European Central Bank",
  },
  {
    id: "us_election_polling_aug_2026",
    title: "Presidential Election Polling Shift",
    type: "event",
    subject: "US",
    impact: "medium",
    probability: 38,
    urgency: "ongoing",
    timestamp: Date.now(),
    sentiment: "bullish",
    confidence: 55,
    description: "Latest polling shows unexpected shifts in key battleground states",
    goldImpact: "Election uncertainty increases market volatility and safe-haven demand for gold",
    keyFactors: [
      "Policy uncertainty",
      "Institutional credibility concerns",
      "Transition risk premium",
      "Media narrative volatility"
    ],
    source: "Multiple Polling Aggregators",
  },
  {
    id: "opec_plus_meeting_sep_2026",
    title: "OPEC+ Production Decision Meeting",
    type: "event",
    subject: "Global",
    impact: "medium",
    probability: 52,
    urgency: "upcoming",
    timestamp: Date.now() + 10 * 24 * 60 * 60 * 1000,
    sentiment: "bullish",
    confidence: 65,
    description: "OPEC+ ministers meet to discuss quota adjustments for Q4 2026",
    goldImpact: "Oil price movements influence inflation expectations and thus gold's real yield opportunity cost",
    keyFactors: [
      "Global oil demand outlook",
      "Non-member compliance",
      "Geopolitical compliance factors",
      "Spare production capacity levels"
    ],
    source: "OPEC Secretariat",
  },
];

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    // Filter for relevant items (ongoing, soon, upcoming)
    const now = Date.now();
    const oneWeekFromNow = now + 7 * 24 * 60 * 60 * 1000;
    const relevantItems = MOCK_GEOPOLITICAL_ITEMS.filter(
      (item) =>
        (item.urgency === "ongoing" ||
         item.urgency === "immediate" ||
         item.urgency === "soon" ||
         item.urgency === "upcoming") &&
        item.timestamp >= now - 24 * 60 * 60 * 1000 && // Not older than 1 day
        item.timestamp <= oneWeekFromNow
    );

    // Sort by urgency and timestamp
    const urgencyOrder: Record<string, number> = {
      immediate: 0,
      soon: 1,
      upcoming: 2,
      ongoing: 3
    };

    relevantItems.sort((a, b) => {
      const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      return a.timestamp - b.timestamp;
    });

    return new Response(JSON.stringify(relevantItems), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Failed to fetch geopolitical data" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}