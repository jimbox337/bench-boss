'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { calculateFantasyPoints, type Projection, type SkaterStats } from '@/lib/calculator';
import { useData } from '@/lib/DataContext';
import { scheduleVolume, type StandingRow, type TeamGoalieSeason, type TeamScheduleGame, type TeamSkaterSeason } from '@/lib/nhlGameCenter';
import { SectionTitle, TeamLogo, pointsScoring } from '@/components/gamecenter/shared';
import { teamColor } from '@/lib/teamColors';

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

  if (error) return <div className="bb-page space-y-4"><Link href="/nhl-teams" className="text-sm font-semibold text-accent">← NHL Teams</Link><p className="fantasy-card p-6 text-sm text-error">{error}</p></div>;
  if (!data) return <div className="bb-page"><p className="fantasy-card p-8 text-sm text-muted">Loading team…</p></div>;
  const s = data.standing;

  const color = teamColor(team);
  const gameRow = (g: TeamScheduleGame, withResult: boolean) => (
    <li key={g.id}><Link href={`/games/${g.id}`} className="flex items-center gap-3 py-2.5 hover:text-accent" style={{ boxShadow: `inset 3px 0 0 ${withResult ? (g.result === 'W' ? 'var(--color-success)' : 'var(--color-error)') : teamColor(g.opponent)}` }}>
      <span className="w-24 shrink-0 pl-4 text-sm text-muted">{shortDate(g.date)}</span>
      <span className="w-6 text-sm text-muted">{g.home ? 'vs' : '@'}</span>
      <TeamLogo team={{ abbrev: g.opponent }} size={24} />
      <span className="flex-1 font-display text-base font-bold">{g.opponent}</span>
      {withResult
        ? <span className="whitespace-nowrap font-display text-base font-bold tabular-nums"><span className={g.result === 'W' ? 'text-success' : 'text-error'}>{g.result}</span> {g.teamScore}–{g.oppScore}</span>
        : <span className="whitespace-nowrap text-xs text-muted">{new Date(g.startTimeUTC).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>}
    </Link></li>
  );

  return (
    <div className="bb-page space-y-10">
      <div>
        <Link href="/nhl-teams" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"><ArrowLeft className="h-4 w-4" /> Teams</Link>
        <header className="overflow-hidden rounded-2xl border border-rule bg-paper-2">
          <div className="h-2" style={{ background: color }} aria-hidden />
          <div className="flex flex-wrap items-center gap-5 px-6 py-6">
            <TeamLogo team={{ abbrev: team, logo: s?.logo }} size={84} />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-xl text-ink-2">{s?.city}</p>
              <h1 className="font-display text-4xl font-bold uppercase tracking-wide">{s?.name || team}</h1>
              {s && <p className="mt-1 text-sm text-muted">{s.w}-{s.l}-{s.otl} · {s.pts} PTS · #{s.divisionRank} {s.division} · L10 {s.l10} · Streak {s.streak}</p>}
            </div>
            {s && (
              <dl className="grid grid-cols-3 gap-8 text-center">
                {[['GF/GP', (s.gf / Math.max(s.gp, 1)).toFixed(2)], ['GA/GP', (s.ga / Math.max(s.gp, 1)).toFixed(2)], ['PT%', (s.pointPct * 100).toFixed(1)]].map(([label, value]) => (
                  <div key={label}><dt className="text-xs font-semibold text-muted">{label}</dt><dd className="font-display text-3xl font-bold tabular-nums">{value}</dd></div>
                ))}
              </dl>
            )}
          </div>
        </header>
      </div>

      <div className="grid gap-10 lg:grid-cols-3">
        <section>
          <SectionTitle>Fantasy week</SectionTitle>
          <p className="font-display text-5xl font-bold tabular-nums">{volume.games}<span className="ml-2 font-body text-sm font-normal text-muted">games in the next 7 days</span></p>
          <p className="mt-1 text-sm text-muted">{volume.home} home · {volume.away} away{volume.backToBacks ? ` · ${volume.backToBacks} back-to-back` : ''}</p>
          <ul className="mt-3 divide-y divide-rule">{volume.upcoming.map(g => gameRow(g, false))}</ul>
        </section>
        <section>
          <SectionTitle>Recent results</SectionTitle>
          {recent.length === 0 ? <p className="text-sm text-muted">No games played yet.</p> : <ul className="divide-y divide-rule">{recent.map(g => gameRow(g, true))}</ul>}
        </section>
        <section>
          <SectionTitle>Up next</SectionTitle>
          {nextGames.length === 0 ? <p className="text-sm text-muted">No upcoming games.</p> : <ul className="divide-y divide-rule">{nextGames.map(g => gameRow(g, false))}</ul>}
        </section>
      </div>

      <section>
        <SectionTitle action={<span className="text-xs text-muted">FPTS/GP from season stats · Next 7 is a model estimate · {scoring.label}</span>}>
          <span className="flex items-center gap-2"><TeamLogo team={{ abbrev: team }} size={24} />Skaters</span>
        </SectionTitle>
        <div className="overflow-x-auto rounded-xl border border-rule">
          <table className="bb-box w-full min-w-[780px]">
            <thead><tr><th className="text-left">Player</th>{['FPTS/GP', 'Next 7', 'GP', 'G', 'A', 'Pts', '+/-', 'PPG', 'SOG', 'TOI'].map(h => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{skaterRows.map(({ skater, perGame, next7, mine: isMine }) => (
              <tr key={skater.playerId} data-mine={isMine || undefined}>
                <td className="text-left"><span className="flex justify-between gap-3"><Link href={`/players?player=${skater.playerId}`} className="font-medium hover:text-accent">{skater.name}{isMine ? ' · yours' : ''}</Link><span className="text-muted">{skater.position}</span></span></td>
                <td className="font-bold">{perGame !== null ? perGame.toFixed(2) : '–'}</td>
                <td>{next7 !== null ? next7.toFixed(1) : '–'}</td>
                {[skater.gp, skater.goals, skater.assists, skater.points, skater.plusMinus, skater.ppGoals, skater.shots].map((v, i) => <td key={i}>{v}</td>)}
                <td>{toi(skater.toi)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section>
        <SectionTitle><span className="flex items-center gap-2"><TeamLogo team={{ abbrev: team }} size={24} />Goaltenders</span></SectionTitle>
        <div className="overflow-x-auto rounded-xl border border-rule">
          <table className="bb-box w-full min-w-[600px]">
            <thead><tr><th className="text-left">Player</th>{['GP', 'GS', 'W', 'L', 'OTL', 'GAA', 'SV%', 'SO'].map(h => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{data.goalies.map(g => (
              <tr key={g.playerId} data-mine={mine.has(String(g.playerId)) || undefined}>
                <td className="text-left font-medium">{g.name}</td>
                {[g.gp, g.gs, g.wins, g.losses, g.otLosses].map((v, i) => <td key={i}>{v}</td>)}
                <td>{g.gaa.toFixed(2)}</td><td>{g.savePct.toFixed(3).replace(/^0/, '')}</td><td>{g.shutouts}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
