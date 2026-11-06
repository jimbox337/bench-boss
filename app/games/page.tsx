'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { calculateFantasyPoints } from '@/lib/calculator';
import { useData } from '@/lib/DataContext';
import type { GameStarters } from '@/lib/goalieStarters';
import type { ScoreboardGame } from '@/lib/nhlGameCenter';
import { PlayerLink } from '@/components/player/PlayerCardProvider';
import { SectionTitle, StarterLine, TeamColorBar, TeamLink, TeamLogo, pointsScoring, shortStatus } from '@/components/gamecenter/shared';
import { calendarDay } from '@/lib/time';

type Scoreboard = { date: string; prevDate?: string; nextDate?: string; games: ScoreboardGame[]; updatedAt: string };

const shortDay = (date: string) => calendarDay(date, { weekday: 'short', month: 'short', day: 'numeric' });
const formatDay = (date: string) => calendarDay(date, { weekday: 'long', month: 'long', day: 'numeric' });

function GameCard({ game, starters, mine }: { game: ScoreboardGame; starters?: GameStarters; mine: number }) {
  const started = game.isLive || game.isFinal;
  const [top, bottom] = shortStatus(game);
  const winner = game.isFinal ? ((game.away.score ?? 0) > (game.home.score ?? 0) ? 'away' : 'home') : null;
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-rule bg-paper-2">
      <TeamColorBar away={game.away.abbrev} home={game.home.abbrev} />
      <div className="flex items-center justify-between px-4 pt-3 font-display text-sm font-bold tracking-wide">
        <span className={game.isLive ? 'text-error' : 'text-ink-2'}>{top} {bottom}</span>
        <span className="text-muted">{mine > 0 ? <span className="text-accent">{mine} of your players</span> : game.broadcasts.slice(0, 2).join(' · ').toUpperCase()}</span>
      </div>
      <div className="space-y-2 px-4 py-3">
        {(['away', 'home'] as const).map(side => {
          const team = game[side];
          return (
            <div key={side} className={`flex items-center gap-3 ${winner && winner !== side ? 'opacity-55' : ''}`}>
              <TeamLogo team={team} size={34} />
              <TeamLink abbrev={team.abbrev} className="min-w-0 flex-1 leading-tight">
                <span className="block truncate font-semibold">{team.city ? `${team.city} ${team.name}` : team.name}</span>
                <span className="text-xs text-muted tabular-nums">{team.record}</span>
              </TeamLink>
              <span className="font-display text-3xl font-bold tabular-nums">{started ? team.score ?? 0 : ''}</span>
            </div>
          );
        })}
      </div>
      <div className="space-y-1 border-t border-rule-2 px-4 py-2.5">
        {(['away', 'home'] as const).map(side => <div key={side} className="flex items-center gap-2"><TeamLogo team={game[side]} size={16} /><StarterLine starter={starters?.[side].starter} /></div>)}
      </div>
      {game.goals.filter(g => g.period !== 'SO').length > 0 && (
        <div className="space-y-1 border-t border-rule-2 px-4 py-2.5 text-xs text-ink-2">
          {[game.away.abbrev, game.home.abbrev].map(team => {
            const list = game.goals.filter(g => g.team === team && g.period !== 'SO');
            return <p key={team}><span className="font-display text-sm font-bold text-ink">{team}</span> {list.length ? list.map(g => `${g.scorer}${g.goalsToDate ? ` (${g.goalsToDate})` : ''}${g.strength === 'pp' ? ' PP' : g.strength === 'sh' ? ' SH' : ''}`).join(', ') : 'No goals'}</p>;
          })}
        </div>
      )}
      <Link href={`/games/${game.id}`} className="mt-auto flex items-center justify-between border-t border-rule px-4 py-3 text-sm font-semibold text-accent hover:bg-paper">
        {started ? 'Box score and plays' : 'Game preview'}<ChevronRight className="h-4 w-4" />
      </Link>
    </article>
  );
}

function ScoreboardView() {
  const router = useRouter();
  const params = useSearchParams();
  const requestedDate = params.get('date') || '';
  const { players, projections, myTeam, leagueSettings } = useData();
  const [board, setBoard] = useState<Scoreboard | null>(null);
  const [error, setError] = useState('');
  const [starters, setStarters] = useState<Map<number, GameStarters>>(new Map());
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    const query = requestedDate ? `?date=${requestedDate}` : '';
    const load = () => fetch(`/api/scoreboard${query}`).then(r => r.json()).then(data => {
      if (!active) return;
      if (data.success) { setBoard(data); setError(''); } else setError(data.error || 'Scores unavailable');
    }).catch(() => active && setError('Scores unavailable'));
    const loadStarters = () => fetch(`/api/goalie-starters${query}`).then(r => r.json()).then(data => {
      if (active && data.success) setStarters(new Map((data.starters as GameStarters[]).map(row => [row.gameId, row])));
    }).catch(() => { /* Keep last known goalies. */ });
    void load();
    void loadStarters();
    const scoreTimer = window.setInterval(() => void load(), 30_000);
    const goalieTimer = window.setInterval(() => void loadStarters(), 120_000);
    return () => { active = false; window.clearInterval(scoreTimer); window.clearInterval(goalieTimer); };
  }, [requestedDate, refreshKey]);

  const playing = useMemo(() => new Set(board?.games.flatMap(game => [game.home.abbrev, game.away.abbrev]) || []), [board]);
  const mineByTeam = useMemo(() => {
    const counts = new Map<string, number>();
    for (const player of myTeam) counts.set(player.nhlTeam, (counts.get(player.nhlTeam) || 0) + 1);
    return counts;
  }, [myTeam]);
  const myPlayers = myTeam.filter(player => playing.has(player.nhlTeam));
  const scoring = pointsScoring(leagueSettings);
  const leaders = players.filter(p => playing.has(p.nhlTeam)).map(player => {
    const projection = projections.find(item => item.playerId === player.id);
    return { player, points: projection ? calculateFantasyPoints(projection, scoring.settings) / Math.max(projection.gamesPlayed, 1) : 0 };
  }).filter(row => row.points > 0).sort((a, b) => b.points - a.points).slice(0, 10);

  const go = (date?: string) => router.push(date ? `/games?date=${date}` : '/games');
  const counts = { live: board?.games.filter(g => g.isLive).length || 0, final: board?.games.filter(g => g.isFinal).length || 0 };

  return (
    <div className="bb-page space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold uppercase tracking-wide">Scores</h1>
          <p className="mt-1 text-sm text-muted">{board ? `${board.games.length} games · ${counts.live} live · ${counts.final} final${myPlayers.length ? ` · ${myPlayers.length} of your players` : ''}` : 'Loading the NHL slate…'}</p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <button type="button" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-rule bg-paper-2 hover:border-field-border" onClick={() => go(board?.prevDate)} disabled={!board?.prevDate} aria-label="Previous day"><ChevronLeft className="h-5 w-5" /></button>
          <span className="min-w-0 flex-1 whitespace-nowrap rounded-full border border-rule bg-paper-2 px-4 py-2.5 text-center font-display text-lg font-bold sm:min-w-56 sm:flex-none">{board ? <><span className="sm:hidden">{shortDay(board.date)}</span><span className="hidden sm:inline">{formatDay(board.date)}</span></> : '…'}</span>
          <button type="button" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-rule bg-paper-2 hover:border-field-border" onClick={() => go(board?.nextDate)} disabled={!board?.nextDate} aria-label="Next day"><ChevronRight className="h-5 w-5" /></button>
          {requestedDate && <button type="button" className="h-11 rounded-full border border-ink px-4 text-sm font-semibold hover:bg-ink hover:text-on-brand" onClick={() => go()}>Today</button>}
          <button type="button" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-rule bg-paper-2 hover:border-field-border" onClick={() => setRefreshKey(k => k + 1)} aria-label="Refresh scores"><RefreshCw className="h-4 w-4" /></button>
        </div>
      </header>

      {error && <p className="rounded-2xl border border-rule bg-paper-2 p-5 text-sm text-error">{error}</p>}

      <section aria-label="Games">
        {!board ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(i => <div key={i} className="h-72 rounded-2xl bg-paper-3" />)}</div>
          : board.games.length === 0 ? <p className="rounded-2xl border border-rule bg-paper-2 p-8 text-sm text-muted">No NHL games on this date.</p>
          : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{board.games.map(game => (
            <GameCard key={game.id} game={game} starters={starters.get(game.id)} mine={(mineByTeam.get(game.away.abbrev) || 0) + (mineByTeam.get(game.home.abbrev) || 0)} />
          ))}</div>}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <SectionTitle>Your players on this slate</SectionTitle>
          {myPlayers.length === 0 ? <p className="text-sm text-muted">{myTeam.length ? 'None of your players are scheduled.' : 'Add players on My team to see them here.'}</p> : (
            <ul className="divide-y divide-rule">{myPlayers.map(player => {
              const game = board?.games.find(g => g.home.abbrev === player.nhlTeam || g.away.abbrev === player.nhlTeam);
              const opponent = game ? (game.home.abbrev === player.nhlTeam ? `vs ${game.away.abbrev}` : `@ ${game.home.abbrev}`) : '';
              return (
                <li key={player.id} className="flex items-center gap-3 py-3" style={{ boxShadow: 'inset 3px 0 0 var(--color-accent)' }}>
                  <span className="pl-4"><TeamLogo team={{ abbrev: player.nhlTeam }} size={26} /></span>
                  <span className="min-w-0 flex-1"><PlayerLink id={player.id} className="bb-player-link block truncate font-semibold">{player.name}</PlayerLink><span className="text-xs text-muted">{player.positions.join('/')} · {player.nhlTeam} {opponent}</span></span>
                  {game && <Link href={`/games/${game.id}`} className="text-sm font-semibold text-accent hover:underline">Game</Link>}
                </li>
              );
            })}</ul>
          )}
        </section>
        <section>
          <SectionTitle>Top projected</SectionTitle>
          <p className="mb-2 text-xs text-muted">Model estimate per game, {scoring.label}.</p>
          {leaders.length === 0 ? <p className="text-sm text-muted">Projections are loading.</p> : (
            <ol className="divide-y divide-rule">{leaders.map(({ player, points }, index) => (
              <li key={player.id}><PlayerLink id={player.id} className="flex items-center gap-3 py-2.5 hover:text-accent">
                <span className="w-6 font-display text-lg font-bold text-muted">{index + 1}</span>
                <TeamLogo team={{ abbrev: player.nhlTeam }} size={24} />
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{player.name}</span><span className="text-xs text-muted">{player.positions.join('/')} · {player.nhlTeam}</span></span>
                <span className="font-display text-xl font-bold tabular-nums">{points.toFixed(1)}</span>
              </PlayerLink></li>
            ))}</ol>
          )}
        </section>
      </div>

      <p className="text-xs text-muted">Scores refresh every 30 seconds. Goalies are confirmed from NHL game data once a game starts; before puck drop the likely starter comes from recent starts.</p>
    </div>
  );
}

export default function GamesPage() {
  return <Suspense fallback={<div className="bb-page"><p className="text-sm text-muted">Loading the NHL slate…</p></div>}><ScoreboardView /></Suspense>;
}
