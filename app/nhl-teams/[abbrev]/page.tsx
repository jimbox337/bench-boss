'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { calculateFantasyPoints, type Projection, type SkaterStats } from '@/lib/calculator';
import { useData } from '@/lib/DataContext';
import { scheduleVolume, type StandingRow, type TeamGoalieSeason, type TeamScheduleGame, type TeamSkaterSeason } from '@/lib/nhlGameCenter';
import { TeamLink, TeamLogo, pointsScoring } from '@/components/gamecenter/shared';

type TeamPayload = { abbrev: string; standing: StandingRow | null; skaters: TeamSkaterSeason[]; goalies: TeamGoalieSeason[]; schedule: TeamScheduleGame[] };

const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const shortDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
const perGameStats = (stats: SkaterStats, games: number): SkaterStats => ({
  G: stats.G / games, A: stats.A / games, PTS: stats.PTS / games, plusMinus: stats.plusMinus / games, PPP: stats.PPP / games,
  SOG: stats.SOG / games, HIT: stats.HIT / games, BLK: stats.BLK / games, PIM: stats.PIM / games,
});
const toi = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;

export default function TeamPage() {
  const { abbrev } = useParams<{ abbrev: string }>();
  const team = abbrev.toUpperCase();
  const { players, projections, myTeam, leagueSettings } = useData();
  const [data, setData] = useState<TeamPayload | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch(`/api/nhl-teams/${team}`).then(r => r.json()).then(payload => {
      if (!active) return;
      if (payload.success) setData(payload.team); else setError(payload.error || 'Team unavailable');
    }).catch(() => active && setError('Team unavailable'));
    return () => { active = false; };
  }, [team]);

  const scoring = pointsScoring(leagueSettings);
  const today = localToday();
  const volume = useMemo(() => scheduleVolume(data?.schedule || [], today), [data, today]);
  const recent = (data?.schedule || []).filter(g => g.result).slice(-5).reverse();
  const nextGames = (data?.schedule || []).filter(g => g.date >= today && !g.result).slice(0, 5);
  const mine = new Set(myTeam.map(p => p.id));
  const byId = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);
  const projectionById = useMemo(() => new Map<string, Projection>(projections.map(p => [p.playerId, p])), [projections]);

  const skaterRows = (data?.skaters || []).map(skater => {
    const player = byId.get(String(skater.playerId));
    const perGame = player?.seasonStats && player.gamesPlayed
      ? calculateFantasyPoints({ playerId: player.id, timeframe: 'per_game', gamesPlayed: 1, skaterStats: perGameStats(player.seasonStats, player.gamesPlayed) }, scoring.settings)
      : null;
    const projection = projectionById.get(String(skater.playerId));
    const next7 = projection ? calculateFantasyPoints(projection, scoring.settings) : null;
    return { skater, perGame, next7, mine: mine.has(String(skater.playerId)) };
  }).sort((a, b) => (b.perGame ?? -1) - (a.perGame ?? -1));

  if (error) return <div className="space-y-4"><Link href="/nhl-teams" className="text-sm font-semibold text-accent">← NHL Teams</Link><p className="fantasy-card p-6 text-sm text-error">{error}</p></div>;
  if (!data) return <p className="fantasy-card p-8 text-sm text-muted">Loading team…</p>;
  const s = data.standing;

  return (
    <div className="space-y-6">
      <Link href="/nhl-teams" className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"><ArrowLeft className="h-4 w-4" /> NHL Teams</Link>

      <header className="fantasy-card flex flex-wrap items-center gap-5 p-5">
        <TeamLogo team={{ abbrev: team, logo: s?.logo }} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl">{s?.name || team}</h1>
          {s && <p className="text-sm text-muted">{s.w}-{s.l}-{s.otl} · {s.pts} PTS · #{s.divisionRank} in {s.division} · L10 {s.l10} · Streak {s.streak}</p>}
        </div>
        {s && (
          <dl className="grid grid-cols-3 gap-6 text-center tabular-nums">
            <div><dt className="text-xs text-muted">GF/GP</dt><dd className="text-xl font-semibold">{(s.gf / Math.max(s.gp, 1)).toFixed(2)}</dd></div>
            <div><dt className="text-xs text-muted">GA/GP</dt><dd className="text-xl font-semibold">{(s.ga / Math.max(s.gp, 1)).toFixed(2)}</dd></div>
            <div><dt className="text-xs text-muted">PT%</dt><dd className="text-xl font-semibold">{(s.pointPct * 100).toFixed(1)}</dd></div>
          </dl>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="fantasy-card p-5">
          <h2 className="text-lg">Fantasy schedule · next 7 days</h2>
          <p className="mt-3 text-4xl font-bold tabular-nums">{volume.games}<span className="ml-2 text-sm font-normal text-muted">games</span></p>
          <p className="mt-1 text-sm text-muted">{volume.home} home · {volume.away} away{volume.backToBacks ? ` · ${volume.backToBacks} back-to-back` : ''}</p>
          <ul className="mt-4 space-y-1.5 text-sm">{volume.upcoming.map(g => (
            <li key={g.id} className="flex items-center gap-2"><span className="w-24 shrink-0 whitespace-nowrap text-muted">{shortDate(g.date)}</span><span className="w-5 text-muted">{g.home ? 'vs' : '@'}</span><TeamLogo team={{ abbrev: g.opponent }} size={18} /><TeamLink abbrev={g.opponent}>{g.opponent}</TeamLink></li>
          ))}</ul>
        </section>
        <section className="fantasy-card p-5">
          <h2 className="text-lg">Recent results</h2>
          {recent.length === 0 ? <p className="mt-3 text-sm text-muted">No games played yet.</p> : (
            <ul className="mt-3 space-y-2 text-sm">{recent.map(g => (
              <li key={g.id}><Link href={`/games/${g.id}`} className="flex items-center gap-2 hover:text-accent">
                <span className={`w-9 font-semibold ${g.result === 'W' ? 'text-success' : 'text-error'}`}>{g.result}</span>
                <span className="w-24 shrink-0 whitespace-nowrap text-muted">{shortDate(g.date)}</span><span className="w-5 text-muted">{g.home ? 'vs' : '@'}</span>
                <span className="flex-1">{g.opponent}</span><span className="whitespace-nowrap tabular-nums">{g.teamScore}–{g.oppScore}</span>
              </Link></li>
            ))}</ul>
          )}
        </section>
        <section className="fantasy-card p-5">
          <h2 className="text-lg">Up next</h2>
          {nextGames.length === 0 ? <p className="mt-3 text-sm text-muted">No upcoming games.</p> : (
            <ul className="mt-3 space-y-2 text-sm">{nextGames.map(g => (
              <li key={g.id}><Link href={`/games/${g.id}`} className="flex items-center gap-2 hover:text-accent">
                <span className="w-24 shrink-0 whitespace-nowrap text-muted">{shortDate(g.date)}</span><span className="w-5 text-muted">{g.home ? 'vs' : '@'}</span>
                <TeamLogo team={{ abbrev: g.opponent }} size={18} /><span className="flex-1">{g.opponent}</span>
                <span className="whitespace-nowrap text-xs text-muted">{new Date(g.startTimeUTC).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
              </Link></li>
            ))}</ul>
          )}
        </section>
      </div>

      <section className="fantasy-card overflow-hidden">
        <div className="border-b border-rule px-5 py-4"><h2 className="text-lg">Skaters</h2><p className="mt-1 text-xs text-muted">FPTS/GP from season stats and next-7-day model estimate, {scoring.label}.</p></div>
        <div className="overflow-x-auto">
          <table className="bb-table w-full min-w-[760px] text-sm">
            <thead><tr className="text-xs text-muted">
              <th className="sticky left-0 bg-paper-2 px-4 py-2 text-left">Player</th>
              {['FPTS/GP', 'Next 7', 'GP', 'G', 'A', 'PTS', '+/-', 'PPG', 'SOG', 'TOI'].map(h => <th key={h} className="px-2 py-2 text-right">{h}</th>)}
            </tr></thead>
            <tbody>{skaterRows.map(({ skater, perGame, next7, mine: isMine }) => (
              <tr key={skater.playerId} className={`border-t border-rule-2 ${isMine ? 'bg-selection' : ''}`}>
                <td className="sticky left-0 bg-inherit px-4 py-2"><Link href={`/players?player=${skater.playerId}`} className="font-medium hover:text-accent">{skater.name}</Link> <span className="text-xs text-muted">{skater.position}{isMine ? ' · yours' : ''}</span></td>
                <td className="px-2 py-2 text-right font-semibold tabular-nums">{perGame !== null ? perGame.toFixed(2) : '–'}</td>
                <td className="px-2 py-2 text-right tabular-nums">{next7 !== null ? next7.toFixed(1) : '–'}</td>
                {[skater.gp, skater.goals, skater.assists, skater.points, skater.plusMinus, skater.ppGoals, skater.shots].map((v, i) => <td key={i} className="px-2 py-2 text-right tabular-nums">{v}</td>)}
                <td className="px-2 py-2 text-right tabular-nums text-muted">{toi(skater.toi)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="fantasy-card overflow-hidden">
        <h2 className="border-b border-rule px-5 py-4 text-lg">Goalies</h2>
        <div className="overflow-x-auto">
          <table className="bb-table w-full min-w-[560px] text-sm">
            <thead><tr className="text-xs text-muted">
              <th className="px-4 py-2 text-left">Goalie</th>
              {['GP', 'GS', 'W', 'L', 'OTL', 'GAA', 'SV%', 'SO'].map(h => <th key={h} className="px-2 py-2 text-right">{h}</th>)}
            </tr></thead>
            <tbody>{data.goalies.map(g => (
              <tr key={g.playerId} className="border-t border-rule-2">
                <td className="px-4 py-2 font-medium">{g.name}{mine.has(String(g.playerId)) ? <span className="text-xs text-muted"> · yours</span> : null}</td>
                {[g.gp, g.gs, g.wins, g.losses, g.otLosses].map((v, i) => <td key={i} className="px-2 py-2 text-right tabular-nums">{v}</td>)}
                <td className="px-2 py-2 text-right tabular-nums">{g.gaa.toFixed(2)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{g.savePct.toFixed(3).replace(/^0/, '')}</td>
                <td className="px-2 py-2 text-right tabular-nums">{g.shutouts}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
