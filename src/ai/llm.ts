// ============================================================
//  LLM client — NVIDIA NIM using OpenAI SDK
//  Uses NVIDIA NIM endpoint with nemotron-3-super-120b model
// ============================================================

import OpenAI from "openai";

// NVIDIA NIM configuration
const client = new OpenAI({
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: "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"
});

// Model configuration - export as AGENT_MODEL for compatibility with decision.ts
export const AGENT_MODEL = "nvidia/nemotron-3-super-120b-a12b";

/** Check if LLM is configured (always true for NVIDIA NIM) */
export function llmAvailable(): boolean {
  return true; // NVIDIA NIM is always configured with hardcoded credentials
}

interface LlmOpts {
  system: string;
  user: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  timeoutMs?: number;
  stream?: boolean;
}

/** One completion. Returns the assistant text. Throws on transport/API error. */
export async function llmComplete(opts: LlmOpts): Promise<string> {
  try {
    const completion = await client.chat.completions.create({
      model: opts.model ?? AGENT_MODEL,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user }
      ],
      max_completion_tokens: opts.maxTokens ?? 16384,
      temperature: opts.temperature ?? 1,
      top_p: opts.topP ?? 0.95,
      stream: false // Non-streaming for simpler handling
    });

    return completion.choices[0]?.message?.content ?? "";
  } catch (err) {
    throw new Error(`LLM error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Streaming completion. Returns a stream of text chunks. */
export async function* llmStream(opts: LlmOpts): AsyncGenerator<string, void, unknown> {
  try {
    const stream = await client.chat.completions.create({
      model: opts.model ?? AGENT_MODEL,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user }
      ],
      max_completion_tokens: opts.maxTokens ?? 16384,
      temperature: opts.temperature ?? 1,
      top_p: opts.topP ?? 0.95,
      stream: true // Enable streaming
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  } catch (err) {
    throw new Error(`LLM streaming error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Parse a JSON object from an LLM reply, tolerating ```json fences/prose. */
export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON object in LLM reply");
  return JSON.parse(body.slice(start, end + 1)) as T;
}
