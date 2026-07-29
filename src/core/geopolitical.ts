export type GeopoliticalItem = {
  id: string;
  title: string;
  type:
    | "person"      // Individual person (e.g., Donald Trump, Jerome Powell)
    | "institution" // Organization (e.g., Federal Reserve, ECB, OPEC)
    | "event"       // Specific happening (e.g., election, summit, conflict)
    | "policy"      // Policy decision or announcement
    | "conflict";   // Geopolitical tension, war, sanctions
  subject:
    | "US"
    | "EU"
    | "UK"
    | "JP"
    | "CN"
    | "RU"
    | "Middle East"
    | "Global"
    | "Other";
  impact: "high" | "medium" | "low"; // Expected market impact on XAUUSD
  probability: number; // 0-100, AI-estimated probability of significant XAUUSD movement
  urgency:
    | "immediate"    // Happening now or within hours
    | "soon"         // Within days
    | "upcoming"     // Within weeks
    | "ongoing";     // Continuing situation
  timestamp: number; // When this item was assessed/updated
  sentiment:
    | "bullish"    // Expected to push XAUUSD up
    | "bearish"    // Expected to push XAUUSD down
    | "neutral";   // Neutral or unclear direction
  confidence: number; // 0-100, confidence in the assessment
  description: string; // Brief description of the person/event/institution
  goldImpact: string; // Specific explanation of how this affects gold/XAUUSD
  keyFactors: string[]; // Key factors driving the assessment
  source: string; // Source of information (news outlet, official statement, etc.)
};