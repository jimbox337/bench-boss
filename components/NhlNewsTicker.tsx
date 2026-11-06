'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Newspaper } from 'lucide-react';
import type { NewsItem } from '@/lib/nhlNews';
import './nhl-news-ticker.css';

function timeAgo(iso: string | null, now: number): string {
  if (!iso) return '';
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `${minutes || 1}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function Headline({ item, now, hidden }: { item: NewsItem; now: number; hidden?: boolean }) {
  return (
    <li aria-hidden={hidden || undefined}>
      <a href={item.url} target="_blank" rel="noopener noreferrer" tabIndex={hidden ? -1 : undefined} className="bb-news-item">
        <span className="bb-news-meta">
          <span className="bb-news-source">{item.source}</span>
          {item.publishedAt && <time dateTime={item.publishedAt}>{timeAgo(item.publishedAt, now)}</time>}
        </span>
        <span className="bb-news-title">{item.title}</span>
        <ExternalLink size={13} className="bb-news-icon" aria-hidden="true" />
      </a>
    </li>
  );
}

export default function NhlNewsTicker() {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    const load = () => fetch('/api/nhl-news')
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success && data.items.length) { setItems(data.items); setFailed(false); } else if (!items) setFailed(true);
        setNow(Date.now());
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    load();
    const timer = setInterval(load, 10 * 60_000);
    return () => { cancelled = true; clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sources = items ? [...new Set(items.map((item) => item.source))] : [];
  // Roughly 4s per headline keeps the scroll readable.
  const duration = `${Math.max(40, (items?.length ?? 0) * 4)}s`;

  return (
    <section className="bb-panel bb-dashboard-resources overflow-hidden" aria-labelledby="league-news-title">
      <div className="bb-dashboard-panel-heading flex items-center justify-between gap-3 border-b border-rule px-5 py-4">
        <h2 id="league-news-title" className="flex items-center gap-2 text-lg">
          Around the NHL
          {items && <span className="bb-news-live"><span aria-hidden="true" />Live</span>}
        </h2>
        <Newspaper className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
      </div>

      {items ? (
        <div className="bb-news-viewport" tabIndex={0} aria-label="Latest NHL headlines. Hover or focus to pause.">
          <ul className="bb-news-track" style={{ animationDuration: duration }}>
            {items.map((item) => <Headline key={item.id} item={item} now={now} />)}
            {items.map((item) => <Headline key={`dup-${item.id}`} item={item} now={now} hidden />)}
          </ul>
        </div>
      ) : failed ? (
        <div className="px-5 py-8 text-sm text-muted">
          <p>Headlines are unavailable right now.</p>
          <a href="https://www.nhl.com/news" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 font-medium text-accent">Read NHL.com news <ExternalLink size={14} aria-hidden="true" /></a>
        </div>
      ) : (
        <div className="px-5 py-10 text-sm text-muted" role="status">Loading NHL headlines…</div>
      )}

      <p className="border-t border-rule px-5 py-3 text-xs text-muted">
        {sources.length ? `Headlines from ${sources.join(', ')}. Links open the original story.` : 'Headlines link to the original publisher.'}
      </p>
    </section>
  );
}
