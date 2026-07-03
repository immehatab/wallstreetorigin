import { db } from "./db";
import type { ScoredNews } from "@/core/news";

const upsert = db.prepare(`
  INSERT INTO news_items (id, feed_id, feed_name, category, title, url, summary, published_at, ingested_at, score_json)
  VALUES (@id, @feedId, @feedName, @category, @title, @url, @summary, @publishedAt, @ingestedAt, @scoreJson)
  ON CONFLICT(id) DO UPDATE SET
    score_json=excluded.score_json
`);

export const writeNews = db.transaction((items: ScoredNews[]): number => {
  let inserted = 0;
  for (const it of items) {
    const info = upsert.run({
      id: it.id,
      feedId: it.feedId,
      feedName: it.feedName,
      category: it.category,
      title: it.title,
      url: it.url,
      summary: it.summary,
      publishedAt: it.publishedAt,
      ingestedAt: it.ingestedAt,
      scoreJson: JSON.stringify(it.score),
    });
    if (info.changes > 0) inserted++;
  }
  return inserted;
});

interface NewsRow {
  id: string;
  feed_id: string;
  feed_name: string;
  category: string;
  title: string;
  url: string;
  summary: string;
  published_at: number;
  ingested_at: number;
  score_json: string;
}

const selectRecent = db.prepare(
  `SELECT * FROM news_items ORDER BY published_at DESC LIMIT ?`,
) as unknown as { all: (limit: number) => NewsRow[] };

function rowToScored(r: NewsRow): ScoredNews {
  return {
    id: r.id,
    feedId: r.feed_id,
    feedName: r.feed_name,
    category: r.category as ScoredNews["category"],
    title: r.title,
    url: r.url,
    summary: r.summary,
    publishedAt: r.published_at,
    ingestedAt: r.ingested_at,
    score: JSON.parse(r.score_json),
  };
}

export function getRecentNews(limit = 40): ScoredNews[] {
  return selectRecent.all(limit).map(rowToScored);
}

/** Highest-impact recent items for the top of the feed / headline banner. */
export function getTopNews(limit = 6): ScoredNews[] {
  return getRecentNews(120)
    .sort((a, b) => b.score.marketImpact - a.score.marketImpact)
    .slice(0, limit);
}
