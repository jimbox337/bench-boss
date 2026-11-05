'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ChevronDown, ChevronRight, Clock, MapPin, Tv } from 'lucide-react';
import { useData } from '@/lib/DataContext';
import type { LeagueSettings } from '@/lib/calculator';
import {
  goalieFantasyPoints, skaterFantasyPoints, type GameDetail, type GoalieLine, type PlayEvent, type SkaterLine, type TeamScheduleGame,
} from '@/lib/nhlGameCenter';
import { teamColor } from '@/lib/teamColors';
import { SectionTitle, StarterLine, TeamLink, TeamLogo, pointsScoring } from '@/components/gamecenter/shared';
import ShotChart from '@/components/gamecenter/ShotChart';
import { PlayerLink } from '@/components/player/PlayerCardProvider';

const TABS = ['Game', 'Box score', 'Plays', 'Team stats'] as const;
type Tab = (typeof TABS)[number];
type Side = 'away' | 'home';

const PERIOD_TEXT: Record<string, string> = { '1': '1st', '2': '2nd', '3': '3rd' };
const periodText = (p: string) => PERIOD_TEXT[p] || p;
const STAT_LABELS: Record<string, string> = {
  sog: 'Shots on goal', faceoffWinningPctg: 'Faceoff %', powerPlay: 'Power play', pim: 'Penalty minutes',
  hits: 'Hits', blockedShots: 'Blocked shots', giveaways: 'Giveaways', takeaways: 'Takeaways',
};


function splitName(name: string): [string, string] {
  const parts = name.trim().split(' ');
  return parts.length > 1 ? [parts.slice(0, -1).join(' '), parts.at(-1)!] : ['', name];
}

/* ---------------------------------------------------------------- Plays */

function PlayRow({ play }: { play: PlayEvent }) {
  const teamPlay = !!play.team && play.kind !== 'stoppage' && play.kind !== 'period';
  if (!teamPlay) return <li className="py-2 pl-5 text-sm text-ink-2">{play.text}</li>;
  return (
    <li className="flex gap-3 py-2" style={{ boxShadow: `inset 3px 0 0 ${teamColor(play.team)}` }}>
      <span className="pl-4"><TeamLogo team={{ abbrev: play.team! }} size={26} /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-base font-bold tabular-nums">{play.time}</span>
        <span className={`block text-sm ${play.kind === 'goal' ? 'font-semibold text-ink' : 'text-ink-2'}`}>{play.text}</span>
      </span>
      {play.score && <span className="bb-score-chip mr-2 self-center">{play.score}</span>}
    </li>
  );
}

function PlaysTab({ plays }: { plays: PlayEvent[] }) {
  const [scoringOnly, setScoringOnly] = useState(false);
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const list = plays.filter(p => !scoringOnly || p.kind === 'goal' || p.kind === 'penalty');
  const periods = [...new Set(list.map(p => p.period))].reverse();
  return (
    <section>
      <SectionTitle>Plays</SectionTitle>
      <div className="mb-4 flex gap-2">
        {[['All plays', false], ['Scoring and penalties', true]].map(([label, value]) => (
          <button key={String(label)} type="button" onClick={() => setScoringOnly(value as boolean)} aria-pressed={scoringOnly === value}
            className={`h-9 rounded-full border px-4 text-sm font-semibold ${scoringOnly === value ? 'border-accent bg-selection text-accent' : 'border-rule text-ink-2 hover:border-field-border'}`}>{label as string}</button>
        ))}
      </div>
      {periods.length === 0 && <p className="text-sm text-muted">Plays appear after puck drop.</p>}
      {periods.map(period => (
        <div key={period} className="border-b border-rule">
          <button type="button" onClick={() => setClosed(c => ({ ...c, [period]: !c[period] }))} aria-expanded={!closed[period]} className="flex w-full items-center gap-3 py-3">
            <ChevronDown className={`h-5 w-5 transition-transform ${closed[period] ? '-rotate-90' : ''}`} aria-hidden />
            <span className="bb-section-title">{period === 'SO' ? 'Shootout' : `${periodText(period)} period`}</span>
          </button>
          {!closed[period] && <ol className="pb-3">{list.filter(p => p.period === period).reverse().map(p => <PlayRow key={p.id} play={p} />)}</ol>}
        </div>
      ))}
    </section>
  );
}

/* ---------------------------------------------------------------- Box score */

function BoxTable({ title, abbrev, rows, settings, mine }: { title: string; abbrev: string; rows: SkaterLine[]; settings: LeagueSettings; mine: Set<string> }) {
  const sorted = [...rows].sort((a, b) => b.toi.localeCompare(a.toi, undefined, { numeric: true }));
  return (
    <div className="mb-6">
      <h3 className="mb-2 flex items-center gap-2 bb-section-title"><TeamLogo team={{ abbrev }} size={24} />{title}</h3>
      <div className="overflow-x-auto rounded-xl border border-rule">
        <table className="bb-box w-full min-w-[760px]">
          <thead><tr><th className="text-left">Player</th>{['G', 'A', 'Pts', '+/-', 'PIM', 'TOI', 'SOG', 'Blk', 'Hits', 'PPP', 'FPTS'].map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{sorted.map(row => (
            <tr key={row.playerId} data-mine={mine.has(String(row.playerId)) || undefined}>
              <td className="text-left"><span className="flex justify-between gap-3"><PlayerLink id={row.playerId} className="bb-player-link font-medium">{row.name}</PlayerLink><span className="text-muted">{row.position === 'L' ? 'LW' : row.position === 'R' ? 'RW' : row.position}</span></span></td>
              {[row.goals, row.assists, row.points, row.plusMinus, row.pim, row.toi, row.sog, row.blocks, row.hits, row.ppPoints].map((v, i) => <td key={i}>{v}</td>)}
              <td className="font-bold">{skaterFantasyPoints(row, settings)?.toFixed(1)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function GoalieTable({ abbrev, rows, settings }: { abbrev: string; rows: GoalieLine[]; settings: LeagueSettings }) {
  return (
    <div className="mb-6">
      <h3 className="mb-2 flex items-center gap-2 bb-section-title"><TeamLogo team={{ abbrev }} size={24} />Goaltenders</h3>
      <div className="overflow-x-auto rounded-xl border border-rule">
        <table className="bb-box w-full min-w-[560px]">
          <thead><tr><th className="text-left">Player</th>{['Dec', 'GA', 'SA', 'SV', 'SV%', 'TOI', 'FPTS'].map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{rows.map(g => (
            <tr key={g.playerId}>
              <td className="text-left font-medium"><PlayerLink id={g.playerId} className="bb-player-link">{g.name}</PlayerLink></td><td>{g.decision || '–'}</td><td>{g.goalsAgainst}</td><td>{g.shotsAgainst}</td><td>{g.saves}</td>
              <td>{g.savePct !== undefined ? g.savePct.toFixed(3).replace(/^0/, '') : '–'}</td><td>{g.toi}</td><td className="font-bold">{goalieFantasyPoints(g, settings)?.toFixed(1)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function BoxScoreTab({ detail, settings, label, mine }: { detail: GameDetail; settings: LeagueSettings; label: string; mine: Set<string> }) {
  const [side, setSide] = useState<Side>('away');
  const team = detail.game[side];
  const skaters = detail.skaters.filter(r => r.team === team.abbrev);
  return (
    <section>
      <SectionTitle>Player stats</SectionTitle>
      <div className="mx-auto mb-6 flex max-w-xl rounded-full border border-rule bg-paper-3 p-1" role="tablist" aria-label="Team">
        {(['away', 'home'] as const).map(s => (
          <button key={s} type="button" role="tab" aria-selected={side === s} onClick={() => setSide(s)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-full py-2 text-sm font-semibold ${side === s ? 'bg-paper-2 text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
            <TeamLogo team={detail.game[s]} size={22} />{detail.game[s].name}
          </button>
        ))}
      </div>
      {skaters.length === 0 ? <p className="text-sm text-muted">Player stats appear after puck drop.</p> : <>
        <BoxTable title="Forwards" abbrev={team.abbrev} rows={skaters.filter(r => r.position !== 'D')} settings={settings} mine={mine} />
        <BoxTable title="Defense" abbrev={team.abbrev} rows={skaters.filter(r => r.position === 'D')} settings={settings} mine={mine} />
        <GoalieTable abbrev={team.abbrev} rows={detail.goalies.filter(g => g.team === team.abbrev)} settings={settings} />
        <p className="text-sm"><span className="font-bold">Scratches</span><br /><span className="text-ink-2">{detail.scratches[side].join(', ') || 'Not posted'}</span></p>
      </>}
      <p className="mt-4 text-xs text-muted">FPTS uses {label}. PPP from the scoring summary.</p>
    </section>
  );
}

/* ---------------------------------------------------------------- Game tab */

function LeaderCard({ label, away, home, game }: { label: string; away: { name: string; value: string } | null; home: { name: string; value: string } | null; game: GameDetail['game'] }) {
  return (
    <div className="relative grid grid-cols-2 overflow-hidden rounded-2xl text-white">
      <span className="absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded bg-paper-2 px-2 py-0.5 font-display text-xs font-bold uppercase tracking-wide text-ink">{label}</span>
      {(['away', 'home'] as const).map(side => {
        const entry = side === 'away' ? away : home;
        return (
          <div key={side} className={`flex min-h-32 flex-col justify-end gap-1 p-4 ${side === 'home' ? 'items-end text-right' : ''}`} style={{ background: teamColor(game[side].abbrev) }}>
            <span className="bb-logo-disc"><TeamLogo team={game[side]} size={26} /></span>
            <span className="font-display text-3xl font-bold leading-none tabular-nums">{entry?.value ?? '–'}</span>
            <span className="font-display text-sm font-bold uppercase tracking-wide">{entry?.name ?? 'No data yet'}</span>
          </div>
        );
      })}
    </div>
  );
}

function GameTab({ detail, settings, onAllPlays }: { detail: GameDetail; settings: LeagueSettings; onAllPlays: () => void }) {
  const { game } = detail;
  const started = game.isLive || game.isFinal;
  const recent = detail.plays.filter(p => p.kind !== 'faceoff').slice(-6).reverse();
  const goalieLeader = (side: Side) => {
    const g = detail.goalies.filter(x => x.team === game[side].abbrev).sort((a, b) => b.saves - a.saves)[0];
    return g && g.toi !== '00:00' ? { name: g.name, value: `${g.saves} SV` } : null;
  };
  const fantasyLeader = (side: Side) => {
    const r = detail.skaters.filter(x => x.team === game[side].abbrev).sort((a, b) => (skaterFantasyPoints(b, settings) ?? 0) - (skaterFantasyPoints(a, settings) ?? 0))[0];
    return r ? { name: r.name, value: `${skaterFantasyPoints(r, settings)?.toFixed(1)} FP` } : null;
  };
  return (
    <div className="space-y-8">
      {detail.threeStars.length > 0 && (
        <section>
          <SectionTitle>Three stars</SectionTitle>
          <ol className="grid gap-3 sm:grid-cols-3">
            {[...detail.threeStars].sort((a, b) => a.star - b.star).map(star => (
              <li key={star.playerId} className="bb-star" data-star={star.star} style={{ '--team': teamColor(star.team) } as React.CSSProperties}>
                <span className="bb-star-rank" aria-label={`${['First', 'Second', 'Third'][star.star - 1] || `Star ${star.star}`} star`}>
                  <span aria-hidden>★</span>{star.star}
                </span>
                {star.headshot && <img src={star.headshot} alt="" className="bb-star-photo" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                <span className="min-w-0">
                  <PlayerLink id={star.playerId} className="bb-player-link bb-star-name">{star.name}</PlayerLink>
                  <span className="flex items-center gap-1.5 text-xs text-muted"><TeamLogo team={{ abbrev: star.team }} size={16} />{star.team}{star.position ? ` · ${star.position === 'L' ? 'LW' : star.position === 'R' ? 'RW' : star.position}` : ''}{star.number !== undefined ? ` · #${star.number}` : ''}</span>
                  {star.line && <span className="bb-star-line">{star.line}</span>}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="grid gap-6 2xl:grid-cols-2">
        <section>
          <SectionTitle>Shot chart</SectionTitle>
          {started ? <ShotChart plays={detail.plays} away={game.away.abbrev} home={game.home.abbrev} /> : <p className="text-sm text-muted">Shots appear after puck drop.</p>}
        </section>
        <section>
          <SectionTitle action={<button type="button" onClick={onAllPlays} className="flex items-center gap-1 text-sm font-semibold text-accent">View all <ChevronRight className="h-4 w-4" /></button>}>Recent plays</SectionTitle>
          {recent.length === 0 ? <p className="text-sm text-muted">Plays appear after puck drop.</p> : <ol>{recent.map(p => <PlayRow key={p.id} play={p} />)}</ol>}
        </section>
      </div>

      <section>
        <SectionTitle>Score by period</SectionTitle>
        <div className="overflow-x-auto rounded-xl border border-rule">
          <table className="bb-box w-full">
            <thead><tr><th className="text-left">Team</th>{game.lineScore.periods.map(p => <th key={p}>{p}</th>)}<th>T</th><th>SOG</th></tr></thead>
            <tbody>{(['away', 'home'] as const).map(side => (
              <tr key={side}>
                <td className="text-left"><span className="flex items-center gap-2 font-semibold"><TeamLogo team={game[side]} size={22} />{game[side].name}</span></td>
                {game.lineScore[side].map((v, i) => <td key={i}>{started ? v : '–'}</td>)}
                <td className="font-bold">{started ? game[side].score ?? 0 : '–'}</td>
                <td>{detail.shotsByPeriod.periods.length ? detail.shotsByPeriod[side].reduce((a, b) => a + b, 0) : game[side].sog ?? '–'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section>
        <SectionTitle>Stat leaders</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <LeaderCard label="Saves" away={goalieLeader('away')} home={goalieLeader('home')} game={game} />
          <LeaderCard label="Fantasy points" away={fantasyLeader('away')} home={fantasyLeader('home')} game={game} />
        </div>
      </section>

      <section>
        <SectionTitle>Scoring summary</SectionTitle>
        {detail.scoring.length === 0 ? <p className="text-sm text-muted">{started ? 'No goals yet.' : 'The game has not started.'}</p> : (
          <ol>{detail.scoring.map((goal, i) => (
            <li key={i} className="flex gap-3 py-2" style={{ boxShadow: `inset 3px 0 0 ${teamColor(goal.team)}` }}>
              <span className="pl-4"><TeamLogo team={{ abbrev: goal.team }} size={26} /></span>
              <span className="flex-1">
                <span className="block font-display text-base font-bold">{goal.period === 'SO' ? 'Shootout' : `${periodText(goal.period)} · ${goal.time}`}{goal.strength !== 'ev' && <span className="ml-2 rounded bg-paper-3 px-1.5 text-xs uppercase">{goal.strength}</span>}</span>
                <span className="block text-sm"><span className="font-semibold">{goal.scorer}</span>{goal.goalsToDate ? ` (${goal.goalsToDate})` : ''} · <span className="text-ink-2">{goal.assists.length ? goal.assists.map(a => a.name).join(', ') : 'Unassisted'}</span></span>
              </span>
              <span className="bb-score-chip mr-2 self-center">{goal.awayScore}–{goal.homeScore}</span>
            </li>
          ))}</ol>
        )}
      </section>
    </div>
  );
}

function TeamStatsTab({ detail }: { detail: GameDetail }) {
  const { game } = detail;
  const rows = detail.teamStats.filter(s => STAT_LABELS[s.category]);
  const num = (v: string | number) => (typeof v === 'number' ? v : Number(String(v).split('/')[0]) || 0);
  const fmt = (c: string, v: string | number) => (typeof v === 'number' && c.toLowerCase().includes('pctg') ? `${Math.round(v * 100)}%` : String(v));
  return (
    <section className="max-w-2xl">
      <SectionTitle>Team stats</SectionTitle>
      {rows.length === 0 ? <p className="text-sm text-muted">Team stats appear after puck drop.</p> : rows.map(s => {
        const a = num(s.away), h = num(s.home), share = a + h ? (a / (a + h)) * 100 : 50;
        return (
          <div key={s.category} className="py-2.5">
            <div className="mb-1.5 flex justify-between text-sm"><span className="font-display text-lg font-bold tabular-nums">{fmt(s.category, s.away)}</span><span className="text-muted">{STAT_LABELS[s.category]}</span><span className="font-display text-lg font-bold tabular-nums">{fmt(s.category, s.home)}</span></div>
            <div className="flex h-2 gap-1" aria-hidden><span className="rounded-full" style={{ width: `${share}%`, background: teamColor(game.away.abbrev) }} /><span className="flex-1 rounded-full" style={{ background: teamColor(game.home.abbrev) }} /></div>
          </div>
        );
      })}
    </section>
  );
}

/* ---------------------------------------------------------------- Right column */

function ScheduleList({ abbrev, games }: { abbrev: string; games: TeamScheduleGame[] }) {
  return (
    <section>
      <SectionTitle action={<Link href={`/nhl-teams/${abbrev}`} aria-label={`${abbrev} schedule`}><ChevronRight className="h-5 w-5" /></Link>}>
        <span className="flex items-center gap-2"><TeamLogo team={{ abbrev }} size={24} />Schedule</span>
      </SectionTitle>
      {games.length === 0 ? <p className="text-sm text-muted">No upcoming games.</p> : (
        <ul className="divide-y divide-rule">{games.map(g => {
          const awayTeam = g.home ? g.opponent : abbrev, homeTeam = g.home ? abbrev : g.opponent;
          return (
            <li key={g.id}><Link href={`/games/${g.id}`} className="grid grid-cols-[1fr_auto] gap-3 py-3 hover:text-accent">
              <span className="space-y-1.5 font-display text-base font-bold">
                <span className="flex items-center gap-2"><TeamLogo team={{ abbrev: awayTeam }} size={22} />{awayTeam}</span>
                <span className="flex items-center gap-2"><TeamLogo team={{ abbrev: homeTeam }} size={22} />{homeTeam}</span>
              </span>
              <span className="border-l border-rule pl-3 text-right text-xs leading-relaxed text-muted">
                {new Date(g.startTimeUTC).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}<br />
                {new Date(g.startTimeUTC).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </span>
            </Link></li>
          );
        })}</ul>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- Page */

export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  const { myTeam, leagueSettings } = useData();
  const [detail, setDetail] = useState<GameDetail | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('Game');
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
  const periodShort = game.periodType === 'SO' ? 'SO' : game.periodType === 'OT' ? 'OT' : ['1ST', '2ND', '3RD'][(game.period || 1) - 1];
  const status: [string, string] = game.isLive
    ? (game.inIntermission ? [`END ${periodShort}`, 'Intermission'] : [periodShort, game.clock || ''])
    : game.isFinal ? ['FINAL', game.periodType && game.periodType !== 'REG' ? game.periodType : '']
    : [new Date(game.startTimeUTC).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toUpperCase(), new Date(game.startTimeUTC).toLocaleDateString([], { month: 'short', day: 'numeric' })];
  const myRows = [
    ...detail.skaters.filter(r => mine.has(String(r.playerId))).map(r => ({ id: r.playerId, name: r.name, team: r.team, line: `${r.goals}G ${r.assists}A ${r.sog} SOG`, fpts: skaterFantasyPoints(r, scoring.settings) ?? 0 })),
    ...detail.goalies.filter(g => mine.has(String(g.playerId)) && g.toi !== '00:00').map(g => ({ id: g.playerId, name: g.name, team: g.team, line: `${g.saves} SV ${g.goalsAgainst} GA`, fpts: goalieFantasyPoints(g, scoring.settings) ?? 0 })),
  ].sort((a, b) => b.fpts - a.fpts);

  const heroTeam = (side: Side) => {
    const [fallbackCity, fallbackNick] = splitName(game[side].name);
    const city = game[side].city || fallbackCity;
    const nick = game[side].city ? game[side].name : fallbackNick;
    const record = detail.records[side];
    return (
      <div className={`flex items-center gap-3 md:gap-4 ${side === 'home' ? 'flex-row-reverse text-right' : ''}`}>
        <span className="flex flex-col items-center gap-1">
          <TeamLogo team={game[side]} size={56} />
          <span className="text-xs text-muted tabular-nums">{record?.overall}</span>
        </span>
        <TeamLink abbrev={game[side].abbrev} className="hidden leading-tight sm:block">
          <span className="block text-lg text-ink-2">{city || game[side].abbrev}</span>
          <span className="bb-team-nick">{nick}</span>
        </TeamLink>
      </div>
    );
  };

  return (
    <div className="bb-page">
      <Link href={`/games?date=${game.gameDate}`} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"><ArrowLeft className="h-4 w-4" /> Scores</Link>
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <header className="bb-game-hero overflow-hidden rounded-2xl border border-rule" style={{ '--away': teamColor(game.away.abbrev), '--home': teamColor(game.home.abbrev) } as React.CSSProperties}>
            <div className="flex h-1.5 gap-1" aria-hidden><span className="flex-1" style={{ background: teamColor(game.away.abbrev) }} /><span className="flex-1" style={{ background: teamColor(game.home.abbrev) }} /></div>
            <div className="grid grid-cols-[1fr_auto_auto_auto_1fr] items-center gap-3 px-4 py-6 md:gap-6 md:px-6">
              {heroTeam('away')}
              <span className="bb-led-score">{started ? game.away.score ?? 0 : ''}</span>
              <span className="bb-faceoff" data-live={game.isLive || undefined}><strong>{status[0]}</strong>{status[1] && <span>{status[1]}</span>}</span>
              <span className="bb-led-score">{started ? game.home.score ?? 0 : ''}</span>
              {heroTeam('home')}
            </div>
            {game.broadcasts.length > 0 && <p className="pb-4 text-center text-sm text-muted">{game.broadcasts.join(' · ')}</p>}
          </header>

          <nav className="bb-goal-tabs mt-6" role="tablist" aria-label="Game sections">
            {TABS.map(name => (
              <button key={name} type="button" role="tab" aria-selected={tab === name} onClick={() => setTab(name)}>{name}</button>
            ))}
          </nav>

          <div className="pt-6">
            {tab === 'Game' && <GameTab detail={detail} settings={scoring.settings} onAllPlays={() => setTab('Plays')} />}
            {tab === 'Box score' && <BoxScoreTab detail={detail} settings={scoring.settings} label={scoring.label} mine={mine} />}
            {tab === 'Plays' && <PlaysTab plays={detail.plays} />}
            {tab === 'Team stats' && <TeamStatsTab detail={detail} />}
          </div>
        </div>

        <aside className="space-y-8">
          <section>
            <SectionTitle>Game details</SectionTitle>
            <ul className="space-y-3 text-[15px]">
              <li className="flex items-center gap-3"><Clock className="h-5 w-5 text-ink-2" aria-hidden />{new Date(game.startTimeUTC).toLocaleString([], { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</li>
              {game.broadcasts.length > 0 && <li className="flex items-center gap-3"><Tv className="h-5 w-5 text-ink-2" aria-hidden />{game.broadcasts.join(', ')}</li>}
              {game.venue && <li className="flex items-center gap-3"><MapPin className="h-5 w-5 text-ink-2" aria-hidden />{game.venue}</li>}
            </ul>
          </section>
          <section>
            <SectionTitle>Starting goalies</SectionTitle>
            <ul className="space-y-2">{(['away', 'home'] as const).map(side => (
              <li key={side} className="flex items-center gap-3"><TeamLogo team={game[side]} size={22} /><StarterLine starter={detail.starters?.[side]} /></li>
            ))}</ul>
          </section>
          <section>
            <SectionTitle>Your players</SectionTitle>
            {myRows.length === 0 ? <p className="text-sm text-muted">{myTeam.length ? 'None of your players are in this game.' : 'Add players to your team to follow them here.'}</p> : (
              <ul className="divide-y divide-rule">{myRows.map(row => (
                <li key={row.id} className="flex items-center gap-3 py-2"><TeamLogo team={{ abbrev: row.team }} size={22} />
                  <span className="min-w-0 flex-1"><PlayerLink id={row.id} className="bb-player-link block truncate font-medium">{row.name}</PlayerLink><span className="text-xs text-muted">{row.line}</span></span>
                  <span className="font-display text-lg font-bold tabular-nums">{row.fpts.toFixed(1)}</span></li>
              ))}</ul>
            )}
          </section>
          {(['home', 'away'] as const).map(side => <ScheduleList key={side} abbrev={game[side].abbrev} games={detail.schedules?.[side] || []} />)}
        </aside>
      </div>
    </div>
  );
}
