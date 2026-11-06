import { describe, expect, it } from 'vitest';
import { cleanSummary, decodeEntities, feedImage, mergeNews, parseEspn, parseFeed, storyId } from './nhlNews';

const ESPN = `<rss><channel><title>ESPN</title>
<item><title><![CDATA[Power Rankings: Canes stay No. 1]]></title><link><![CDATA[https://www.espn.com/nhl/story/_/id/1]]></link><pubDate>Fri, 6 Nov 2026 09:54:40 EST</pubDate></item>
<item><title>No link</title></item>
<item><title>Insecure</title><link>http://example.com/x</link></item>
</channel></rss>`;

const SPORTSNET = `<rss><channel>
<item  importance="normal"><media:content medium="image" url="https://www.sportsnet.ca/p.jpg"/><title>Oilers&#039; McDavid &amp; Draisaitl roll</title><link>https://www.sportsnet.ca/a</link><pubDate>Fri, 06 Nov 2026 16:00:00 +0000</pubDate></item>
<item><title>NHL Featured</title><link>https://www.sportsnet.ca/?sn-collection=nhl-top</link></item>
<item><title>Power rankings: Canes stay No. 1!</title><link>https://www.sportsnet.ca/b</link><pubDate>Thu, 05 Nov 2026 16:00:00 +0000</pubDate></item>
</channel></rss>`;

describe('nhl news', () => {
  it('decodes entities', () => {
    expect(decodeEntities('A&#039;s &amp; B&#x27;s')).toBe("A's & B's");
  });

  it('parses CDATA and attribute items, skipping bad links', () => {
    const espn = parseFeed(ESPN, 'ESPN');
    expect(espn).toHaveLength(1);
    expect(espn[0]).toMatchObject({ title: 'Power Rankings: Canes stay No. 1', source: 'ESPN', url: 'https://www.espn.com/nhl/story/_/id/1' });
    expect(espn[0].publishedAt).toBe('2026-11-06T14:54:40.000Z');
    expect(parseFeed(SPORTSNET, 'Sportsnet')[0].title).toBe("Oilers' McDavid & Draisaitl roll");
  });

  it('merges newest first and drops duplicate headlines', () => {
    const merged = mergeNews([parseFeed(ESPN, 'ESPN'), parseFeed(SPORTSNET, 'Sportsnet')]);
    expect(merged.map((item) => item.source)).toEqual(['Sportsnet', 'ESPN']);
  });

  it('finds the feed picture and ignores non-https images', () => {
    expect(parseFeed(SPORTSNET, 'Sportsnet')[0].image).toBe('https://www.sportsnet.ca/p.jpg');
    expect(parseFeed(ESPN, 'ESPN')[0].image).toBeNull();
    expect(feedImage('<content:encoded><![CDATA[<figure><img alt="" src="https://media.zenfs.com/a.jpg"/>]]></content:encoded>')).toBe('https://media.zenfs.com/a.jpg');
    expect(feedImage('<enclosure url="http://x.com/a.jpg" type="image/jpeg"/>')).toBeNull();
  });

  it('reads ESPN news JSON and skips game previews', () => {
    const items = parseEspn({ articles: [
      { type: 'Story', headline: 'Faber back at practice', description: 'He took line rushes.', published: '2026-11-06T16:13:26Z', images: [{ url: 'https://a.espncdn.com/x.jpg' }], links: { web: { href: 'https://www.espn.com/nhl/story/_/id/2' } } },
      { type: 'Preview', headline: 'Utah visits Ottawa', links: { web: { href: 'http://www.espn.com/nhl/preview?gameId=1' } } },
    ] });
    expect(items).toEqual([{ id: storyId('https://www.espn.com/nhl/story/_/id/2'), title: 'Faber back at practice', url: 'https://www.espn.com/nhl/story/_/id/2', source: 'ESPN', publishedAt: '2026-11-06T16:13:26.000Z', image: 'https://a.espncdn.com/x.jpg', summary: 'He took line rushes.' }]);
  });

  it('makes stable, distinct, URL-safe story ids', () => {
    const a = storyId('https://www.espn.com/nhl/story/_/id/1');
    expect(a).toMatch(/^[0-9a-z]{14}$/);
    expect(storyId('https://www.espn.com/nhl/story/_/id/1')).toBe(a);
    expect(storyId('https://www.espn.com/nhl/story/_/id/2')).not.toBe(a);
  });

  it('cleans feed summaries', () => {
    expect(cleanSummary('Big win. The post Big win appeared first on Sportsnet.ca.', 'T')).toBe('Big win.');
    expect(cleanSummary('Same', 'same')).toBeNull();
    expect(cleanSummary('— Stamkos scored in overtime.', 'T')).toBe('Stamkos scored in overtime.');
    const long = cleanSummary('word '.repeat(100), 'T')!;
    expect(long.length).toBeLessThanOrEqual(321);
    expect(long.endsWith('…')).toBe(true);
  });
});
