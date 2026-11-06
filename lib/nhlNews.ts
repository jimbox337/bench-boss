// NHL headlines from publishers' free public feeds. We show the headline,
// source, time, the feed's own thumbnail and the publisher's own short summary;
// the full story always stays on the publisher's site.

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
  image: string | null;
  /** The publisher's own teaser from its feed, trimmed. Never article text. */
  summary: string | null;
}

/** Short URL-safe id from the story URL (two FNV-1a passes), stable across server and browser. */
export function storyId(url: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < url.length; i += 1) {
    const c = url.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
  }
  return a.toString(36).padStart(7, '0') + b.toString(36).padStart(7, '0');
}

const SUMMARY_MAX = 320;

/** Feed teaser cleaned up: no "The post … appeared first on …" footer, cut at a word near 320 chars. */
export function cleanSummary(text: string | undefined, title: string): string | null {
  const clean = (text ?? '')
    .replace(/The post .* appeared first on .*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[—–-]\s*/, ''); // AP-style dateline dash left after the city is dropped
  if (!clean || clean.toLowerCase() === title.toLowerCase()) return null;
  if (clean.length <= SUMMARY_MAX) return clean;
  const cut = clean.slice(0, SUMMARY_MAX);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 200 ? cut.lastIndexOf(' ') : SUMMARY_MAX).replace(/[,;:.\s]+$/, '')}…`;
}

export const ESPN_NEWS_API = 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/news?limit=20';

export const NEWS_FEEDS = [
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

const httpsUrl = (url: unknown): string | null => (typeof url === 'string' && /^https:\/\//.test(url.trim()) ? url.trim() : null);

/** The item's own picture: media:content / media:thumbnail / image enclosure, else the first <img>. */
export function feedImage(block: string): string | null {
  const media = block.match(/<media:(?:content|thumbnail)\b[^>]*\burl="([^"]+)"/i)
    ?? block.match(/<enclosure\b[^>]*\burl="([^"]+)"[^>]*type="image\//i)
    ?? block.match(/<img\b[^>]*\bsrc="([^"]+)"/i)
    ?? block.match(/&lt;img\b[^&]*?\bsrc=&quot;([^&]+)&quot;/i);
  return media ? httpsUrl(decodeEntities(media[1])) : null;
}

export function parseFeed(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = [];
  for (const [, block] of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)) {
    const title = tag(block, 'title');
    const url = tag(block, 'link');
    if (!title || !/^https:\/\//.test(url)) continue;
    // Sportsnet's feed also lists page "collections", which are not stories.
    if (/[?&]sn-collection=/.test(url)) continue;
    const date = new Date(tag(block, 'pubDate'));
    items.push({
      id: storyId(url),
      title,
      url,
      source,
      publishedAt: Number.isNaN(date.getTime()) ? null : date.toISOString(),
      image: feedImage(block),
      summary: cleanSummary(tag(block, 'description'), title),
    });
  }
  return items;
}

type EspnArticle = { type?: string; headline?: string; description?: string; published?: string; images?: { url?: string }[]; links?: { web?: { href?: string } } };

/** ESPN's public news JSON (it carries photos, unlike ESPN's RSS). Game previews are skipped. */
export function parseEspn(data: { articles?: EspnArticle[] }): NewsItem[] {
  return (data.articles ?? []).flatMap((article) => {
    const url = httpsUrl(article.links?.web?.href?.replace(/^http:\/\//, 'https://'));
    const title = article.headline?.trim();
    if (!url || !title || article.type === 'Preview') return [];
    const date = new Date(article.published ?? '');
    return [{
      id: storyId(url),
      title,
      url,
      source: 'ESPN',
      publishedAt: Number.isNaN(date.getTime()) ? null : date.toISOString(),
      image: httpsUrl(article.images?.[0]?.url),
      summary: cleanSummary(article.description, title),
    }];
  });
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

// ESPN rejects user agents that contain a URL.
const get = (url: string, fresh = false) => fetch(url, {
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BenchBoss/1.0)' },
  ...(fresh ? { cache: 'no-store' as const } : { next: { revalidate: 600 } }),
  signal: AbortSignal.timeout(8_000),
});

async function allSources(fresh = false): Promise<NewsItem[][]> {
  const espn = get(ESPN_NEWS_API, fresh)
    .then((response) => (response.ok ? response.json() : {}))
    .then(parseEspn)
    .catch(() => [] as NewsItem[]);
  const feeds = NEWS_FEEDS.map(({ source, url }) => get(url, fresh)
    .then((response) => (response.ok ? response.text() : ''))
    .then((xml) => parseFeed(xml, source))
    .catch(() => [] as NewsItem[]));
  return Promise.all([espn, ...feeds]);
}

// Even share per source so one busy feed cannot crowd out the others.
const PER_SOURCE = 8;

export async function getNhlNews(limit = 24): Promise<NewsItem[]> {
  const lists = await allSources();
  return mergeNews(lists.map((list) => list.slice(0, PER_SOURCE)), limit);
}

/** One story by id from anything currently in the feeds (not just the carousel's 24). */
export async function findNhlStory(id: string): Promise<{ story: NewsItem; more: NewsItem[] } | null> {
  let all = mergeNews(await allSources(), 200);
  let story = all.find((item) => item.id === id);
  // The carousel's copy of the feeds can be newer than this one; check the publishers again.
  if (!story) {
    all = mergeNews(await allSources(true), 200);
    story = all.find((item) => item.id === id);
  }
  if (!story) return null;
  return { story, more: all.filter((item) => item.id !== id).slice(0, 6) };
}
