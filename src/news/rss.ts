import { curlText } from "@/ingestion/adapter";
import type { FeedDef, NewsItem } from "@/core/news";

/**
 * Dependency-free RSS/Atom parser. Handles <item> (RSS) and <entry>
 * (Atom), CDATA, and the common date/link shapes across our feeds.
 * Good enough for headline ingestion; we never trust it for numbers.
 */

function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "").trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function stripHtml(s: string): string {
  return decodeEntities(stripCdata(s).replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? stripCdata(m[1]).trim() : null;
}

/** Atom links live in an href attribute; RSS links are text. */
function extractLink(block: string): string {
  const rss = tag(block, "link");
  if (rss && /^https?:/i.test(rss)) return rss;
  const atom = block.match(/<link[^>]*href="([^"]+)"[^>]*\/?>/i);
  return atom ? atom[1] : "";
}

function parseDate(block: string): number {
  const raw =
    tag(block, "pubDate") ??
    tag(block, "published") ??
    tag(block, "updated") ??
    tag(block, "dc:date");
  if (!raw) return Date.now();
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : Date.now();
}

// djb2 hash → stable short id for dedup.
function hashId(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return (h >>> 0).toString(16);
}

export async function fetchFeed(feed: FeedDef): Promise<NewsItem[]> {
  const xml = await curlText(feed.url, { timeoutMs: 9000 });

  const blocks =
    xml.match(/<item[\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? [];

  const now = Date.now();
  const items: NewsItem[] = [];
  for (const block of blocks) {
    const rawTitle = tag(block, "title");
    if (!rawTitle) continue;
    const title = stripHtml(rawTitle);
    if (!title) continue;

    const url = extractLink(block);
    const summary = stripHtml(
      tag(block, "description") ?? tag(block, "summary") ?? tag(block, "content") ?? "",
    ).slice(0, 400);

    items.push({
      id: hashId(url + "|" + title),
      feedId: feed.id,
      feedName: feed.name,
      category: feed.category,
      title,
      url,
      summary,
      publishedAt: parseDate(block),
      ingestedAt: now,
    });
  }
  return items;
}
