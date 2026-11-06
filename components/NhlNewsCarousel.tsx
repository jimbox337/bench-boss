'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ExternalLink, Newspaper } from 'lucide-react';
import type { NewsItem } from '@/lib/nhlNews';
import './nhl-news-carousel.css';

const ADVANCE_MS = 5000;

function timeAgo(iso: string | null, now: number): string {
  if (!iso) return '';
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `${minutes || 1}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function NewsCard({ item, now }: { item: NewsItem; now: number }) {
  const [broken, setBroken] = useState(false);
  return (
    <li className="bb-newsc-slide">
      <Link href={`/news/${item.id}`} className="bb-newsc-card">
        <span className="bb-newsc-media">
          {item.image && !broken
            ? <img src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
            : <span className="bb-newsc-placeholder"><Newspaper size={28} aria-hidden="true" /><span>{item.source}</span></span>}
          <span className="bb-newsc-badge">{item.source}</span>
        </span>
        <span className="bb-newsc-body">
          <span className="bb-newsc-title">{item.title}</span>
          <span className="bb-newsc-meta">
            {item.publishedAt && <time dateTime={item.publishedAt}>{timeAgo(item.publishedAt, now)}</time>}
            <span className="bb-newsc-read">Read story <ChevronRight size={12} aria-hidden="true" /></span>
          </span>
        </span>
      </Link>
    </li>
  );
}

export default function NhlNewsCarousel() {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [paused, setPaused] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const track = useRef<HTMLUListElement>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => fetch('/api/nhl-news')
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success && data.items.length) { setItems(data.items); setFailed(false); } else setFailed(true);
        setNow(Date.now());
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    load();
    const timer = setInterval(load, 10 * 60_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  const updateEdges = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }, []);

  const step = useCallback((direction: 1 | -1, wrap = false) => {
    const el = track.current;
    if (!el) return;
    const slide = el.querySelector<HTMLElement>('.bb-newsc-slide');
    const width = slide ? slide.offsetWidth + 16 : el.clientWidth * 0.8;
    if (wrap && direction === 1 && el.scrollLeft + el.clientWidth >= el.scrollWidth - 4) {
      el.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      el.scrollBy({ left: direction * width, behavior: 'smooth' });
    }
  }, []);

  // Auto-advance one card at a time; pause on hover/focus, hidden tab, or reduced motion.
  useEffect(() => {
    if (!items || paused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => { if (!document.hidden) step(1, true); }, ADVANCE_MS);
    return () => clearInterval(timer);
  }, [items, paused, step]);

  useEffect(updateEdges, [items, updateEdges]);

  const sources = items ? [...new Set(items.map((item) => item.source))] : [];

  return (
    <section className="bb-panel bb-newsc overflow-hidden" aria-labelledby="league-news-title">
      <div className="bb-dashboard-panel-heading flex items-center justify-between gap-3 border-b border-rule px-5 py-4">
        <h2 id="league-news-title" className="flex items-center gap-2 text-lg">
          Around the NHL
          {items && <span className="bb-newsc-live"><span aria-hidden="true" />Live</span>}
        </h2>
        {items && (
          <div className="flex items-center gap-2">
            <button type="button" className="bb-newsc-arrow" onClick={() => step(-1)} disabled={atStart} aria-label="Previous headlines"><ChevronLeft size={18} /></button>
            <button type="button" className="bb-newsc-arrow" onClick={() => step(1, true)} aria-label="Next headlines"><ChevronRight size={18} /></button>
          </div>
        )}
      </div>

      {items ? (
        <ul
          ref={track}
          className="bb-newsc-track"
          aria-label="Latest NHL headlines"
          onScroll={updateEdges}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
          data-at-end={atEnd || undefined}
        >
          {items.map((item) => <NewsCard key={item.id} item={item} now={now} />)}
        </ul>
      ) : failed ? (
        <div className="px-5 py-8 text-sm text-muted">
          <p>Headlines are unavailable right now.</p>
          <a href="https://www.nhl.com/news" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 font-medium text-accent">Read NHL.com news <ExternalLink size={14} aria-hidden="true" /></a>
        </div>
      ) : (
        <ul className="bb-newsc-track" aria-hidden="true">
          {[0, 1, 2, 3].map((n) => <li key={n} className="bb-newsc-slide"><span className="bb-newsc-card bb-newsc-skeleton" /></li>)}
        </ul>
      )}

      <p className="border-t border-rule px-5 py-3 text-xs text-muted">
        {sources.length ? `Headlines and photos from ${sources.join(', ')}. Full stories are on the publisher's site.` : 'Headlines link to the original publisher.'}
      </p>
    </section>
  );
}
