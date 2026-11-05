'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useData } from '@/lib/DataContext';
import type { ScoreboardGame } from '@/lib/nhlGameCenter';
import { teamColor } from '@/lib/teamColors';
import { TeamLogo } from '@/components/gamecenter/shared';

function cardStatus(game: ScoreboardGame): string {
  const period = game.periodType === 'SO' ? 'SO' : game.periodType === 'OT' ? 'OT' : ['1ST', '2ND', '3RD'][(game.period || 1) - 1] || `P${game.period}`;
  if (game.isLive) return game.inIntermission ? `END ${period}` : `${period} ${game.clock || ''}`.trim();
  if (game.isFinal) return game.periodType && game.periodType !== 'REG' ? `FINAL/${game.periodType}` : 'FINAL';
  return new Date(game.startTimeUTC).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toUpperCase();
}

/** Live NHL score cards shown under the top bar on every page. */
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
  const scroll = (direction: 1) => railRef.current?.scrollBy({ left: direction * 520, behavior: 'smooth' });

  if (games && games.length === 0) return null;

  return (
    <div className="bb-strip" aria-label="Today's NHL scores">
      <div className="bb-strip-head">
        <span className="bb-strip-title">NHL scores</span>
        <Link href="/games" className="bb-strip-all">All scores</Link>
      </div>
      <div className="bb-strip-viewport">
        <div ref={railRef} className="bb-strip-rail">
          {!games && Array.from({ length: 6 }, (_, i) => <span key={i} className="bb-card bb-card-skeleton" aria-hidden />)}
          {games?.map(game => {
            const started = game.isLive || game.isFinal;
            const mine = myTeams.has(game.away.abbrev) || myTeams.has(game.home.abbrev);
            const label = `${game.away.abbrev} ${started ? game.away.score : ''} at ${game.home.abbrev} ${started ? game.home.score : ''}, ${cardStatus(game)}${mine ? ', has your players' : ''}`;
            const winner = game.isFinal ? ((game.away.score ?? 0) > (game.home.score ?? 0) ? 'away' : 'home') : null;
            return (
              <Link key={game.id} href={`/games/${game.id}`} className="bb-card" aria-label={label}>
                <span className="bb-card-bar" aria-hidden>
                  <span style={{ background: teamColor(game.away.abbrev) }} />
                  <span style={{ background: teamColor(game.home.abbrev) }} />
                </span>
                <span className="bb-card-meta">
                  <span className={game.isLive ? 'bb-card-live' : ''}>{cardStatus(game)}</span>
                  <span className="bb-card-network">{mine ? <span className="bb-card-mine">Your players</span> : game.broadcasts[0]?.toUpperCase()}</span>
                </span>
                {(['away', 'home'] as const).map(side => (
                  <span key={side} className="bb-card-row" data-dim={winner && winner !== side ? true : undefined}>
                    <TeamLogo team={game[side]} size={18} />
                    <span className="bb-card-abbrev">{game[side].abbrev}</span>
                    {started ? <span className="bb-card-score">{game[side].score ?? 0}</span> : <span className="bb-card-record">{game[side].record}</span>}
                  </span>
                ))}
              </Link>
            );
          })}
        </div>
        <button type="button" className="bb-strip-arrow bb-strip-arrow-right" onClick={() => scroll(1)} aria-label="Scroll scores right"><ChevronRight className="h-5 w-5" /></button>
      </div>
    </div>
  );
}
