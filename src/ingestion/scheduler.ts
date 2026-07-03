import { SOURCES } from "@/core/registry";
import type { SourceHealth } from "@/core/types";
import { upsertHealth, writeQuotes } from "@/store/repo";
import type { Adapter } from "./adapter";
import { binanceAdapter } from "./adapters/binance";
import { goldApiAdapter } from "./adapters/goldapi";
import { yahooAdapter } from "./adapters/yahoo";
import { runFredJob } from "@/macro/fred";
import { runNewsJob } from "@/news/engine";
import { runBinanceCandlesJob, runYahooCandlesJob } from "./candles";
import { runOnchainJob } from "@/onchain/binanceFutures";

/**
 * A Job fetches from one source, persists its own data, and returns how
 * many records it wrote. This decouples scheduling/health/backoff from
 * the data TYPE — price, macro, and news all schedule identically.
 */
type Job = () => Promise<number>;

function priceJob(adapter: Adapter): Job {
  return async () => {
    const quotes = await adapter.poll();
    if (quotes.length > 0) writeQuotes(quotes);
    return quotes.length;
  };
}

const JOBS: Record<string, Job> = {
  binance: priceJob(binanceAdapter),
  goldapi: priceJob(goldApiAdapter),
  yahoo: priceJob(yahooAdapter),
  fred: runFredJob,
  rss: runNewsJob,
  candles_binance: runBinanceCandlesJob,
  candles_yahoo: runYahooCandlesJob,
  binance_futures: runOnchainJob,
};

declare global {
  // eslint-disable-next-line no-var
  var __ingestionStarted: boolean | undefined;
}

const health = new Map<string, SourceHealth>();

function setHealth(h: SourceHealth) {
  health.set(h.id, h);
  upsertHealth(h);
}

function isConfigured(sourceId: string): boolean {
  const s = SOURCES.find((x) => x.id === sourceId);
  if (!s) return false;
  return !s.requiresKey || !!(s.keyEnv && process.env[s.keyEnv]);
}

function initHealth() {
  for (const s of SOURCES) {
    const runnable = s.enabled && !!JOBS[s.id] && isConfigured(s.id);
    setHealth({
      id: s.id,
      status: runnable ? "degraded" : "unconfigured", // degraded until first success
      lastSuccess: null,
      lastError: runnable ? null : s.requiresKey ? `missing ${s.keyEnv}` : "no adapter",
      lastErrorAt: null,
      lastLatencyMs: null,
      consecutiveFailures: 0,
      quotesLastCycle: 0,
    });
  }
}

async function runCycle(id: string, job: Job) {
  const prev = health.get(id);
  const t0 = Date.now();
  try {
    const count = await job();
    setHealth({
      id,
      status: "live",
      lastSuccess: Date.now(),
      lastError: null,
      lastErrorAt: prev?.lastErrorAt ?? null,
      lastLatencyMs: Date.now() - t0,
      consecutiveFailures: 0,
      quotesLastCycle: count,
    });
  } catch (err) {
    const fails = (prev?.consecutiveFailures ?? 0) + 1;
    setHealth({
      id,
      status: fails >= 3 ? "down" : "degraded",
      lastSuccess: prev?.lastSuccess ?? null,
      lastError: err instanceof Error ? err.message : String(err),
      lastErrorAt: Date.now(),
      lastLatencyMs: Date.now() - t0,
      consecutiveFailures: fails,
      quotesLastCycle: 0,
    });
  }
}

const MAX_BACKOFF_MS = 300_000; // 5 min ceiling

function scheduleSource(id: string, job: Job, pollMs: number) {
  // Self-scheduling, non-overlapping loop with exponential backoff on
  // failure so a throttled source recovers instead of being hammered.
  const loop = async () => {
    await runCycle(id, job);
    const fails = health.get(id)?.consecutiveFailures ?? 0;
    const delay = fails > 0 ? Math.min(pollMs * 2 ** fails, MAX_BACKOFF_MS) : pollMs;
    setTimeout(loop, delay);
  };
  setTimeout(loop, Math.floor(Math.random() * 1000));
}

/** Idempotent. Safe to call from instrumentation on every server boot. */
export function startIngestion() {
  if (globalThis.__ingestionStarted) return;
  globalThis.__ingestionStarted = true;

  initHealth();

  const started: string[] = [];
  for (const s of SOURCES) {
    const job = JOBS[s.id];
    if (!s.enabled || !job || !isConfigured(s.id)) continue;
    scheduleSource(s.id, job, s.pollMs);
    started.push(s.id);
  }
  console.log(`[ingestion] started ${started.length} source(s): ${started.join(", ")}`);
}
