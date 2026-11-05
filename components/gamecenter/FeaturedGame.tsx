'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useData } from '@/lib/DataContext';
import { pickFeatured, type ScoreboardGame } from '@/lib/nhlGameCenter';
import { GameHero, SectionTitle } from './shared';

export default function FeaturedGame() {
  const { myTeam } = useData();
  const [games, setGames] = useState<ScoreboardGame[] | null>(null);

  useEffect(() => {
    let active = true;
    const load = () => fetch('/api/scoreboard').then(r => r.json()).then(data => { if (active && data.success) setGames(data.games); }).catch(() => {});
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const featured = games ? pickFeatured(games, new Set(myTeam.map(p => p.nhlTeam))) : null;
  if (games && !featured) return null;

  return (
    <section className="mb-8" aria-label="Featured game">
      <SectionTitle action={<Link href="/games" className="flex items-center gap-1 text-sm font-semibold text-accent">All scores <ChevronRight className="h-4 w-4" /></Link>}>
        {featured?.reason || 'Tonight'}
      </SectionTitle>
      {!featured ? <div className="h-40 rounded-2xl bg-paper-3" /> : (
        <GameHero game={featured.game} footer={
          <Link href={`/games/${featured.game.id}`} className="flex items-center justify-center gap-1 border-t border-rule-2 py-3 text-sm font-semibold text-accent hover:bg-paper">
            {featured.game.isLive || featured.game.isFinal ? 'Box score, plays and shot chart' : 'Game preview'}<ChevronRight className="h-4 w-4" />
          </Link>
        } />
      )}
    </section>
  );
}
