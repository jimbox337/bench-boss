'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Star } from 'lucide-react';
import { useData } from '@/lib/DataContext';
import { goalieFantasyPoints, skaterFantasyPoints, type GameDetail, type GoalieLine, type SkaterLine } from '@/lib/nhlGameCenter';
import { LineScore, StatusBadge, TeamLink, TeamLogo, pointsScoring } from '@/components/gamecenter/shared';

const PERIOD_TEXT: Record<string, string> = { '1': '1st', '2': '2nd', '3': '3rd' };

const TABS = ['Summary', 'Box score', 'Team stats', 'Fantasy'] as const;
type Tab = (typeof TABS)[number];

const STAT_LABELS: Record<string, string> = {
  sog: 'Shots on goal', faceoffWinningPctg: 'Faceoff %', powerPlay: 'Power play', pim: 'Penalty minutes',
  hits: 'Hits', blockedShots: 'Blocked shots', giveaways: 'Giveaways', takeaways: 'Takeaways',
};

function formatStat(category: string, value: string | number) {
  if (typeof value === 'number' && category.toLowerCase().includes('pctg')) return `${Math.round(value * 100)}%`;
  return String(value);
}

function StatBar({ label, away, home, awayValue, homeValue }: { label: string; away: string; home: string; awayValue: number; homeValue: number }) {
  const total = awayValue + homeValue;
  const awayShare = total > 0 ? (awayValue / total) * 100 : 50;
  return (
    <div className="py-2.5">
      <div className="mb-1.5 flex justify-between text-sm tabular-nums"><span className="font-semibold">{away}</span><span className="text-muted">{label}</span><span className="font-semibold">{home}</span></div>
      <div className="flex h-2 overflow-hidden rounded bg-paper-3" aria-hidden><span className="bg-accent" style={{ width: `${awayShare}%` }} /><span className="flex-1 bg-brand-navy" /></div>
    </div>
  );
}

function SkaterTable({ rows, scoringSettings, mine }: { rows: SkaterLine[]; scoringSettings: ReturnType<typeof pointsScoring>['settings']; mine: Set<string> }) {
  const sorted = [...rows].sort((a, b) => (skaterFantasyPoints(b, scoringSettings) ?? 0) - (skaterFantasyPoints(a, scoringSettings) ?? 0));
  return (
    <div className="overflow-x-auto">
      <table className="bb-table w-full min-w-[720px] text-sm">
        <thead><tr className="text-xs text-muted">
          <th className="sticky left-0 bg-paper-2 px-3 py-2 text-left">Skater</th>
          {['FPTS', 'G', 'A', 'PTS', '+/-', 'SOG', 'HIT', 'BLK', 'PPP', 'PIM', 'TOI'].map(h => <th key={h} className="px-2 py-2 text-right">{h}</th>)}
        </tr></thead>
        <tbody>{sorted.map(row => (
          <tr key={row.playerId} className={`border-t border-rule-2 ${mine.has(String(row.playerId)) ? 'bg-selection' : ''}`}>
            <td className="sticky left-0 bg-inherit px-3 py-2"><span className="font-medium">{row.name}</span> <span className="text-xs text-muted">{row.position}{mine.has(String(row.playerId)) ? ' · yours' : ''}</span></td>
            <td className="px-2 py-2 text-right font-semibold tabular-nums">{skaterFantasyPoints(row, scoringSettings)?.toFixed(1)}</td>
            {[row.goals, row.assists, row.points, row.plusMinus, row.sog, row.hits, row.blocks, row.ppPoints, row.pim].map((v, i) => <td key={i} className="px-2 py-2 text-right tabular-nums">{v}</td>)}
            <td className="px-2 py-2 text-right tabular-nums text-muted">{row.toi}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function GoalieTable({ rows, scoringSettings }: { rows: GoalieLine[]; scoringSettings: ReturnType<typeof pointsScoring>['settings'] }) {
  return (
    <div className="overflow-x-auto">
      <table className="bb-table w-full min-w-[560px] text-sm">
        <thead><tr className="text-xs text-muted">
          <th className="px-3 py-2 text-left">Goalie</th>
          {['FPTS', 'DEC', 'SA', 'SV', 'GA', 'SV%', 'TOI'].map(h => <th key={h} className="px-2 py-2 text-right">{h}</th>)}
        </tr></thead>
        <tbody>{rows.filter(row => row.toi !== '00:00' || row.shotsAgainst > 0).map(row => (
          <tr key={row.playerId} className="border-t border-rule-2">
            <td className="px-3 py-2 font-medium">{row.name}</td>
            <td className="px-2 py-2 text-right font-semibold tabular-nums">{goalieFantasyPoints(row, scoringSettings)?.toFixed(1)}</td>
            <td className="px-2 py-2 text-right">{row.decision || '–'}</td>
            {[row.shotsAgainst, row.saves, row.goalsAgainst].map((v, i) => <td key={i} className="px-2 py-2 text-right tabular-nums">{v}</td>)}
            <td className="px-2 py-2 text-right tabular-nums">{row.savePct !== undefined ? row.savePct.toFixed(3).replace(/^0/, '') : '–'}</td>
            <td className="px-2 py-2 text-right tabular-nums text-muted">{row.toi}</td>
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
  const [tab, setTab] = useState<Tab>('Summary');
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

  if (error && !detail) return <div className="bb-page space-y-4"><Link href="/games" className="text-sm font-semibold text-accent">← Scoreboard</Link><p className="fantasy-card p-6 text-sm text-error">{error}</p></div>;
  if (!detail) return <div className="bb-page"><p className="fantasy-card p-8 text-sm text-muted">Loading game…</p></div>;

  const { game } = detail;
  const started = game.isLive || game.isFinal;
  // One source for shots everywhere on the page (the two NHL feeds refresh at different times).
  const shotTotals = detail.shotsByPeriod.periods.length
    ? { away: detail.shotsByPeriod.away.reduce((a, b) => a + b, 0), home: detail.shotsByPeriod.home.reduce((a, b) => a + b, 0) }
    : { away: game.away.sog ?? 0, home: game.home.sog ?? 0 };
  const fantasyRows = [
    ...detail.skaters.map(row => ({ id: row.playerId, name: row.name, team: row.team, pos: row.position, line: `${row.goals}G ${row.assists}A ${row.sog} SOG ${row.hits} HIT ${row.blocks} BLK`, fpts: skaterFantasyPoints(row, scoring.settings) ?? 0 })),
    ...detail.goalies.filter(g => g.toi !== '00:00').map(row => ({ id: row.playerId, name: row.name, team: row.team, pos: 'G', line: `${row.saves} SV ${row.goalsAgainst} GA${row.decision ? ` · ${row.decision}` : ''}`, fpts: goalieFantasyPoints(row, scoring.settings) ?? 0 })),
  ].sort((a, b) => b.fpts - a.fpts);
  const myRows = fantasyRows.filter(row => mine.has(String(row.id)));

  return (
    <div className="bb-page space-y-5">
      <Link href={`/games?date=${game.gameDate}`} className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"><ArrowLeft className="h-4 w-4" /> Scoreboard</Link>

      <header className="fantasy-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><StatusBadge game={game} /><span className="text-xs text-muted">{game.venue}{game.broadcasts.length ? ` · ${game.broadcasts.join(', ')}` : ''}</span></div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          {(['away', 'home'] as const).map((side, index) => {
            const team = game[side];
            const block = (
              <div key={side} className={`flex items-center gap-3 ${index === 1 ? 'flex-row-reverse text-right' : ''}`}>
                <TeamLogo team={team} size={56} />
                <div><TeamLink abbrev={team.abbrev} className="text-lg font-semibold">{team.name}</TeamLink><p className="text-xs text-muted">{side === 'away' ? 'Away' : 'Home'} · {shotTotals[side]} SOG</p></div>
              </div>
            );
            return index === 0 ? [block, <p key="score" className="text-4xl font-bold tabular-nums">{started ? `${game.away.score ?? 0} – ${game.home.score ?? 0}` : 'vs'}</p>] : block;
          })}
        </div>
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-rule" aria-label="Game sections">
        {TABS.map(name => (
          <button key={name} onClick={() => setTab(name)} className={`min-h-11 whitespace-nowrap px-4 text-sm font-semibold ${tab === name ? 'border-b-2 border-accent text-accent' : 'text-muted hover:text-ink'}`} aria-current={tab === name ? 'page' : undefined}>{name}</button>
        ))}
      </nav>

      {tab === 'Summary' && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <section className="fantasy-card p-5"><h2 className="mb-3 text-lg">Score by period</h2><LineScore game={game} shots={detail.shotsByPeriod.periods.length ? detail.shotsByPeriod : undefined} /></section>
            <section className="fantasy-card p-5">
              <h2 className="mb-3 text-lg">Scoring</h2>
              {detail.scoring.length === 0 ? <p className="text-sm text-muted">{started ? 'No goals yet.' : 'The game has not started.'}</p> : (
                <ol className="divide-y divide-rule-2">{detail.scoring.map((goal, index) => (
                  <li key={index} className="flex items-start gap-3 py-2.5 text-sm">
                    <span className="w-20 shrink-0 text-xs text-muted tabular-nums">{goal.period === 'SO' ? 'Shootout' : `${PERIOD_TEXT[goal.period] || goal.period} ${goal.time}`}</span>
                    <TeamLogo team={{ abbrev: goal.team }} size={20} />
                    <span className="flex-1"><span className="font-semibold">{goal.scorer}</span>{goal.goalsToDate ? ` (${goal.goalsToDate})` : ''}{goal.strength !== 'ev' && <span className="ml-1 rounded bg-paper-3 px-1 text-xs font-semibold uppercase">{goal.strength}</span>}
                      <span className="block text-xs text-muted">{goal.assists.length ? `Assists: ${goal.assists.map(a => a.name).join(', ')}` : 'Unassisted'}</span></span>
                    <span className="text-xs font-semibold tabular-nums">{goal.awayScore}–{goal.homeScore}</span>
                  </li>
                ))}</ol>
              )}
            </section>
            {detail.penalties.length > 0 && (
              <section className="fantasy-card p-5">
                <h2 className="mb-3 text-lg">Penalties</h2>
                <ul className="divide-y divide-rule-2 text-sm">{detail.penalties.map((p, i) => (
                  <li key={i} className="flex gap-3 py-2"><span className="w-20 shrink-0 text-xs text-muted tabular-nums">{p.period === 'OT' ? 'OT' : `P${p.period}`} {p.time}</span><span className="w-10 font-semibold">{p.team}</span><span className="flex-1 capitalize">{p.player} · {p.type} ({p.minutes} min)</span></li>
                ))}</ul>
              </section>
            )}
          </div>
          <aside className="space-y-5">
            <section className="fantasy-card p-5">
              <h2 className="mb-3 text-lg">Three stars</h2>
              {detail.threeStars.length === 0 ? <p className="text-sm text-muted">Announced after the game.</p> : (
                <ol className="space-y-2">{detail.threeStars.map(star => (
                  <li key={star.star} className="flex items-center gap-2 text-sm"><Star className="h-4 w-4 text-accent" aria-hidden /><span className="font-semibold">{star.name}</span><span className="text-muted">{star.team} · {star.line}</span></li>
                ))}</ol>
              )}
            </section>
            <section className="fantasy-card p-5 text-sm">
              <h2 className="mb-3 text-lg">Game info</h2>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
                <dt className="text-muted">Season series</dt><dd>{game.away.abbrev} {detail.seasonSeries.away} – {detail.seasonSeries.home} {game.home.abbrev}</dd>
                {detail.coaches.away && <><dt className="text-muted">Coaches</dt><dd>{detail.coaches.away} / {detail.coaches.home}</dd></>}
                <dt className="text-muted">Scratches</dt><dd>{detail.scratches.away.length || detail.scratches.home.length
                  ? (['away', 'home'] as const).filter(side => detail.scratches[side].length).map(side => <span key={side} className="block"><span className="font-semibold">{game[side].abbrev}:</span> {detail.scratches[side].join(', ')}</span>)
                  : 'Not posted yet'}</dd>
              </dl>
            </section>
          </aside>
        </div>
      )}

      {tab === 'Box score' && (
        <div className="space-y-5">
          <p className="text-xs text-muted">FPTS uses {scoring.label}. PPP comes from the scoring summary.</p>
          {(['away', 'home'] as const).map(side => (
            <section key={side} className="fantasy-card overflow-hidden">
              <h2 className="flex items-center gap-2 border-b border-rule px-5 py-3 text-lg"><TeamLogo team={game[side]} size={24} />{game[side].name}</h2>
              <SkaterTable rows={detail.skaters.filter(r => r.team === game[side].abbrev)} scoringSettings={scoring.settings} mine={mine} />
              <GoalieTable rows={detail.goalies.filter(r => r.team === game[side].abbrev)} scoringSettings={scoring.settings} />
            </section>
          ))}
        </div>
      )}

      {tab === 'Team stats' && (
        <section className="fantasy-card max-w-2xl p-5">
          <div className="mb-2 flex justify-between text-sm font-semibold"><span className="flex items-center gap-2"><TeamLogo team={game.away} size={20} />{game.away.abbrev}</span><span className="flex items-center gap-2">{game.home.abbrev}<TeamLogo team={game.home} size={20} /></span></div>
          {detail.teamStats.filter(s => STAT_LABELS[s.category]).map(s => {
            const num = (v: string | number) => typeof v === 'number' ? v : Number(String(v).split('/')[0]) || 0;
            return <StatBar key={s.category} label={STAT_LABELS[s.category]} away={formatStat(s.category, s.away)} home={formatStat(s.category, s.home)} awayValue={num(s.away)} homeValue={num(s.home)} />;
          })}
          {detail.teamStats.length === 0 && <p className="text-sm text-muted">Team stats appear once the game starts.</p>}
        </section>
      )}

      {tab === 'Fantasy' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="fantasy-card overflow-hidden">
            <div className="border-b border-rule px-5 py-4"><h2 className="text-lg">Your players</h2><p className="mt-1 text-xs text-muted">Live fantasy points, {scoring.label}.</p></div>
            {myRows.length === 0 ? <p className="p-5 text-sm text-muted">None of your rostered players have appeared in this game.</p> : <FantasyList rows={myRows} />}
          </section>
          <section className="fantasy-card overflow-hidden">
            <div className="border-b border-rule px-5 py-4"><h2 className="text-lg">Top fantasy performers</h2><p className="mt-1 text-xs text-muted">Everyone in this game, {scoring.label}.</p></div>
            {fantasyRows.length === 0 ? <p className="p-5 text-sm text-muted">Available once the game starts.</p> : <FantasyList rows={fantasyRows.slice(0, 10)} />}
          </section>
        </div>
      )}
    </div>
  );
}

function FantasyList({ rows }: { rows: { id: number; name: string; team: string; pos: string; line: string; fpts: number }[] }) {
  return (
    <ol className="divide-y divide-rule">{rows.map((row, i) => (
      <li key={row.id} className="flex items-center gap-3 px-5 py-3">
        <span className="w-5 text-sm font-semibold text-muted">{i + 1}</span>
        <TeamLogo team={{ abbrev: row.team }} size={22} />
        <span className="min-w-0 flex-1"><span className="block truncate font-medium">{row.name}</span><span className="text-xs text-muted">{row.pos} · {row.line}</span></span>
        <span className="font-semibold tabular-nums">{row.fpts.toFixed(1)}</span>
      </li>
    ))}</ol>
  );
}
