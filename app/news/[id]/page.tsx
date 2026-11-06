import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Newspaper } from 'lucide-react';
import { findNhlStory, type NewsItem } from '@/lib/nhlNews';
import StoryPlayers from '@/components/news/StoryPlayers';
import '@/components/news/news-story.css';
import { formatPacific } from '@/lib/time';

// Rendered per request (the feed fetches are still cached) so a "not found" is never cached.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await findNhlStory((await params).id);
  if (!found) return { title: 'Story not found - Bench Boss' };
  return {
    title: `${found.story.title} - Bench Boss`,
    description: found.story.summary ?? `NHL news from ${found.story.source}, with the fantasy angle from Bench Boss.`,
  };
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return `${formatPacific(iso, { dateStyle: 'medium', timeStyle: 'short' })} PT`;
}

function MoreStory({ item }: { item: NewsItem }) {
  return (
    <li>
      <Link href={`/news/${item.id}`} className="bb-story-more-item">
        <span className="bb-story-more-thumb">
          {item.image ? <img src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <Newspaper size={18} aria-hidden="true" />}
        </span>
        <span className="min-w-0">
          <span className="bb-story-more-source">{item.source}</span>
          <span className="bb-story-more-title">{item.title}</span>
        </span>
      </Link>
    </li>
  );
}

export default async function NewsStoryPage({ params }: Props) {
  const found = await findNhlStory((await params).id);

  if (!found) {
    return (
      <div className="bb-page">
        <Link href="/" className="bb-story-back"><ArrowLeft size={16} aria-hidden="true" /> Back to dashboard</Link>
        <section className="bb-panel mt-4 px-6 py-10">
          <h1 className="text-2xl">This story has rolled out of the feed.</h1>
          <p className="mt-3 text-sm text-muted">We only keep the latest headlines. Find it on the publisher&apos;s site, or catch up on what&apos;s new.</p>
          <a href="https://www.nhl.com/news" target="_blank" rel="noopener noreferrer" className="bb-button mt-6 inline-flex items-center gap-2">NHL.com news <ExternalLink size={14} aria-hidden="true" /></a>
        </section>
      </div>
    );
  }

  const { story, more } = found;
  const date = formatDate(story.publishedAt);

  return (
    <div className="bb-page bb-story">
      <Link href="/" className="bb-story-back"><ArrowLeft size={16} aria-hidden="true" /> Around the NHL</Link>

      <div className="bb-story-layout">
        <article className="bb-panel overflow-hidden">
          {story.image && (
            <figure className="bb-story-hero">
              <img src={story.image} alt="" referrerPolicy="no-referrer" />
              <figcaption>Photo: {story.source}</figcaption>
            </figure>
          )}
          <div className="bb-story-body">
            <p className="bb-story-kicker">
              <span className="bb-story-source">{story.source}</span>
              {date && <time dateTime={story.publishedAt ?? undefined}>{date}</time>}
            </p>
            <h1 className="bb-story-title">{story.title}</h1>
            {story.summary && (
              <blockquote className="bb-story-summary" cite={story.url}>
                <p>{story.summary}</p>
                <footer>Summary from {story.source}</footer>
              </blockquote>
            )}
            <a href={story.url} target="_blank" rel="noopener noreferrer" className="bb-button bb-story-cta">
              Read the full story on {story.source} <ExternalLink size={15} aria-hidden="true" />
            </a>
            <p className="bb-story-note">The full article is published by {story.source}. Bench Boss links to it and adds the fantasy angle below.</p>
          </div>

          <StoryPlayers text={`${story.title} ${story.summary ?? ''}`} />
        </article>

        <aside className="bb-panel overflow-hidden" aria-labelledby="more-news-title">
          <div className="bb-dashboard-panel-heading border-b border-rule px-5 py-4"><h2 id="more-news-title" className="text-lg">More around the NHL</h2></div>
          <ul className="divide-y divide-rule">{more.map((item) => <MoreStory key={item.id} item={item} />)}</ul>
        </aside>
      </div>
    </div>
  );
}
