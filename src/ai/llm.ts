// ============================================================
//  LLM client — Aerolink (Anthropic-compatible /v1/messages).
//  Reads ANTHROPIC_BASE_URL + ANTHROPIC_API_KEY from env.
//  Sends BOTH x-api-key and Bearer so it works regardless of which
//  scheme the router expects (verified: auth passes, models are
//  claude-opus-4-7 / haiku-4-5 / sonnet-4-6 / sonnet-5).
// ============================================================

export const AGENT_MODEL = process.env.LLM_AGENT_MODEL ?? "claude-haiku-4-5-20251001";
export const CHAIR_MODEL = process.env.LLM_CHAIR_MODEL ?? "claude-sonnet-5";

export function llmAvailable(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_BASE_URL);
}

interface LlmOpts {
  system: string;
  user: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

/** One completion. Returns the assistant text. Throws on transport/API error. */
export async function llmComplete(opts: LlmOpts): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  const base = (process.env.ANTHROPIC_BASE_URL ?? "").replace(/\/+$/, "");
  if (!key || !base) throw new Error("LLM not configured (ANTHROPIC_API_KEY/BASE_URL)");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 45_000);
  try {
    const res = await fetch(`${base}/v1/messages`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "x-api-key": key,
        Authorization: `Bearer ${key}`,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: opts.model ?? AGENT_MODEL,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0.4,
        system: opts.system,
        messages: [{ role: "user", content: opts.user }],
      }),
    });

    const raw = await res.text();
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${raw.slice(0, 200)}`);

    const json = JSON.parse(raw) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = (json.content ?? [])
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text)
      .join("")
      .trim();
    if (!text) throw new Error("LLM returned empty content");
    return text;
  } finally {
    clearTimeout(timer);
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
