import { describe, expect, it } from 'vitest';
import { decodeEntities, mergeNews, parseFeed } from './nhlNews';

const ESPN = `<rss><channel><title>ESPN</title>
<item><title><![CDATA[Power Rankings: Canes stay No. 1]]></title><link><![CDATA[https://www.espn.com/nhl/story/_/id/1]]></link><pubDate>Fri, 6 Nov 2026 09:54:40 EST</pubDate></item>
<item><title>No link</title></item>
<item><title>Insecure</title><link>http://example.com/x</link></item>
</channel></rss>`;

const SPORTSNET = `<rss><channel>
<item  importance="normal"><title>Oilers&#039; McDavid &amp; Draisaitl roll</title><link>https://www.sportsnet.ca/a</link><pubDate>Fri, 06 Nov 2026 16:00:00 +0000</pubDate></item>
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
});
