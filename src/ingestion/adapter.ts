import type { AssetId, Quote } from "@/core/types";

/** Contract every price source implements. Keep them pure: fetch → normalize. */
export interface Adapter {
  id: string;
  /** Pull the latest quotes. Throw on total failure; return [] only if legitimately empty. */
  poll(): Promise<Quote[]>;
}

export class FetchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "FetchError";
  }
}

/** JSON fetch with a hard timeout and a browser-ish UA (Yahoo rejects bare clients). */
export async function fetchJson<T = unknown>(
  url: string,
  opts: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<T> {
  const { timeoutMs = 8000, headers = {} } = opts;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
        Accept: "application/json,text/plain,*/*",
        // Undici omits Accept-Language by default; Yahoo 429s clients without
        // it. This single header is the difference between 200 and blocked.
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        ...headers,
      },
      cache: "no-store",
    });
    if (!res.ok) throw new FetchError(`HTTP ${res.status} for ${url}`, res.status);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Retry a function with exponential backoff.
 * @param fn - Async function to retry
 * @param retries - Number of retry attempts (default 3)
 * @param delayMs - Base delay in milliseconds (default 1000)
 * @returns The result of the function
 * @throws The last error if all retries fail
 */
export async function retryFn<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i === retries) break;
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, delayMs * 2 ** i));
    }
  }
  throw lastError;
}

/**
 * curl-backed JSON fetch. Yahoo's Akamai bot manager blocks Node's
 * undici TLS fingerprint (429) while accepting curl's — verified
 * back-to-back on 2026-07-02. For those hosts we shell out to curl,
 * which is guaranteed present on macOS/Linux. Native fetch stays the
 * default for every well-behaved source (Binance, gold-api).
 */
export async function curlJson<T = unknown>(
  url: string,
  opts: { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 9000 } = opts;
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const run = promisify(execFile);
  const secs = Math.ceil(timeoutMs / 1000);

  const { stdout } = await run(
    "curl",
    [
      "-s",
      "--compressed",
      "--max-time",
      String(secs),
      "-H",
      "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
      "-H",
      "Accept: application/json,text/plain,*/*",
      "-H",
      "Accept-Language: en-US,en;q=0.9",
      "--fail", // non-2xx -> non-zero exit -> throw
      url,
    ],
    { timeout: timeoutMs + 1500, maxBuffer: 8 * 1024 * 1024 },
  );

  if (!stdout) throw new FetchError(`empty curl body for ${url}`);
  return JSON.parse(stdout) as T;
}

/** Native TEXT fetch (CSV/XML) for well-behaved hosts (e.g. FRED). */
export async function fetchText(
  url: string,
  opts: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<string> {
  const { timeoutMs = 9000, headers = {} } = opts;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
        Accept: "text/csv,text/plain,application/xml,*/*",
        "Accept-Language": "en-US,en;q=0.9",
        ...headers,
      },
      cache: "no-store",
    });
    if (!res.ok) throw new FetchError(`HTTP ${res.status} for ${url}`, res.status);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/** curl-backed TEXT fetch (CSV, XML/RSS). Same rationale as curlJson. */
export async function curlText(
  url: string,
  opts: { timeoutMs?: number } = {},
): Promise<string> {
  const { timeoutMs = 9000 } = opts;
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const run = promisify(execFile);
  const secs = Math.ceil(timeoutMs / 1000);

  // NOTE: no --compressed here. FRED's CSV endpoint returns a broken
  // encoding under --compressed (curl aborts, http 000); plain works.
  const { stdout } = await run(
    "curl",
    [
      "-sL",
      // Force HTTP/1.1: FRED's server throws an HTTP/2 stream error
      // (curl exit 92) under execFile. 1.1 is reliable for CSV/RSS.
      "--http1.1",
      "--max-time",
      String(secs),
      "-H",
      "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
      "-H",
      "Accept-Language: en-US,en;q=0.9",
      "--fail",
      url,
    ],
    { timeout: timeoutMs + 1500, maxBuffer: 16 * 1024 * 1024 },
  );
  if (!stdout) throw new FetchError(`empty curl body for ${url}`);
  return stdout;
}

/** Convenience: build a normalized Quote; changePct/bid/ask/currency default. */
export function makeQuote(p: {
  asset: Quote["asset"];
  price: number;
  source: string;
  sourceSymbol: string;
  ts: number;
  changePct?: number | null;
  bid?: number | null;
  ask?: number | null;
  currency?: string;
}): Quote {
  return {
    asset: p.asset,
    price: p.price,
    changePct: p.changePct ?? null,
    bid: p.bid ?? null,
    ask: p.ask ?? null,
    currency: p.currency ?? "USD",
    source: p.source,
    sourceSymbol: p.sourceSymbol,
    ts: p.ts,
    ingestedAt: Date.now(),
  };
}
