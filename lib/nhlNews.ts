// NHL headlines from publishers' free public RSS feeds. We show the headline,
// source and time only, and every item links to the original story.

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
}

export const NEWS_FEEDS = [
  { source: 'ESPN', url: 'https://www.espn.com/espn/rss/nhl/news' },
  { source: 'Sportsnet', url: 'https://www.sportsnet.ca/hockey/nhl/feed/' },
  { source: 'Yahoo Sports', url: 'https://sports.yahoo.com/nhl/rss/' },
] as const;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const value = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function tag(block: string, name: string): string {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  if (!match) return '';
  const raw = match[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1');
  return decodeEntities(raw.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

export function parseFeed(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = [];
  for (const [, block] of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)) {
    const title = tag(block, 'title');
    const url = tag(block, 'link');
    if (!title || !/^https:\/\//.test(url)) continue;
    const date = new Date(tag(block, 'pubDate'));
    items.push({
      id: `${source}:${url}`,
      title,
      url,
      source,
      publishedAt: Number.isNaN(date.getTime()) ? null : date.toISOString(),
    });
  }
  return items;
}

const key = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Newest first, one copy of each headline, capped at `limit`. */
export function mergeNews(lists: NewsItem[][], limit = 24): NewsItem[] {
  const seen = new Set<string>();
  return lists
    .flat()
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
    .filter((item) => {
      const k = key(item.title);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, limit);
}

export async function getNhlNews(limit = 24): Promise<NewsItem[]> {
  const lists = await Promise.all(NEWS_FEEDS.map(async ({ source, url }) => {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'BenchBoss/1.0 (+https://benchboss.pro)' },
        next: { revalidate: 600 },
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) return [];
      return parseFeed(await response.text(), source).slice(0, 15);
    } catch {
      return [];
    }
  }));
  return mergeNews(lists, limit);
}
