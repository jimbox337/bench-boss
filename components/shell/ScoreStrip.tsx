'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useData } from '@/lib/DataContext';
import type { ScoreboardGame } from '@/lib/nhlGameCenter';
import { TeamLogo, gameStatusText } from '@/components/gamecenter/shared';

/** Live NHL score strip shown under the top bar on every page. */
export default function ScoreStrip() {
  const { myTeam } = useData();
  const [games, setGames] = useState<ScoreboardGame[] | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const live = games?.some(game => game.isLive) ?? false;

  useEffect(() => {
    let active = true;
    const load = () => fetch('/api/scoreboard').then(r => r.json()).then(data => {
      if (active && data.success) setGames(data.games);
    }).catch(() => { /* Keep the last known scores. */ });
    void load();
    const timer = window.setInterval(() => void load(), live ? 30_000 : 120_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [live]);

  const myTeams = useMemo(() => new Set(myTeam.map(player => player.nhlTeam)), [myTeam]);
  const scroll = (direction: 1 | -1) => railRef.current?.scrollBy({ left: direction * 480, behavior: 'smooth' });

  if (games && games.length === 0) return null;

  return (
    <div className="bb-strip" aria-label="Today's NHL scores">
      <Link href="/games" className="bb-strip-label">
        <span className="bb-strip-label-title">NHL</span>
        <span className="bb-strip-label-link">All scores</span>
      </Link>
      <button type="button" className="bb-strip-arrow" onClick={() => scroll(-1)} aria-label="Scroll scores left"><ChevronLeft className="h-4 w-4" /></button>
      <div ref={railRef} className="bb-strip-rail">
        {!games && Array.from({ length: 5 }, (_, i) => <span key={i} className="bb-chip bb-chip-skeleton" aria-hidden />)}
        {games?.map(game => {
          const started = game.isLive || game.isFinal;
          const mine = myTeams.has(game.away.abbrev) || myTeams.has(game.home.abbrev);
          const label = `${game.away.abbrev} ${started ? game.away.score : ''} at ${game.home.abbrev} ${started ? game.home.score : ''}, ${gameStatusText(game)}${mine ? ', has your players' : ''}`;
          return (
            <Link key={game.id} href={`/games/${game.id}`} className="bb-chip" data-live={game.isLive || undefined} data-mine={mine || undefined} aria-label={label}>
              <span className="bb-chip-meta">
                <span className={game.isLive ? 'bb-chip-live' : ''}>{game.isLive && <span className="bb-live-dot" aria-hidden />}{gameStatusText(game)}</span>
                <span className="bb-chip-network">{mine ? <span className="bb-chip-mine">Yours</span> : game.broadcasts[0]}</span>
              </span>
              {(['away', 'home'] as const).map(side => {
                const team = game[side];
                const other = game[side === 'away' ? 'home' : 'away'];
                const winning = game.isFinal && (team.score ?? 0) > (other.score ?? 0);
                return (
                  <span key={side} className="bb-chip-team" data-winner={winning || undefined}>
                    <TeamLogo team={team} size={18} />
                    <span className="bb-chip-abbrev">{team.abbrev}</span>
                    <span className="bb-chip-value">{started ? team.score ?? 0 : team.record || ''}</span>
                  </span>
                );
              })}
            </Link>
          );
        })}
      </div>
      <button type="button" className="bb-strip-arrow" onClick={() => scroll(1)} aria-label="Scroll scores right"><ChevronRight className="h-4 w-4" /></button>
    </div>
  );
}
