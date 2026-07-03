import { FEEDS, type ScoredNews } from "@/core/news";
import { writeNews } from "@/store/newsRepo";
import { fetchFeed } from "./rss";
import { scoreNews } from "./scoring";

/**
 * News job: pull every feed (in parallel — different hosts, no shared
 * throttle), score each item with the transparent engine, persist.
 * Returns the count of NEW items inserted this cycle.
 */
export async function runNewsJob(): Promise<number> {
  const settled = await Promise.allSettled(FEEDS.map((f) => fetchFeed(f)));

  const items = settled
    .filter((s): s is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchFeed>>> => s.status === "fulfilled")
    .flatMap((s) => s.value);

  if (items.length === 0) {
    const firstErr = settled.find((s) => s.status === "rejected") as PromiseRejectedResult | undefined;
    throw new Error(`rss: all feeds failed (${firstErr?.reason ?? "unknown"})`);
  }

  const scored: ScoredNews[] = items.map((it) => ({ ...it, score: scoreNews(it) }));
  return writeNews(scored);
}
