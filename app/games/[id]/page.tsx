'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Star } from 'lucide-react';
import { useData } from '@/lib/DataContext';
import type { LeagueSettings } from '@/lib/calculator';
import type { TeamStarter } from '@/lib/goalieStarters';
import {
  goalieFantasyPoints, skaterFantasyPoints, type GameDetail, type GoalieLine, type PlayEvent, type PlayKind, type SkaterLine,
} from '@/lib/nhlGameCenter';
import { StarterLine, StatusBadge, TeamLink, TeamLogo, gameStatusText, pointsScoring } from '@/components/gamecenter/shared';

const PERIOD_TEXT: Record<string, string> = { '1': '1st', '2': '2nd', '3': '3rd' };
const periodText = (p: string) => PERIOD_TEXT[p] || p;

const STAT_LABELS: Record<string, string> = {
  sog: 'Shots on goal', faceoffWinningPctg: 'Faceoff %', powerPlay: 'Power play', pim: 'Penalty minutes',
  hits: 'Hits', blockedShots: 'Blocked shots', giveaways: 'Giveaways', takeaways: 'Takeaways',
};

const FILTERS: { name: string; kinds: PlayKind[] | null }[] = [
  { name: 'All plays', kinds: null },
  { name: 'Goals and penalties', kinds: ['goal', 'penalty', 'period'] },
  { name: 'Shots', kinds: ['goal', 'shot', 'miss', 'block'] },
  { name: 'Hits', kinds: ['hit'] },
];

function formatStat(category: string, value: string | number) {
  if (typeof value === 'number' && category.toLowerCase().includes('pctg')) return `${Math.round(value * 100)}%`;
  return String(value);
}

function StatBar({ label, away, home, awayValue, homeValue }: { label: string; away: string; home: string; awayValue: number; homeValue: number }) {
  const total = awayValue + homeValue;
  const awayShare = total > 0 ? (awayValue / total) * 100 : 50;
  return (
    <div className="py-2">
      <div className="mb-1 flex justify-between text-sm tabular-nums"><span className="font-semibold">{away}</span><span className="text-muted">{label}</span><span className="font-semibold">{home}</span></div>
      <div className="flex h-2 gap-1 overflow-hidden" aria-hidden><span className="rounded-full bg-accent" style={{ width: `${awayShare}%` }} /><span className="flex-1 rounded-full bg-brand-navy" /></div>
    </div>
  );
}

function Panel({ title, children, action, className = '' }: { title: string; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <section className={`fantasy-card overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3"><h2 className="text-base">{title}</h2>{action}</div>
      {children}
    </section>
  );
}

/** Compact per-team box ("On the ice"): skaters by fantasy points, then goalies. */
function TeamBox({ team, abbrev, skaters, goalies, settings, mine }: { team: string; abbrev: string; skaters: SkaterLine[]; goalies: GoalieLine[]; settings: LeagueSettings; mine: Set<string> }) {
  const [all, setAll] = useState(false);
  const rows = [...skaters].sort((a, b) => (skaterFantasyPoints(b, settings) ?? 0) - (skaterFantasyPoints(a, settings) ?? 0) || b.toi.localeCompare(a.toi));
  const shown = all ? rows : rows.slice(0, 6);
  const playedGoalies = goalies.filter(g => g.toi !== '00:00' || g.shotsAgainst > 0);
  return (
    <div className="border-b border-rule last:border-b-0">
      <h3 className="flex items-center gap-2 px-4 pb-1 pt-3 text-sm font-semibold"><TeamLogo team={{ abbrev }} size={20} />{team}</h3>
      <table className="w-full text-[13px] tabular-nums">
        <thead><tr className="text-[11px] text-muted"><th className="px-4 py-1 text-left font-medium">Skater</th>{['G', 'A', 'SOG', 'FPTS'].map(h => <th key={h} className="px-1.5 py-1 text-right font-medium last:pr-4">{h}</th>)}</tr></thead>
        <tbody>{shown.map(row => (
          <tr key={row.playerId} className={`border-t border-rule-2 ${mine.has(String(row.playerId)) ? 'bg-selection' : ''}`}>
            <td className="max-w-0 truncate px-4 py-1.5"><span className="font-medium">{row.name}</span> <span className="text-[11px] text-muted">{row.position}</span></td>
            <td className="px-1.5 text-right">{row.goals}</td><td className="px-1.5 text-right">{row.assists}</td><td className="px-1.5 text-right">{row.sog}</td>
            <td className="px-1.5 pr-4 text-right font-semibold">{skaterFantasyPoints(row, settings)?.toFixed(1)}</td>
          </tr>
        ))}</tbody>
      </table>
      {rows.length > 6 && <button type="button" className="w-full px-4 py-2 text-left text-xs font-semibold text-accent hover:underline" onClick={() => setAll(v => !v)}>{all ? 'Show top 6' : `Show all ${rows.length} skaters`}</button>}
      {playedGoalies.length > 0 && (
        <table className="w-full text-[13px] tabular-nums">
          <thead><tr className="text-[11px] text-muted"><th className="px-4 py-1 text-left font-medium">Goalie</th>{['SA', 'GA', 'SV%', 'FPTS'].map(h => <th key={h} className="px-1.5 py-1 text-right font-medium last:pr-4">{h}</th>)}</tr></thead>
          <tbody>{playedGoalies.map(g => (
            <tr key={g.playerId} className="border-t border-rule-2">
              <td className="px-4 py-1.5 font-medium">{g.name}{g.decision ? <span className="ml-1 text-[11px] text-muted">{g.decision}</span> : null}</td>
              <td className="px-1.5 text-right">{g.shotsAgainst}</td><td className="px-1.5 text-right">{g.goalsAgainst}</td>
              <td className="px-1.5 text-right">{g.savePct !== undefined ? g.savePct.toFixed(3).replace(/^0/, '') : '–'}</td>
              <td className="px-1.5 pr-4 text-right font-semibold">{goalieFantasyPoints(g, settings)?.toFixed(1)}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  );
}

function PlayFeed({ plays, started }: { plays: PlayEvent[]; started: boolean }) {
  const [filter, setFilter] = useState(0);
  const [limit, setLimit] = useState(40);
  const kinds = FILTERS[filter].kinds;
  const visible = plays.filter(p => !kinds || kinds.includes(p.kind)).reverse();
  const shown = visible.slice(0, limit);
  return (
    <Panel title="Play-by-play" action={<span className="text-xs text-muted">{plays.length} events</span>}>
      <div className="flex gap-1.5 overflow-x-auto border-b border-rule-2 px-4 py-2" role="group" aria-label="Filter plays">
        {FILTERS.map((f, i) => (
          <button key={f.name} type="button" onClick={() => { setFilter(i); setLimit(40); }} aria-pressed={filter === i}
            className={`h-8 whitespace-nowrap rounded-full px-3.5 text-xs font-semibold ${filter === i ? 'bg-ink text-on-brand' : 'border border-rule text-ink-2 hover:border-field-border'}`}>{f.name}</button>
        ))}
      </div>
      {!started ? <p className="p-4 text-sm text-muted">Play-by-play starts at puck drop.</p> : shown.length === 0 ? <p className="p-4 text-sm text-muted">No plays of this type yet.</p> : (
        <ol>{shown.map((play, i) => {
          const header = i === 0 || shown[i - 1].period !== play.period;
          return (
            <li key={play.id}>
              {header && <p className="bg-paper-3 px-4 py-1.5 text-xs font-semibold text-ink-2">{play.period === 'SO' ? 'Shootout' : `${periodText(play.period)} period`}</p>}
              <div className={`flex items-start gap-3 border-t border-rule-2 px-4 py-2 text-sm ${play.kind === 'goal' ? 'bg-selection' : ''}`}>
                <span className="w-11 shrink-0 pt-px text-xs text-muted tabular-nums">{play.time}</span>
                {play.team ? <TeamLogo team={{ abbrev: play.team }} size={18} /> : <span className="w-[18px] shrink-0" />}
                <span className={`flex-1 ${play.kind === 'goal' || play.kind === 'penalty' ? 'font-semibold text-ink' : play.kind === 'period' ? 'font-semibold text-ink-2' : 'text-ink-2'}`}>{play.text}</span>
                {play.score && <span className="shrink-0 rounded-md bg-ink px-2 py-0.5 font-display text-sm font-bold text-on-brand tabular-nums">{play.score}</span>}
              </div>
            </li>
          );
        })}</ol>
      )}
      {visible.length > limit && <button type="button" onClick={() => setLimit(l => l + 60)} className="w-full border-t border-rule-2 px-4 py-2.5 text-sm font-semibold text-accent hover:bg-paper">Show earlier plays</button>}
    </Panel>
  );
}

function FullBox({ rows, goalies, settings, mine }: { rows: SkaterLine[]; goalies: GoalieLine[]; settings: LeagueSettings; mine: Set<string> }) {
  const sorted = [...rows].sort((a, b) => (skaterFantasyPoints(b, settings) ?? 0) - (skaterFantasyPoints(a, settings) ?? 0));
  return (
    <div className="overflow-x-auto">
      <table className="bb-table w-full min-w-[720px] text-sm tabular-nums">
        <thead><tr className="text-xs text-muted">
          <th className="sticky left-0 bg-paper-2 px-4 py-2 text-left">Skater</th>
          {['FPTS', 'G', 'A', 'PTS', '+/-', 'SOG', 'HIT', 'BLK', 'PPP', 'PIM', 'TOI'].map(h => <th key={h} className="px-2 py-2 text-right">{h}</th>)}
        </tr></thead>
        <tbody>{sorted.map(row => (
          <tr key={row.playerId} className={`border-t border-rule-2 ${mine.has(String(row.playerId)) ? 'bg-selection' : ''}`}>
            <td className="sticky left-0 bg-inherit px-4 py-1.5"><span className="font-medium">{row.name}</span> <span className="text-xs text-muted">{row.position}</span></td>
            <td className="px-2 text-right font-semibold">{skaterFantasyPoints(row, settings)?.toFixed(1)}</td>
            {[row.goals, row.assists, row.points, row.plusMinus, row.sog, row.hits, row.blocks, row.ppPoints, row.pim].map((v, i) => <td key={i} className="px-2 text-right">{v}</td>)}
            <td className="px-2 text-right text-muted">{row.toi}</td>
          </tr>
        ))}</tbody>
      </table>
      <table className="bb-table w-full min-w-[560px] border-t border-rule text-sm tabular-nums">
        <thead><tr className="text-xs text-muted"><th className="px-4 py-2 text-left">Goalie</th>{['FPTS', 'DEC', 'SA', 'SV', 'GA', 'SV%', 'TOI'].map(h => <th key={h} className="px-2 py-2 text-right">{h}</th>)}</tr></thead>
        <tbody>{goalies.filter(g => g.toi !== '00:00' || g.shotsAgainst > 0).map(g => (
          <tr key={g.playerId} className="border-t border-rule-2">
            <td className="px-4 py-1.5 font-medium">{g.name}</td><td className="px-2 text-right font-semibold">{goalieFantasyPoints(g, settings)?.toFixed(1)}</td>
            <td className="px-2 text-right">{g.decision || '–'}</td><td className="px-2 text-right">{g.shotsAgainst}</td><td className="px-2 text-right">{g.saves}</td><td className="px-2 text-right">{g.goalsAgainst}</td>
            <td className="px-2 text-right">{g.savePct !== undefined ? g.savePct.toFixed(3).replace(/^0/, '') : '–'}</td><td className="px-2 text-right text-muted">{g.toi}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  const { myTeam, leagueSettings } = useData();
  const [detail, setDetail] = useState<GameDetail | null>(null);
  const [error, setError] = useState('');
  const live = detail?.game.isLive ?? false;

  useEffect(() => {
    let active = true;
    const load = () => fetch(`/api/games/${id}`).then(r => r.json()).then(data => {
      if (!active) return;
      if (data.success) { setDetail(data.detail); setError(''); } else setError(data.error || 'Game unavailable');
    }).catch(() => active && setError('Game unavailable'));
    void load();
    const timer = window.setInterval(() => void load(), live ? 20_000 : 120_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [id, live]);

  const scoring = pointsScoring(leagueSettings);
  const mine = useMemo(() => new Set(myTeam.map(player => player.id)), [myTeam]);

  if (error && !detail) return <div className="bb-page space-y-4"><Link href="/games" className="text-sm font-semibold text-accent">← Scores</Link><p className="fantasy-card p-6 text-sm text-error">{error}</p></div>;
  if (!detail) return <div className="bb-page"><p className="fantasy-card p-8 text-sm text-muted">Loading game…</p></div>;

  const { game } = detail;
  const started = game.isLive || game.isFinal;
  const shots = detail.shotsByPeriod.periods.length
    ? { away: detail.shotsByPeriod.away.reduce((a, b) => a + b, 0), home: detail.shotsByPeriod.home.reduce((a, b) => a + b, 0) }
    : { away: game.away.sog ?? 0, home: game.home.sog ?? 0 };
  const myRows = [
    ...detail.skaters.filter(r => mine.has(String(r.playerId))).map(r => ({ id: r.playerId, name: r.name, team: r.team, line: `${r.goals}G ${r.assists}A ${r.sog} SOG ${r.hits} HIT ${r.blocks} BLK`, fpts: skaterFantasyPoints(r, scoring.settings) ?? 0 })),
    ...detail.goalies.filter(g => mine.has(String(g.playerId)) && g.toi !== '00:00').map(g => ({ id: g.playerId, name: g.name, team: g.team, line: `${g.saves} SV ${g.goalsAgainst} GA`, fpts: goalieFantasyPoints(g, scoring.settings) ?? 0 })),
  ].sort((a, b) => b.fpts - a.fpts);
  const starterFor = (side: 'away' | 'home'): TeamStarter | undefined => detail.starters?.[side];

  const teamBlock = (side: 'away' | 'home') => {
    const team = game[side];
    const record = detail.records[side];
    return (
      <div className={`flex min-w-0 flex-col items-center gap-2 text-center md:gap-4 ${side === 'home' ? 'md:flex-row-reverse md:text-right' : 'md:flex-row md:text-left'}`}>
        <TeamLogo team={team} size={64} />
        <div className="min-w-0 max-w-full">
          <TeamLink abbrev={team.abbrev} className="block truncate font-display text-base font-bold uppercase tracking-wide md:text-2xl"><span className="md:hidden">{team.abbrev}</span><span className="hidden md:inline">{team.name}</span></TeamLink>
          <p className="text-xs text-muted">{record ? <>{record.overall}<span className="hidden sm:inline">, {record.split}</span></> : side === 'away' ? 'Away' : 'Home'}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="bb-page space-y-5">
      <Link href={`/games?date=${game.gameDate}`} className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"><ArrowLeft className="h-4 w-4" /> Scores</Link>

      <header className="fantasy-card px-5 py-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto_auto_minmax(0,1fr)]">
          {teamBlock('away')}
          <p className="hidden font-display text-6xl font-bold tabular-nums md:block" aria-label={`${game.away.abbrev} ${game.away.score ?? 0}`}>{started ? game.away.score ?? 0 : ''}</p>
          <div className="min-w-0 text-center md:min-w-[190px]">
            <p className={`mb-2 text-sm font-semibold ${game.isLive ? 'text-error' : 'text-ink'}`}>{gameStatusText(game)}</p>
            <p className="mb-2 font-display text-4xl font-bold tabular-nums md:hidden">{started ? `${game.away.score ?? 0} – ${game.home.score ?? 0}` : 'vs'}</p>
            <table className="mx-auto font-display text-[15px] tabular-nums" aria-label="Score by period">
              <thead><tr className="text-muted"><th className="pr-3 text-left font-medium" />{game.lineScore.periods.map(p => <th key={p} className="w-7 font-medium">{p}</th>)}<th className="w-7 font-semibold text-ink">T</th><th className="w-9 font-medium">SOG</th></tr></thead>
              <tbody>{(['away', 'home'] as const).map(side => (
                <tr key={side} className="border-t border-rule-2"><td className="pr-3 text-left font-semibold">{game[side].abbrev}</td>
                  {game.lineScore[side].map((v, i) => <td key={i} className="py-0.5">{started ? v : '–'}</td>)}
                  <td className="font-bold">{started ? game[side].score ?? 0 : '–'}</td><td className="text-muted">{started ? shots[side] : '–'}</td></tr>
              ))}</tbody>
            </table>
            {game.broadcasts.length > 0 && <p className="mt-2 text-xs text-muted">{game.broadcasts.join(' · ')}</p>}
          </div>
          <p className="hidden font-display text-6xl font-bold tabular-nums md:block" aria-label={`${game.home.abbrev} ${game.home.score ?? 0}`}>{started ? game.home.score ?? 0 : ''}</p>
          {teamBlock('home')}
        </div>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[340px_minmax(0,1fr)_300px]">
        <Panel title="On the ice" action={<span className="text-xs text-muted">FPTS: {scoring.label}</span>} className="order-2 xl:order-none">
          {(['away', 'home'] as const).map(side => (
            <TeamBox key={side} team={game[side].name} abbrev={game[side].abbrev} skaters={detail.skaters.filter(r => r.team === game[side].abbrev)}
              goalies={detail.goalies.filter(g => g.team === game[side].abbrev)} settings={scoring.settings} mine={mine} />
          ))}
          {detail.skaters.length === 0 && <p className="p-4 text-sm text-muted">Lineups appear at puck drop.</p>}
        </Panel>

        <div className="order-1 space-y-5 xl:order-none">
          <PlayFeed plays={detail.plays} started={started} />
          <Panel title="Scoring summary">
            {detail.scoring.length === 0 ? <p className="p-4 text-sm text-muted">{started ? 'No goals yet.' : 'The game has not started.'}</p> : (
              <ol className="divide-y divide-rule-2">{detail.scoring.map((goal, i) => (
                <li key={i} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                  <span className="w-20 shrink-0 text-xs text-muted tabular-nums">{goal.period === 'SO' ? 'Shootout' : `${periodText(goal.period)} ${goal.time}`}</span>
                  <TeamLogo team={{ abbrev: goal.team }} size={20} />
                  <span className="flex-1"><span className="font-semibold">{goal.scorer}</span>{goal.goalsToDate ? ` (${goal.goalsToDate})` : ''}{goal.strength !== 'ev' && <span className="ml-1.5 rounded-md bg-paper-3 px-1.5 text-[11px] font-bold uppercase">{goal.strength}</span>}
                    <span className="block text-xs text-muted">{goal.assists.length ? `Assists: ${goal.assists.map(a => a.name).join(', ')}` : 'Unassisted'}</span></span>
                  <span className="text-xs font-semibold tabular-nums">{goal.awayScore}–{goal.homeScore}</span>
                </li>
              ))}</ol>
            )}
          </Panel>
          {detail.teamStats.length > 0 && (
            <Panel title="Team stats" action={<span className="flex items-center gap-3 text-xs font-semibold"><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-accent" />{game.away.abbrev}</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-brand-navy" />{game.home.abbrev}</span></span>}>
              <div className="px-4 py-2">{detail.teamStats.filter(s => STAT_LABELS[s.category]).map(s => {
                const num = (v: string | number) => typeof v === 'number' ? v : Number(String(v).split('/')[0]) || 0;
                return <StatBar key={s.category} label={STAT_LABELS[s.category]} away={formatStat(s.category, s.away)} home={formatStat(s.category, s.home)} awayValue={num(s.away)} homeValue={num(s.home)} />;
              })}</div>
            </Panel>
          )}
        </div>

        <aside className="order-3 space-y-5 xl:order-none">
          <Panel title="Your players">
            {myRows.length === 0 ? <p className="p-4 text-sm text-muted">{myTeam.length ? 'None of your players are in this game.' : 'Add players to your team to track them here.'}</p> : (
              <ul className="divide-y divide-rule-2">{myRows.map(row => (
                <li key={row.id} className="flex items-center gap-3 px-4 py-2.5"><TeamLogo team={{ abbrev: row.team }} size={20} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{row.name}</span><span className="text-xs text-muted">{row.line}</span></span>
                  <span className="font-semibold tabular-nums">{row.fpts.toFixed(1)}</span></li>
              ))}</ul>
            )}
          </Panel>
          <Panel title="Starting goalies">
            <ul className="divide-y divide-rule-2">{(['away', 'home'] as const).map(side => (
              <li key={side} className="flex items-center gap-3 px-4 py-2.5"><TeamLogo team={game[side]} size={20} /><StarterLine starter={starterFor(side)} /></li>
            ))}</ul>
          </Panel>
          <Panel title="Three stars">
            {detail.threeStars.length === 0 ? <p className="p-4 text-sm text-muted">Announced after the game.</p> : (
              <ol className="divide-y divide-rule-2">{detail.threeStars.map(star => (
                <li key={star.star} className="flex items-center gap-2 px-4 py-2.5 text-sm"><Star className="h-4 w-4 text-accent" aria-hidden /><span className="font-semibold">{star.name}</span><span className="text-muted">{star.team} · {star.line}</span></li>
              ))}</ol>
            )}
          </Panel>
          <Panel title="Season series">
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="flex items-center gap-2 font-semibold"><TeamLogo team={game.away} size={22} />{game.away.abbrev} {detail.seasonSeries.away}</span>
              <span className="text-xs text-muted">wins</span>
              <span className="flex items-center gap-2 font-semibold">{detail.seasonSeries.home} {game.home.abbrev}<TeamLogo team={game.home} size={22} /></span>
            </div>
          </Panel>
          <Panel title="Game info">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 px-4 py-3 text-sm">
              {game.venue && <><dt className="text-muted">Arena</dt><dd>{game.venue}</dd></>}
              {detail.coaches.away && <><dt className="text-muted">Coaches</dt><dd>{detail.coaches.away} / {detail.coaches.home}</dd></>}
              <dt className="text-muted">Scratches</dt>
              <dd>{detail.scratches.away.length || detail.scratches.home.length
                ? (['away', 'home'] as const).filter(side => detail.scratches[side].length).map(side => <span key={side} className="block"><span className="font-semibold">{game[side].abbrev}:</span> {detail.scratches[side].join(', ')}</span>)
                : 'Not posted yet'}</dd>
            </dl>
          </Panel>
        </aside>
      </div>

      {detail.skaters.length > 0 && (
        <section className="space-y-5" aria-label="Full box score">
          <h2 className="text-lg">Full box score</h2>
          {(['away', 'home'] as const).map(side => (
            <Panel key={side} title={game[side].name} action={<StatusBadge game={game} />}>
              <FullBox rows={detail.skaters.filter(r => r.team === game[side].abbrev)} goalies={detail.goalies.filter(g => g.team === game[side].abbrev)} settings={scoring.settings} mine={mine} />
            </Panel>
          ))}
        </section>
      )}
    </div>
  );
}
