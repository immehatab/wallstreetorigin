import type { EconomicEvent } from "@/core/economic";
import { llmAvailable, llmComplete, extractJson, AGENT_MODEL } from "@/ai/llm";

// Major economic events that affect gold/XAUUSD with their recurrence patterns
const ECONOMIC_EVENT_PATTERNS = [
  // United States - High Impact
  {
    id: "us_nfp",
    title: "US Non-Farm Payrolls",
    country: "United States",
    countryCode: "US",
    impact: "high" as const,
    category: "employment" as const,
    importance: 95,
    unit: "jobs",
    impactDirection: "bearish" as const, // Better jobs = stronger USD = bearish for gold
    description: "Monthly change in number of employed people in the US",
    goldRelevance: "Strong jobs data typically strengthens USD, putting downward pressure on gold prices",
    // Pattern: First Friday of each month
    pattern: {
      type: "monthly" as const,
      dayOfWeek: 5, // Friday (0=Sunday, 5=Friday)
      weekOfMonth: 1, // First week
      hour: 8,
      minute: 30,
      timezone: "EST" as const
    }
  },
  {
    id: "us_cpi",
    title: "US CPI",
    country: "United States",
    countryCode: "US",
    impact: "high" as const,
    category: "inflation" as const,
    importance: 98,
    unit: "%",
    impactDirection: "bearish" as const, // Higher inflation = higher rates = bearish for gold
    description: "Monthly inflation rate for urban consumers",
    goldRelevance: "Higher-than-expected inflation typically leads to Fed tightening, strengthening USD and pressuring gold prices",
    // Pattern: Usually around 10th-12th day of month
    pattern: {
      type: "monthly" as const,
      dayOfMonth: 11, // Approximate middle of typical range
      hour: 8,
      minute: 30,
      timezone: "EST" as const
    }
  },
  {
    id: "us_pce",
    title: "US PCE Price Index",
    country: "United States",
    countryCode: "US",
    impact: "high" as const,
    category: "inflation" as const,
    importance: 95,
    unit: "%",
    impactDirection: "bearish" as const,
    description: "Monthly change in prices paid by consumers for goods and services",
    goldRelevance: "Fed's preferred inflation metric; higher readings increase likelihood of rate hikes",
    // Pattern: Usually last business day of month
    pattern: {
      type: "monthly" as const,
      dayOfMonth: 28, // Approximate - will adjust to last business day
      hour: 8,
      minute: 30,
      timezone: "EST" as const
    }
  },
  {
    id: "fed_fomc",
    title: "FOMC Interest Rate Decision",
    country: "United States",
    countryCode: "US",
    impact: "high" as const,
    category: "central_bank" as const,
    importance: 100,
    unit: "%",
    impactDirection: "mixed" as const, // Depends on decision and forward guidance
    description: "Federal Open Market Committee decision on short-term interest rates",
    goldRelevance: "Interest rate decisions and accompanying statements directly impact USD and gold",
    // Pattern: 8 times per year, approximately every 6 weeks
    pattern: {
      type: "custom" as const,
      // Specific dates will be generated separately
    }
  },
  {
    id: "us_gdp",
    title: "US GDP Advance Estimate",
    country: "United States",
    countryCode: "US",
    impact: "high" as const,
    category: "growth" as const,
    importance: 90,
    unit: "%",
    impactDirection: "bearish" as const, // Stronger growth = rate hike expectations = bearish for gold
    description: "Quarterly annualized GDP growth rate",
    goldRelevance: "Stronger GDP growth increases likelihood of rate hikes, which is bearish for gold",
    // Pattern: Quarterly, typically last Thursday of month following quarter end
    pattern: {
      type: "quarterly" as const,
      monthOffset: 0, // Month following quarter end
      weekOfMonth: -1, // Last week
      dayOfWeek: 4, // Thursday (0=Sunday, 4=Thursday)
      hour: 8,
      minute: 30,
      timezone: "EST" as const
    }
  },
  {
    id: "us_initial_claims",
    title: "US Initial Jobless Claims",
    country: "United States",
    countryCode: "US",
    impact: "medium" as const,
    category: "employment" as const,
    importance: 75,
    unit: "k",
    impactDirection: "bullish" as const, // More claims = weaker labor market = bullish for gold
    description: "Weekly number of people filing for unemployment insurance for the first time",
    goldRelevance: "Higher claims suggest labor market weakness, which can increase demand for gold as a safe haven",
    // Pattern: Every Thursday
    pattern: {
      type: "weekly" as const,
      dayOfWeek: 4, // Thursday
      hour: 8,
      minute: 30,
      timezone: "EST" as const
    }
  },
  // Eurozone - Medium Impact
  {
    id: "ecb_decision",
    title: "ECB Interest Rate Decision",
    country: "Eurozone",
    countryCode: "EU",
    impact: "high" as const,
    category: "central_bank" as const,
    importance: 85,
    unit: "%",
    impactDirection: "mixed" as const,
    description: "European Central Bank decision on key interest rates",
    goldRelevance: "ECB policy decisions affect EUR strength, which has an inverse relationship with gold prices",
    // Pattern: Every 6 weeks
    pattern: {
      type: "custom" as const,
      // Specific dates calculated based on ECB schedule
    }
  },
  {
    id: "eu_cpi",
    title: "Eurozone CPI Flash Estimate",
    country: "Eurozone",
    countryCode: "EU",
    impact: "high" as const,
    category: "inflation" as const,
    importance: 90,
    unit: "%",
    impactDirection: "bullish" as const, // Higher EURzone inflation = weaker EUR = stronger USD = mixed for gold
    description: "Monthly inflation rate for the Eurozone",
    goldRelevance: "Mixed impact: higher EURzone inflation weakens EUR (bullish for gold via USD strength) but may prompt ECB tightening (bearish for gold)",
    // Pattern: Usually last business day of month
    pattern: {
      type: "monthly" as const,
      dayOfMonth: 28,
      hour: 10,
      minute: 0,
      timezone: "CET" as const
    }
  },
  // UK - Medium Impact
  {
    id: "boe_decision",
    title: "BOE Interest Rate Decision",
    country: "United Kingdom",
    countryCode: "GB",
    impact: "high" as const,
    category: "central_bank" as const,
    importance: 80,
    unit: "%",
    impactDirection: "mixed" as const,
    description: "Bank of England decision on official bank rate",
    goldRelevance: "BOE policy affects GBP strength; higher rates typically strengthen GBP (bearish for gold priced in USD)",
    // Pattern: 8 times per year
    pattern: {
      type: "custom" as const,
      // Specific dates based on BOE calendar
    }
  },
  // China - Lower Impact but growing significance
  {
    id: "china_ppi",
    title: "China PPI",
    country: "China",
    countryCode: "CN",
    impact: "medium" as const,
    category: "inflation" as const,
    importance: 60,
    unit: "%",
    impactDirection: "bullish" as const, // Higher Chinese inflation may increase commodity demand
    description: "Monthly change in prices paid by Chinese producers for goods",
    goldRelevance: "Producer inflation can indicate demand pressures that may support commodity prices including gold",
    // Pattern: Usually around 9th-11th of month
    pattern: {
      type: "monthly" as const,
      dayOfMonth: 10,
      hour: 2,
      minute: 0,
      timezone: "CST" as const
    }
  }
];

// Helper function to add business days (skipping weekends)
function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let daysAdded = 0;

  while (daysAdded < days) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    // Skip Saturday (6) and Sunday (0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysAdded++;
    }
  }

  return result;
}

// Helper function to get nth occurrence of dayOfWeek in month
function getNthWeekday(year: number, month: number, nth: number, dayOfWeek: number): Date {
  // dayOfWeek: 0=Sunday, 1=Monday, ..., 6=Saturday

  // First day of the month
  const firstDay = new Date(year, month, 1);
  const firstDayWeekday = firstDay.getDay();

  // Calculate days to first occurrence of desired weekday
  let daysToFirst = dayOfWeek - firstDayWeekday;
  if (daysToFirst < 0) daysToFirst += 7;

  // First occurrence
  const firstOccurrence = new Date(year, month, 1 + daysToFirst);

  // Nth occurrence
  const result = new Date(firstOccurrence.getTime());
  result.setDate(result.getDate() + (nth - 1) * 7);

  // Check if we're still in the same month
  if (result.getMonth() !== month) {
    // If nth occurrence doesn't exist in this month, return null
    return null;
  }

  return result;
}

// Get timezone offset in minutes for common timezones
function getTimezoneOffset(timezone: string): number {
  switch (timezone) {
    case "EST": return -5 * 60; // Eastern Standard Time
    case "CET": return 1 * 60;  // Central European Time
    case "CST": return 8 * 60;  // China Standard Time
    default: return 0; // UTC
  }
}

// Generate AI-powered probability prediction for an economic event
async function generateEventProbability(event: Omit<EconomicEvent, 'scheduledAt' | 'id'>, scheduledAt: number): Promise<number> {
  // If LLM is not available, fall back to a reasonable default based on impact
  if (!llmAvailable()) {
    // Base probability on impact level
    switch (event.impact) {
      case "high": return 85;
      case "medium": return 65;
      case "low": return 40;
      default: return 50;
    }
  }

  try {
    const now = Date.now();
    const hoursUntil = (scheduledAt - now) / (1000 * 60 * 60);

    // Construct prompt for LLM
    const prompt = `
As an expert financial analyst specializing in precious metals and macroeconomics, analyze the following economic event and estimate the probability (0-100) that it will cause a significant movement (>0.5%) in XAUUSD (gold price) within

Event Details:
- Title: ${event.title}
- Description: ${event.description}
- Impact Level: ${event.impact}
- Country: ${event.country}
- Expected Impact Direction: ${event.impactDirection}
- Gold Relevance: ${event.goldRelevance}
- Hours Until Event: ${hoursUntil.toFixed(1)}

Consider:
1. The inherent market-moving potential of this indicator
2. Current market context (volatility, upcoming events, etc.)
3. Historical significance of similar events
4. The specific mechanism by which this affects gold prices
5. Whether the event is likely to surprise the market

Provide ONLY a JSON object with a single key "probability" containing a number between 0 and 100.
Example: {"probability": 75}
`;

    const response = await llmComplete({
      system: "You are an expert financial analyst specializing in precious metals markets and macroeconomic analysis. Provide only valid JSON responses.",
      user: prompt,
      model: AGENT_MODEL,
      maxTokens: 500,
      temperature: 0.3, // Lower temperature for more consistent predictions
    });

    const result = extractJson<{ probability: number }>(response);
    const probability = Math.max(0, Math.min(100, result.probability));

    // Log for debugging (in real implementation, you'd use proper logging)
    console.log(`AI Probability for ${event.title}: ${probability}%`);

    return probability;
  } catch (error) {
    console.error(`Error generating AI probability for ${event.title}:`, error);
    // Fallback to impact-based probability
    switch (event.impact) {
      case "high": return 85;
      case "medium": return 65;
      case "low": return 40;
      default: return 50;
    }
  }
}

// Generate upcoming economic events for the next 12 months
export function generateUpcomingEconomicEvents(): Promise<EconomicEvent[]> {
  return generateUpcomingEconomicEventsWithAI();
}

async function generateUpcomingEconomicEventsWithAI(): Promise<EconomicEvent[]> {
  const events: EconomicEvent[] = [];
  const now = Date.now();
  const twelveMonthsLater = now + 12 * 30 * 24 * 60 * 60 * 1000; // Approximate

  // Process each event pattern
  for (const pattern of ECONOMIC_EVENT_PATTERNS) {
    let generatedEvents: { date: Date; overrideValues?: Partial<Omit<EconomicEvent, 'scheduledAt'>> }[] = [];

    switch (pattern.pattern.type) {
      case "weekly":
        // Generate weekly events
        for (let d = new Date(); d <= new Date(twelveMonthsLater); d.setDate(d.getDate() + 7)) {
          // Find the next occurrence of the target day of week
          const currentDay = d.getDay();
          const targetDay = pattern.pattern.dayOfWeek;
          let daysUntilTarget = targetDay - currentDay;

          if (daysUntilTarget < 0) daysUntilTarget += 7;

          const eventDate = new Date(d);
          eventDate.setDate(d.getDate() + daysUntilTarget);
          eventDate.setHours(
            pattern.pattern.hour,
            pattern.pattern.minute,
            0,
            0
          );

          // Adjust for timezone
          const tzOffset = getTimezoneOffset(pattern.pattern.timezone);
          eventDate.setMinutes(eventDate.getMinutes() - tzOffset);

          if (eventDate >= new Date(now)) {
            generatedEvents.push({ date: eventDate });
          }
        }
        break;

      case "monthly":
        // Generate monthly events
        for (let m = 0; m < 12; m++) {
          const date = new Date();
          date.setMonth(date.getMonth() + m);

          let eventDate: Date | null = null;

          if (pattern.pattern.dayOfMonth !== undefined) {
            // Fixed day of month
            eventDate = new Date(date.getFullYear(), date.getMonth(), pattern.pattern.dayOfMonth);
          } else if (pattern.pattern.dayOfWeek !== undefined && pattern.pattern.weekOfMonth !== undefined) {
            // Nth weekday of month
            eventDate = getNthWeekday(
              date.getFullYear(),
              date.getMonth(),
              pattern.pattern.weekOfMonth,
              pattern.pattern.dayOfWeek
            );
          }

          if (eventDate) {
            eventDate.setHours(
              pattern.pattern.hour,
              pattern.pattern.minute,
              0,
              0
            );

            // Adjust for timezone
            const tzOffset = getTimezoneOffset(pattern.pattern.timezone);
            eventDate.setMinutes(eventDate.getMinutes() - tzOffset);

            if (eventDate >= new Date(now)) {
              generatedEvents.push({ date: eventDate });
            }
          }
        }
        break;

      case "quarterly":
        // Generate quarterly events
        for (let q = 0; q < 4; q++) {
          const date = new Date();
          date.setMonth(date.getMonth() + q * 3);

          let eventDate: Date | null = null;

          if (pattern.pattern.monthOffset !== undefined) {
            const targetMonth = date.getMonth() + pattern.pattern.monthOffset;
            const targetYear = date.getFullYear() + Math.floor(targetMonth / 12);
            const adjustedMonth = ((targetMonth % 12) + 12) % 12;

            eventDate = new Date(targetYear, adjustedMonth, 1);

            // Find the specific week/day
            if (pattern.pattern.dayOfWeek !== undefined && pattern.pattern.weekOfMonth !== undefined) {
              // Find last occurrence of weekday in month
              if (pattern.pattern.weekOfMonth === -1) {
                // Last week of month
                const nextMonth = new Date(targetYear, adjustedMonth + 1, 1);
                const lastDay = new Date(nextMonth.getTime() - 86400000); // Last day of current month

                // Go backwards to find the target weekday
                let day = new Date(lastDay);
                while (day.getDay() !== pattern.pattern.dayOfWeek) {
                  day.setDate(day.getDate() - 1);
                }
                eventDate = day;
              }
            }
          }

          if (eventDate) {
            eventDate.setHours(
              pattern.pattern.hour,
              pattern.pattern.minute,
              0,
              0
            );

            // Adjust for timezone
            const tzOffset = getTimezoneOffset(pattern.pattern.timezone);
            eventDate.setMinutes(eventDate.getMinutes() - tzOffset);

            if (eventDate >= new Date(now)) {
              generatedEvents.push({ date: eventDate });
            }
          }
        }
        break;

      case "custom":
        // Handle special cases like FOMC, ECB, etc.
        // For now, we'll generate placeholder dates based on typical schedules
        // In a production system, these would be updated periodically from official sources

        if (pattern.id === "fed_fomc") {
          // FOMC meets approximately every 6 weeks (8 times per year)
          const meetingDates = [
            // 2026 dates (approximate)
            new Date(2026, 0, 28), // Jan 28
            new Date(2026, 2, 18), // Mar 18
            new Date(2026, 4, 6),  // May 6
            new Date(2026, 5, 18), // Jun 18
            new Date(2026, 7, 29), // Jul 29
            new Date(2026, 9, 17), // Sep 17
            new Date(2026, 10, 28),// Oct 28
            new Date(2026, 11, 16) // Dec 16
          ];

          for (const date of meetingDates) {
            if (date >= new Date(now)) {
              // Set to 2:00 PM EST (typical FOMC announcement time)
              const eventDate = new Date(date);
              eventDate.setHours(14, 0, 0, 0); // 2:00 PM

              // Adjust for EST
              eventDate.setMinutes(eventDate.getMinutes() + 5 * 60); // Convert to UTC

              generatedEvents.push({
                date: eventDate,
                overrideValues: {
                  actual: null,
                  forecast: 5.25, // Placeholder - would be updated closer to date
                  previous: 5.25   // Would be updated after meeting
                }
              });
            }
          }
        } else if (pattern.id === "ecb_decision") {
          // ECB meets every 6 weeks
          const meetingDates = [
            // 2026 dates (approximate)
            new Date(2026, 0, 15), // Jan 15
            new Date(2026, 2, 5),  // Mar 5
            new Date(2026, 3, 16), // Apr 16
            new Date(2026, 5, 6),  // May 6
            new Date(2026, 6, 17), // Jun 17
            new Date(2026, 8, 5),  // Aug 5
            new Date(2026, 9, 16), // Sep 16
            new Date(2026, 11, 4), // Nov 4
            new Date(2026, 12, 16) // Dec 16
          ];

          for (const date of meetingDates) {
            if (date >= new Date(now)) {
              // Set to 1:45 PM CET (typical ECB announcement time)
              const eventDate = new Date(date);
              eventDate.setHours(13, 45, 0, 0); // 1:45 PM

              // Adjust for CET
              eventDate.setMinutes(eventDate.getMinutes() - 1 * 60); // Convert to UTC

              generatedEvents.push({
                date: eventDate
              });
            }
          }
        } else if (pattern.id === "boe_decision") {
          // BOE meets approximately every 6 weeks
          const meetingDates = [
            // 2026 dates (approximate)
            new Date(2026, 0, 1),   // Jan 1
            new Date(2026, 2, 12),  // Feb 12
            new Date(2026, 3, 25),  // Mar 25
            new Date(2026, 5, 6),   // May 6
            new Date(2026, 6, 17),  // Jun 17
            new Date(2026, 7, 28),  // Jul 28
            new Date(2026, 9, 8),   // Sep 8
            new Date(2026, 10, 20), // Oct 20
            new Date(2026, 12, 1)   // Dec 1
          ];

          for (const date of meetingDates) {
            if (date >= new Date(now)) {
              // Set to 12:00 PM GMT (typical BOE announcement time)
              const eventDate = new Date(date);
              eventDate.setHours(12, 0, 0, 0); // 12:00 PM

              // GMT is UTC+0 in winter, UTC+1 in summer (BST)
              // Simplified: assume UTC for calculation

              generatedEvents.push({
                date: eventDate
              });
            }
          }
        }
        break;
    }

    // Convert generated events to EconomicEvent format with AI-powered probabilities
    for (const { date, overrideValues } of generatedEvents) {
      // Avoid duplicates (same event type on same day)
      const existingIndex = events.findIndex(e =>
        e.id === `${pattern.id}_${date.getFullYear()}_${date.getMonth() + 1}_${date.getDate()}` &&
        e.scheduledAt === date.getTime()
      );

      if (existingIndex === -1) {
        // Generate AI-powered probability for this event
        const baseEvent: Omit<EconomicEvent, 'scheduledAt'> = {
          id: `${pattern.id}_${date.getFullYear()}_${date.getMonth() + 1}_${date.getDate()}`,
          title: pattern.title,
          country: pattern.country,
          countryCode: pattern.countryCode,
          impact: pattern.impact,
          country: pattern.country,
          countryCode: pattern.countryCode,
          impact: pattern.impact,
          category: pattern.category,
          importance: pattern.importance,
          unit: pattern.unit,
          impactDirection: pattern.impactDirection,
          description: pattern.description,
          goldRelevance: pattern.goldRelevance,
          // Probability will be set below after AI analysis
          probability: 80, // Temporary default, will be overridden
          actual: null,
          forecast: overrideValues?.forecast ?? null,
          previous: overrideValues?.previous ?? null
        };

        // Generate the event without scheduledAt first so we can pass it to AI
        const eventWithoutSchedule = { ...baseEvent };

        // Get AI-powered probability
        const probability = await generateEventProbability(eventWithoutSchedule, date.getTime());

        events.push({
          ...baseEvent,
          scheduledAt: date.getTime(),
          probability: probability // Use AI-generated probability
        });
      }
    }
  }

  // Sort by date
  events.sort((a, b) => a.scheduledAt - b.scheduledAt);

  return events;
}

// Get current economic events (for API route)
export function getCurrentEconomicEvents(): Promise<EconomicEvent[]> {
  return getCurrentEconomicEventsWithAI();
}

async function getCurrentEconomicEventsWithAI(): Promise<EconomicEvent[]> {
  const now = Date.now();
  const oneWeekFromNow = now + 7 * 24 * 60 * 60 * 1000; // Next 7 days

  const allEvents = await generateUpcomingEconomicEventsWithAI();
  return allEvents.filter(
    event => event.scheduledAt >= now && event.scheduledAt <= oneWeekFromNow
  );
}