/** A single item extracted from a feed. */
export interface FeedItem {
  id: string;
  title: string;
  link: string;
}

/** Snapshot of one feed fetched during a run. */
export interface FeedSnapshot {
  url: string;
  ok: boolean;
  itemCount: number;
  error?: string;
}

/** Result of one compare run across all configured feeds. */
export interface CompareResult {
  runAt: string;
  durationMs: number;
  feeds: FeedSnapshot[];
  /** Items present across more than one feed, keyed by normalised title. */
  overlap: { title: string; sources: string[] }[];
}

/** Minimal RSS/Atom item extraction — no external deps. */
function parseItems(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  // Match <item>...</item> (RSS) or <entry>...</entry> (Atom).
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/(item|entry)>/gi) ?? [];

  for (const block of blocks) {
    const title = extractTag(block, "title") ?? "";
    const link =
      extractTag(block, "link") ??
      extractAttr(block, "link", "href") ??
      extractTag(block, "guid") ??
      "";
    if (!title) continue;
    items.push({ id: link || title, title: title.trim(), link: link.trim() });
  }
  return items;
}

function extractTag(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!m) return null;
  return decodeEntities(stripCdata(m[1]!));
}

function extractAttr(xml: string, tag: string, attr: string): string | null {
  const m = xml.match(new RegExp(`<${tag}\\b[^>]*\\b${attr}=["']([^"']+)["']`, "i"));
  return m ? m[1]! : null;
}

function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

async function fetchFeed(
  url: string,
  signal: AbortSignal,
): Promise<{ snapshot: FeedSnapshot; items: FeedItem[] }> {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) {
      return {
        snapshot: { url, ok: false, itemCount: 0, error: `HTTP ${res.status}` },
        items: [],
      };
    }
    const items = parseItems(await res.text());
    return { snapshot: { url, ok: true, itemCount: items.length }, items };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { snapshot: { url, ok: false, itemCount: 0, error: message }, items: [] };
  }
}

/**
 * Fetch every feed concurrently and report which titles appear in more than
 * one feed. This is the worker's core unit of work — pure and testable.
 */
export async function compareFeeds(
  urls: string[],
  { timeoutMs = 10_000 }: { timeoutMs?: number } = {},
): Promise<CompareResult> {
  const start = performance.now();
  const signal = AbortSignal.timeout(timeoutMs);

  const results = await Promise.all(urls.map((url) => fetchFeed(url, signal)));

  const feeds = results.map((r) => r.snapshot);

  // Group source feeds by normalised title to find overlaps.
  const byTitle = new Map<string, { title: string; sources: Set<string> }>();
  results.forEach(({ snapshot, items }) => {
    for (const item of items) {
      const key = item.title.toLowerCase().trim();
      const entry = byTitle.get(key) ?? { title: item.title, sources: new Set() };
      entry.sources.add(snapshot.url);
      byTitle.set(key, entry);
    }
  });

  const overlap = [...byTitle.values()]
    .filter((e) => e.sources.size > 1)
    .map((e) => ({ title: e.title, sources: [...e.sources] }));

  return {
    runAt: new Date().toISOString(),
    durationMs: Math.round(performance.now() - start),
    feeds,
    overlap,
  };
}
