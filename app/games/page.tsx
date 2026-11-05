'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, CalendarDays, Clock3, RefreshCw, TrendingUp } from 'lucide-react';
import { calculateFantasyPoints, defaultLeagueSettings } from '@/lib/calculator';
import { useData } from '@/lib/DataContext';
import type { GameStarters, TeamStarter } from '@/lib/goalieStarters';

type NHLTeam = { abbrev: string; score?: number; logo?: string; commonName?: { default?: string }; placeName?: { default?: string } };
type NHLGame = { id: number; gameDate: string; startTimeUTC: string; gameState: string; periodDescriptor?: { number?: number; periodType?: string }; clock?: { timeRemaining?: string; inIntermission?: boolean }; homeTeam: NHLTeam; awayTeam: NHLTeam };

function teamName(team: NHLTeam) { return team.commonName?.default || team.placeName?.default || team.abbrev; }
function gameStatus(game: NHLGame) {
  if (['LIVE', 'CRIT'].includes(game.gameState)) return game.clock?.inIntermission ? 'Intermission' : `${game.periodDescriptor?.number ? `P${game.periodDescriptor.number} · ` : ''}${game.clock?.timeRemaining || 'Live'}`;
  if (['FINAL', 'OFF'].includes(game.gameState)) return 'Final';
  return new Date(game.startTimeUTC).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function StarterLine({ starter }: { starter?: TeamStarter }) {
  if (!starter) return <p className="pl-11 text-xs text-muted">Goalie: loading…</p>;
  if (starter.status === 'unknown') return <p className="pl-11 text-xs text-muted">Goalie: not confirmed</p>;
  if (starter.status === 'confirmed') {
    return <p className="pl-11 text-xs"><span className="text-muted">G </span><span className="font-medium">{starter.name}</span> <span className="font-semibold text-success" title={starter.source}>✓ Confirmed</span></p>;
  }
  return <p className="pl-11 text-xs text-muted" title={starter.source}>G {starter.name} · <span className="italic">likely, not confirmed</span> ({starter.starts} of last {starter.ofGames} starts)</p>;
}

export default function GamesPage() {
  const { players, projections, myTeam, leagueSettings } = useData();
  const [games, setGames] = useState<NHLGame[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [starters, setStarters] = useState<Map<number, GameStarters>>(new Map());

  const loadGames = async () => {
    const response = await fetch('/api/games');
    const data = await response.json();
    if (data.success) { setGames(data.games); setUpdatedAt(new Date(data.updatedAt)); }
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    const loadStarters = () => fetch('/api/goalie-starters')
      .then(response => response.json())
      .then(data => {
        if (active && data.success) setStarters(new Map((data.starters as GameStarters[]).map(row => [row.gameId, row])));
      })
      .catch(() => { /* Keep the last known goalie information. */ });
    void loadStarters();
    const timer = window.setInterval(() => void loadStarters(), 120_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    void loadGames();
    const timer = window.setInterval(() => void loadGames(), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const teamsPlaying = useMemo(() => new Set(games.flatMap(game => [game.homeTeam.abbrev, game.awayTeam.abbrev])), [games]);
  const myPlayersTonight = myTeam.filter(player => teamsPlaying.has(player.nhlTeam));
  const leaders = players
    .filter(player => teamsPlaying.has(player.nhlTeam))
    .map(player => {
      const projection = projections.find(item => item.playerId === player.id);
      const points = projection && (leagueSettings.scoringType === 'H2H_Points')
        ? calculateFantasyPoints(projection, leagueSettings.pointsPerStat ? leagueSettings : defaultLeagueSettings) / Math.max(projection.gamesPlayed, 1)
        : projection?.skaterStats?.PTS ? projection.skaterStats.PTS / Math.max(projection.gamesPlayed, 1) : 0;
      return { player, projection, points };
    })
    .sort((a, b) => b.points - a.points)
    .slice(0, 12);

  return (
    <div className="space-y-6">
      <header className="bb-page-header flex flex-wrap items-end justify-between gap-4">
        <div><p className="fantasy-kicker">LIVE NHL</p><h1>Game Center</h1><p>Tonight’s slate, live scores and fantasy players who matter in your league.</p></div>
        <button onClick={() => void loadGames()} className="bb-button-secondary inline-flex items-center gap-2 px-4 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Refresh</button>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="fantasy-card p-5"><CalendarDays className="h-5 w-5 text-accent" /><p className="mt-3 text-3xl font-semibold">{games.length}</p><p className="text-sm text-muted">Games today</p></div>
        <div className="fantasy-card p-5"><Activity className="h-5 w-5 text-success" /><p className="mt-3 text-3xl font-semibold">{games.filter(game => ['LIVE', 'CRIT'].includes(game.gameState)).length}</p><p className="text-sm text-muted">Live now</p></div>
        <div className="fantasy-card p-5"><TrendingUp className="h-5 w-5 text-accent" /><p className="mt-3 text-3xl font-semibold">{myPlayersTonight.length}</p><p className="text-sm text-muted">Your players tonight</p></div>
      </div>

      <section className="fantasy-card overflow-hidden">
        <div className="bb-dashboard-panel-heading flex items-center justify-between border-b border-rule px-5 py-4"><h2 className="text-lg">Today’s games</h2>{updatedAt && <span className="text-xs text-muted">Updated {updatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>}</div>
        {loading ? <p className="p-8 text-sm text-muted">Loading the live NHL slate…</p> : games.length === 0 ? <p className="p-8 text-sm text-muted">No NHL games today.</p> : <div className="grid gap-px bg-rule md:grid-cols-2 xl:grid-cols-3">{games.map(game => (
          <article key={game.id} className="bg-paper p-5">
            <div className="mb-4 flex items-center justify-between text-xs"><span className={['LIVE', 'CRIT'].includes(game.gameState) ? 'font-semibold text-success' : 'text-muted'}>{gameStatus(game)}</span><span className="text-muted">{game.gameState}</span></div>
            {([['away', game.awayTeam], ['home', game.homeTeam]] as const).map(([side, team]) => <div key={team.abbrev} className="py-2"><div className="flex items-center gap-3"><img src={team.logo} alt="" className="h-8 w-8 object-contain" /><span className="flex-1 font-medium">{teamName(team)}</span><span className="text-xl font-semibold tabular-nums">{team.score ?? '—'}</span></div><StarterLine starter={starters.get(game.id)?.[side].starter} /></div>)}
          </article>
        ))}</div>}
      </section>

      <section className="fantasy-card overflow-hidden">
        <div className="bb-dashboard-panel-heading border-b border-rule px-5 py-4"><h2 className="text-lg">Dynamic top tonight</h2><p className="mt-1 text-xs text-muted">Per-game projection using your league scoring when connected.</p></div>
        <div className="divide-y divide-rule">{leaders.map(({ player, projection, points }, index) => (
          <Link href={`/players?player=${player.id}`} key={player.id} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-paper-2">
            <span className="w-6 text-sm font-semibold text-muted">{index + 1}</span><img src={player.headshotUrl} alt="" className="h-10 w-10 rounded-full bg-paper-2 object-cover" /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{player.name}</span><span className="text-xs text-muted">{player.nhlTeam} · {projection?.context?.opponents.join(', ') || 'Tonight'}</span></span><span className="text-right"><span className="block font-semibold tabular-nums">{points.toFixed(1)}</span><span className="text-xs text-muted">proj/game</span></span>
          </Link>
        ))}</div>
      </section>

      <p className="flex items-center gap-2 text-xs text-muted"><Clock3 className="h-4 w-4" /> Live scores refresh every 30 seconds. Goalies are marked confirmed from NHL game data once the game starts; before puck drop the likely starter comes from recent starts.</p>
    </div>
  );
}
