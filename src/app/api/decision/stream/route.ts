import { NextResponse } from "next/server";
import { llmStream } from "@/ai/llm";
import { ASSET_MAP } from "@/core/assets";
import type { AssetId } from "@/core/types";
import { gatherContext } from "@/ai/context";

// Configure route for dynamic rendering and longer execution time for LLM calls
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60; // 60 seconds max for streaming responses

/**
 * Streaming endpoint for LLM decisions
 * Returns a text stream of the LLM's raw response for debugging/monitoring
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const asset = (searchParams.get("asset") ?? "XAUUSD") as AssetId;

    if (!ASSET_MAP[asset]) {
      return new Response(`Unknown asset: ${asset}`, { status: 400 });
    }

    // Gather context for the decision
    const { inputs, smcFull, missing } = await gatherContext(asset, Date.now());

    // System prompt (same as in decision.ts)
    const SYSTEM = `You are the decision engine for an institutional gold (XAUUSD) trading desk.
Simulate FIVE specialist agents who each give an INDEPENDENT stance, then DEBATE and reach a consensus:
- Macro: real yields, USD, inflation, policy.
- News: event risk and headline flow.
- Liquidity: SMC/ICT structure, order blocks, FVGs, liquidity pools, premium/discount.
- Quant: alignment/divergence across signals, probability.
- Risk: invalidation, position sizing, worst-case.
RULES: Reason ONLY from the provided data. If a data field is null/missing, say so and LOWER confidence — never invent prices or facts. Derive entry/invalidation/take-profits from the provided SMC levels only; if SMC is missing, set those to null.
Return STRICT JSON only, no prose, matching the requested schema exactly.`;

    // Build user prompt (same logic as in decision.ts)
    const buildUserPrompt = (inputs: any, smc: any, missing: string[]) => {
      // Helper function for SMC levels
      const smcLevels = (smc: any) => {
        if (!smc) return null;
        return {
          timeframe: smc.timeframe,
          lastPrice: smc.lastPrice,
          trend: smc.trend,
          structure: smc.structure.state,
          zone: smc.range.zone,
          positionPct: Math.round(smc.range.positionPct * 100),
          rangeHigh: smc.range.high,
          rangeLow: smc.range.low,
          equilibrium: smc.range.equilibrium,
          lastBOS: smc.structure.lastBOS
            ? { dir: smc.structure.lastBOS.direction, level: smc.structure.lastBOS.brokenLevel }
            : null,
          lastCHOCH: smc.structure.lastCHOCH
            ? { dir: smc.structure.lastCHOCH.direction, level: smc.structure.lastCHOCH.brokenLevel }
            : null,
          orderBlocks: smc.orderBlocks.slice(0, 3).map((o: any) => ({ kind: o.kind, top: o.top, bottom: o.bottom })),
          liquidity: smc.liquidity.filter((l: any) => !l.taken).slice(0, 4).map((l: any) => ({ kind: l.kind, label: l.label, price: l.price })),
        };
      };

      const ctx = {
        asset: inputs.asset,
        livePrice: inputs.price,
        macro: inputs.macroBias,
        news: inputs.topNews,
        smc: smcLevels(smc),
        missingData: missing,
      };
      return `DATA:\n${JSON.stringify(ctx)}\n\nReturn JSON with EXACTLY these keys:
{
 "bias": "Buy|Sell|Neutral",
 "confidence": 0-100, "probability": 0-100,
 "entry": number|null, "invalidation": number|null, "takeProfits": [number,...],
 "riskReward": number|null,
 "expectedSession": "short string", "expectedLiquiditySweep": "short string",
 "expectedNewsImpact": "short string", "worstCase": "short string", "bestCase": "short string",
 "checklist": ["short item", ...],
 "agents": [{"agent":"Macro|News|Liquidity|Quant|Risk","stance":"bullish|bearish|neutral","confidence":0-100,"rationale":"1-2 sentences","keyPoints":["..."]}],
 "debate": ["point of disagreement / how consensus formed", ...],
 "consensusNote": "1-2 sentences"
}`;
    };

    const userPrompt = buildUserPrompt(inputs, smcFull, missing);

    // Set up streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Stream the LLM response
          for await (const chunk of llmStream({
            system: SYSTEM,
            user: userPrompt,
            model: undefined, // Will use default from llm.ts
            maxTokens: 3000,
            temperature: 0.3,
          })) {
            try {
              controller.enqueue(new TextEncoder().encode(chunk));
            } catch (enqueueError: unknown) {
              // If we can't enqueue (e.g., client disconnected or controller closed), break out of the loop
              if ((enqueueError as { code?: string }).code === 'ERR_INVALID_STATE' || 
                  (enqueueError as { message?: string }).message?.includes('Controller is already closed')) {
                // Console log for debugging but don't fail the request since client may have disconnected
                console.log('Client disconnected or controller closed, stopping stream');
                break;
              }
              throw enqueueError;
            }
          }
          controller.close();
        } catch (err) {
          console.error("LLM streaming error:", err);
          // Only error the controller if it's not already closed/errored
          try {
            controller.error(err);
          } catch (errError) {
            // Controller might already be closed/errored, ignore
          }
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    console.error("Error in decision stream endpoint:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "stream failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
