'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Clock3, RefreshCw, Tv } from 'lucide-react';
import { calculateFantasyPoints } from '@/lib/calculator';
import { useData } from '@/lib/DataContext';
import type { GameStarters } from '@/lib/goalieStarters';
import type { ScoreboardGame } from '@/lib/nhlGameCenter';
import { LineScore, StarterLine, StatusBadge, TeamLink, TeamLogo, pointsScoring } from '@/components/gamecenter/shared';

type Scoreboard = { date: string; prevDate?: string; nextDate?: string; games: ScoreboardGame[]; updatedAt: string };

function formatDay(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

function GameCard({ game, starters, myPlayerTeams }: { game: ScoreboardGame; starters?: GameStarters; myPlayerTeams: Map<string, number> }) {
  const mine = (myPlayerTeams.get(game.away.abbrev) || 0) + (myPlayerTeams.get(game.home.abbrev) || 0);
  const scorers = (team: string) => game.goals.filter(goal => goal.team === team && goal.period !== 'SO');
  return (
    <article className="flex flex-col border-b border-r border-rule bg-paper-2 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <StatusBadge game={game} />
        {mine > 0 && <span className="rounded-full bg-selection px-2.5 py-0.5 text-xs font-semibold text-accent-2">{mine} of your players</span>}
      </div>
      <LineScore game={game} />
      <div className="mt-3 grid gap-1">
        {(['away', 'home'] as const).map(side => <StarterLine key={side} starter={starters?.[side].starter} />)}
      </div>
      {game.goals.length > 0 && (
        <div className="mt-3 grid gap-1 border-t border-rule-2 pt-3 text-xs">
          {[game.away.abbrev, game.home.abbrev].map(team => {
            const list = scorers(team);
            return (
              <p key={team} className="text-ink-2"><span className="font-semibold text-ink">{team}</span>{' '}
                {list.length ? list.map(goal => `${goal.scorer}${goal.goalsToDate ? ` (${goal.goalsToDate})` : ''}${goal.strength === 'pp' ? ' PP' : goal.strength === 'sh' ? ' SH' : ''}`).join(', ') : 'No goals'}
              </p>
            );
          })}
        </div>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-xs">
        <span className="flex items-center gap-1 text-muted">{game.broadcasts.length > 0 && <><Tv className="h-3.5 w-3.5" aria-hidden />{game.broadcasts.slice(0, 2).join(', ')}</>}</span>
        <Link href={`/games/${game.id}`} className="font-semibold text-accent hover:underline">{game.isLive || game.isFinal ? 'Box score' : 'Preview'} →</Link>
      </div>
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

  const anyLive = board?.games.some(game => game.isLive) ?? false;

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

  const teamsPlaying = useMemo(() => new Set(board?.games.flatMap(game => [game.home.abbrev, game.away.abbrev]) || []), [board]);
  const myPlayerTeams = useMemo(() => {
    const counts = new Map<string, number>();
    for (const player of myTeam) counts.set(player.nhlTeam, (counts.get(player.nhlTeam) || 0) + 1);
    return counts;
  }, [myTeam]);
  const myPlayersOnSlate = myTeam.filter(player => teamsPlaying.has(player.nhlTeam));
  const scoring = pointsScoring(leagueSettings);
  const leaders = players
    .filter(player => teamsPlaying.has(player.nhlTeam))
    .map(player => {
      const projection = projections.find(item => item.playerId === player.id);
      const points = projection ? calculateFantasyPoints(projection, scoring.settings) / Math.max(projection.gamesPlayed, 1) : 0;
      return { player, points };
    })
    .filter(row => row.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 10);

  const go = (date?: string) => router.push(date ? `/games?date=${date}` : '/games');
  const live = board?.games.filter(game => game.isLive).length || 0;
  const final = board?.games.filter(game => game.isFinal).length || 0;

  return (
    <div className="bb-page space-y-6">
      <header className="bb-page-header flex flex-wrap items-end justify-between gap-4">
        <div><h1>Scoreboard</h1><p>Live NHL scores, starting goalies and the fantasy players in every game.</p></div>
        <button onClick={() => setRefreshKey(key => key + 1)} className="bb-button-secondary inline-flex items-center gap-2 px-4 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Refresh</button>
      </header>

      <div className="fantasy-card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <button className="bb-button-secondary inline-flex h-11 w-11 shrink-0 items-center justify-center" style={{ padding: 0 }} onClick={() => go(board?.prevDate)} disabled={!board?.prevDate} aria-label="Previous day"><ChevronLeft className="h-4 w-4" /></button>
          <p className="min-w-52 text-center font-semibold">{board ? formatDay(board.date) : 'Loading…'}</p>
          <button className="bb-button-secondary inline-flex h-11 w-11 shrink-0 items-center justify-center" style={{ padding: 0 }} onClick={() => go(board?.nextDate)} disabled={!board?.nextDate} aria-label="Next day"><ChevronRight className="h-4 w-4" /></button>
          {requestedDate && <button className="ml-1 text-sm font-semibold text-accent hover:underline" onClick={() => go()}>Today</button>}
        </div>
        <p className="text-sm text-muted tabular-nums">{board?.games.length || 0} games · {live} live · {final} final{myPlayersOnSlate.length ? ` · ${myPlayersOnSlate.length} of your players` : ''}</p>
      </div>

      {error && <p className="fantasy-card p-5 text-sm text-error">{error}</p>}

      <section aria-label="Games">
        {!board ? <p className="fantasy-card p-8 text-sm text-muted">Loading the NHL slate…</p>
          : board.games.length === 0 ? <p className="fantasy-card p-8 text-sm text-muted">No NHL games on this date.</p>
          : <div className="grid overflow-hidden rounded-card border-l border-t border-rule bg-paper-2 md:grid-cols-2 xl:grid-cols-3">{board.games.map(game => <GameCard key={game.id} game={game} starters={starters.get(game.id)} myPlayerTeams={myPlayerTeams} />)}</div>}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="fantasy-card overflow-hidden">
          <div className="border-b border-rule px-5 py-4"><h2 className="text-lg">Your players on this slate</h2><p className="mt-1 text-xs text-muted">From your roster{myTeam.length ? '' : ' — add players on My Team to see them here'}.</p></div>
          {myPlayersOnSlate.length === 0 ? <p className="p-5 text-sm text-muted">None of your players are scheduled.</p> : (
            <ul className="divide-y divide-rule">{myPlayersOnSlate.map(player => {
              const game = board?.games.find(g => g.home.abbrev === player.nhlTeam || g.away.abbrev === player.nhlTeam);
              const opponent = game ? (game.home.abbrev === player.nhlTeam ? `vs ${game.away.abbrev}` : `@ ${game.home.abbrev}`) : '';
              return (
                <li key={player.id} className="flex items-center gap-3 px-5 py-3">
                  <TeamLogo team={{ abbrev: player.nhlTeam }} size={24} />
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{player.name}</span><span className="text-xs text-muted">{player.positions.join('/')} · <TeamLink abbrev={player.nhlTeam}>{player.nhlTeam}</TeamLink> {opponent}</span></span>
                  {game && <Link href={`/games/${game.id}`} className="text-xs font-semibold text-accent hover:underline">Game →</Link>}
                </li>
              );
            })}</ul>
          )}
        </section>

        <section className="fantasy-card overflow-hidden">
          <div className="border-b border-rule px-5 py-4"><h2 className="text-lg">Top projected on this slate</h2><p className="mt-1 text-xs text-muted">Model estimate per game, {scoring.label}.</p></div>
          {leaders.length === 0 ? <p className="p-5 text-sm text-muted">Projections are loading.</p> : (
            <ol className="divide-y divide-rule">{leaders.map(({ player, points }, index) => (
              <li key={player.id}>
                <Link href={`/players?player=${player.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-paper-3">
                  <span className="w-5 text-sm font-semibold text-muted">{index + 1}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{player.name}</span><span className="text-xs text-muted">{player.positions.join('/')} · {player.nhlTeam}</span></span>
                  <span className="text-right font-semibold tabular-nums">{points.toFixed(1)}<span className="block text-xs font-normal text-muted">pts/game</span></span>
                </Link>
              </li>
            ))}</ol>
          )}
        </section>
      </div>

      <p className="flex items-center gap-2 text-xs text-muted"><Clock3 className="h-4 w-4" /> Scores refresh every 30 seconds{anyLive ? ' (games live now)' : ''}. Goalies are confirmed from NHL game data once a game starts; before puck drop the likely starter comes from recent starts.</p>
    </div>
  );
}

export default function GamesPage() {
  return <Suspense fallback={<div className="bb-page"><p className="fantasy-card p-8 text-sm text-muted">Loading the NHL slate…</p></div>}><ScoreboardView /></Suspense>;
}
