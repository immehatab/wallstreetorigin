export type EconomicEvent = {
  id: string;
  title: string;
  country: string;
  countryCode: string; // ISO country code like "US", "EU", "JP"
  impact: "high" | "medium" | "low"; // Expected market impact
  probability: number; // 0-100, AI-estimated probability of significant XAUUSD movement
  actual: number | null; // Actual value when released
  forecast: number | null; // Forecast/expected value
  previous: number | null; // Previous value
  unit: string; // Unit of measurement (%, points, bn, etc.)
  scheduledAt: number; // Timestamp when event is scheduled/released
  importance: number; // 0-100, inherent importance of the indicator
  category:
    | "inflation"      // CPI, PPI, PCE
    | "employment"     // NFP, unemployment, jobs
    | "growth"         // GDP, PMIs
    | "central_bank"   // Interest rates, FOMC, ECB, BOJ, etc.
    | "trade"          // Trade balance, current account
    | "confidence";    // Consumer sentiment, business confidence
  impactDirection:
    | "bullish"    // Expected to push XAUUSD up
    | "bearish"    // Expected to push XAUUSD down
    | "neutral"    // Neutral or unclear direction
    | "mixed";     // Mixed signals
  description: string; // Brief explanation of what the indicator measures
  goldRelevance: string; // Specific explanation of how this affects gold/XAUUSD
};