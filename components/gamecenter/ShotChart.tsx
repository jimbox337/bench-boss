'use client';

import { useMemo, useState } from 'react';
import { shotDistance, type PeriodKey, type PlayEvent, type ShotInfo, type ShotResult, type ShotStrength } from '@/lib/nhlGameCenter';
import { teamColor } from '@/lib/teamColors';
import { TeamLogo } from './shared';

type Attempt = ShotInfo & { id: number; period: PeriodKey; time: string };

const RESULTS: { key: ShotResult; label: string }[] = [
  { key: 'goal', label: 'Goals' },
  { key: 'shot', label: 'Saved' },
  { key: 'miss', label: 'Missed' },
  { key: 'block', label: 'Blocked' },
];
const STRENGTHS: { key: 'all' | ShotStrength; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'EV', label: 'Even' }, { key: 'PP', label: 'Power play' }, { key: 'SH', label: 'Short' },
];
const RESULT_TEXT: Record<ShotResult, string> = { goal: 'Goal', shot: 'Saved', miss: 'Missed', block: 'Blocked' };
const periodName = (p: PeriodKey) => ({ '1': '1st', '2': '2nd', '3': '3rd' } as Record<string, string>)[p] || p;

/** Inner slot: within 25 ft of the net and inside the dots (|y| ≤ 22). */
const isSlot = (s: Attempt, home: string) => shotDistance(s, s.team === home) <= 25 && Math.abs(s.y) <= 22;

/* Rink drawn to NHL dimensions in feet: 200 × 85, 28 ft corners, goal lines 11 ft from the boards. */
const LINE = { red: 'oklch(52% 0.09 22)', blue: 'oklch(52% 0.07 255)', board: 'var(--color-field-border)', ice: 'oklch(22% 0.012 258)', crease: 'oklch(30% 0.03 250)' };

function FaceoffCircle({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g stroke={LINE.red} strokeWidth="0.35" fill="none">
      <circle cx={cx} cy={cy} r="15" />
      {[-1, 1].flatMap(side => [-2.9, 2.9].map(dx => (
        <line key={`${side}${dx}`} x1={cx + dx} y1={cy + side * 14.8} x2={cx + dx} y2={cy + side * 17} />
      )))}
      {[-1, 1].flatMap(sx => [-1, 1].map(sy => (
        <path key={`l${sx}${sy}`} d={`M ${cx + sx * 2} ${cy + sy * 0.75} h ${sx * 4} M ${cx + sx * 2} ${cy + sy * 0.75} v ${sy * 3}`} />
      )))}
      <circle cx={cx} cy={cy} r="1" fill={LINE.red} stroke="none" />
    </g>
  );
}

function Rink({ away, home, children }: { away: string; home: string; children: React.ReactNode }) {
  return (
    <svg viewBox="-101 -43.5 202 87" className="block h-auto w-full" role="img" aria-label={`Shot locations: ${away} attacks the left net, ${home} the right`}>
      <defs><clipPath id="rink-clip"><rect x="-100" y="-42.5" width="200" height="85" rx="28" /></clipPath></defs>
      <rect x="-100" y="-42.5" width="200" height="85" rx="28" fill={LINE.ice} />
      <g clipPath="url(#rink-clip)">
        {/* Faint team tint so each end reads as one team's attacking zone */}
        <rect x="-100" y="-42.5" width="75" height="85" fill={teamColor(away)} opacity="0.06" />
        <rect x="25" y="-42.5" width="75" height="85" fill={teamColor(home)} opacity="0.06" />
        <rect x="-0.5" y="-42.5" width="1" height="85" fill={LINE.red} opacity="0.8" />
        {[-25, 25].map(x => <rect key={x} x={x - 0.5} y="-42.5" width="1" height="85" fill={LINE.blue} opacity="0.85" />)}
        {[-89, 89].map(x => <line key={x} x1={x} y1="-42.5" x2={x} y2="42.5" stroke={LINE.red} strokeWidth="0.25" />)}
        {[-1, 1].map(s => <path key={`t${s}`} d={`M ${s * 89} -11 L ${s * 100} -14 M ${s * 89} 11 L ${s * 100} 14`} stroke={LINE.red} strokeWidth="0.25" />)}
      </g>
      <circle cx="0" cy="0" r="15" fill="none" stroke={LINE.blue} strokeWidth="0.35" />
      <circle cx="0" cy="0" r="0.6" fill={LINE.blue} />
      {[-69, 69].flatMap(x => [-22, 22].map(y => <FaceoffCircle key={`${x}${y}`} cx={x} cy={y} />))}
      {[-20, 20].flatMap(x => [-22, 22].map(y => <circle key={`n${x}${y}`} cx={x} cy={y} r="1" fill={LINE.red} />))}
      {[-1, 1].map(s => (
        <g key={`g${s}`}>
          <path d={`M ${s * 89} -4 L ${s * 85.5} -4 A 4.5 4.5 0 0 ${s > 0 ? 0 : 1} ${s * 85.5} 4 L ${s * 89} 4 Z`} fill={LINE.crease} stroke={LINE.red} strokeWidth="0.25" />
          <rect x={s > 0 ? 89 : -92.3} y="-3" width="3.3" height="6" rx="1" fill="none" stroke="var(--color-ink-2)" strokeWidth="0.35" />
        </g>
      ))}
      <rect x="-100" y="-42.5" width="200" height="85" rx="28" fill="none" stroke={LINE.board} strokeWidth="0.7" />
      {children}
    </svg>
  );
}

function Marker({ shot, active, onEnter, onLeave }: { shot: Attempt; active: boolean; onEnter: () => void; onLeave: () => void }) {
  const color = teamColor(shot.team);
  const cx = shot.x, cy = -shot.y; // NHL y points up the broadcast view; SVG y points down.
  const k = active ? 1.3 : 1;
  const common = {
    onMouseEnter: onEnter, onMouseLeave: onLeave, onFocus: onEnter, onBlur: onLeave, tabIndex: 0, className: 'cursor-pointer outline-none',
    'aria-label': `${RESULT_TEXT[shot.result]}, ${shot.shooter}, ${periodName(shot.period)} ${shot.time}`,
  };
  if (shot.result === 'goal') return <g {...common}><circle cx={cx} cy={cy} r={2.5 * k} fill={color} stroke="var(--color-ink)" strokeWidth="0.6" /></g>;
  if (shot.result === 'shot') return <g {...common}><circle cx={cx} cy={cy} r={1.7 * k} fill={LINE.ice} stroke={color} strokeWidth="0.75" /></g>;
  if (shot.result === 'miss') {
    const d = 1.2 * k;
    return (
      <g {...common} stroke={color} strokeWidth="0.6" strokeLinecap="round">
        <circle cx={cx} cy={cy} r={d + 0.6} fill="transparent" stroke="none" />
        <path d={`M ${cx - d} ${cy - d} L ${cx + d} ${cy + d} M ${cx + d} ${cy - d} L ${cx - d} ${cy + d}`} />
      </g>
    );
  }
  const t = 1.5 * k;
  return <g {...common}><path d={`M ${cx} ${cy - t} L ${cx + t} ${cy + t * 0.8} L ${cx - t} ${cy + t * 0.8} Z`} fill={color} opacity="0.55" /></g>;
}

function Legend({ result }: { result: ShotResult }) {
  return (
    <svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden className="text-ink-2">
      {result === 'goal' && <circle r="5.5" fill="currentColor" />}
      {result === 'shot' && <circle r="4.6" fill="none" stroke="currentColor" strokeWidth="1.6" />}
      {result === 'miss' && <path d="M -4 -4 L 4 4 M 4 -4 L -4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}
      {result === 'block' && <path d="M 0 -5 L 5 4 L -5 4 Z" fill="currentColor" opacity="0.6" />}
    </svg>
  );
}

function Chips<T extends string>({ label, options, value, onChange }: { label: string; options: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      {options.map(o => (
        <button key={o.key} type="button" onClick={() => onChange(o.key)} aria-pressed={value === o.key}
          className={`h-8 rounded-full border px-3 text-xs font-semibold ${value === o.key ? 'border-accent bg-selection text-accent' : 'border-rule text-ink-2 hover:border-field-border'}`}>{o.label}</button>
      ))}
    </div>
  );
}

type TeamSummary = { goals: number; sog: number; attempts: number; slot: number; avg: number | null; shooters: { name: string; att: number; sog: number; g: number }[] };

function summarize(attempts: Attempt[], team: string, home: string): TeamSummary {
  const mine = attempts.filter(a => a.team === team);
  const onNet = mine.filter(a => a.result === 'goal' || a.result === 'shot');
  const unblocked = mine.filter(a => a.result !== 'block');
  const shooters = new Map<string, { name: string; att: number; sog: number; g: number }>();
  for (const a of mine) {
    const key = String(a.shooterId ?? a.shooter);
    const row = shooters.get(key) ?? { name: a.shooter, att: 0, sog: 0, g: 0 };
    row.att += 1;
    if (a.result === 'goal' || a.result === 'shot') row.sog += 1;
    if (a.result === 'goal') row.g += 1;
    shooters.set(key, row);
  }
  return {
    goals: mine.filter(a => a.result === 'goal').length, sog: onNet.length, attempts: mine.length,
    slot: onNet.filter(a => isSlot(a, home)).length,
    avg: unblocked.length ? unblocked.reduce((s, a) => s + shotDistance(a, team === home), 0) / unblocked.length : null,
    shooters: [...shooters.values()].sort((a, b) => b.g - a.g || b.sog - a.sog || b.att - a.att).slice(0, 3),
  };
}

export default function ShotChart({ plays, away, home }: { plays: PlayEvent[]; away: string; home: string }) {
  const [teams, setTeams] = useState<Record<string, boolean>>({ [away]: true, [home]: true });
  const [results, setResults] = useState<Record<ShotResult, boolean>>({ goal: true, shot: true, miss: true, block: false });
  const [period, setPeriod] = useState<'all' | PeriodKey>('all');
  const [strength, setStrength] = useState<'all' | ShotStrength>('all');
  const [hover, setHover] = useState<number | null>(null);

  const attempts = useMemo<Attempt[]>(() => plays.flatMap(p => (p.shot ? [{ ...p.shot, id: p.id, period: p.period, time: p.time }] : [])), [plays]);
  if (attempts.length === 0) return <p className="text-sm text-muted">No shot locations yet.</p>;

  const periods = [...new Set(attempts.map(a => a.period))];
  const scoped = attempts.filter(a => (period === 'all' || a.period === period) && (strength === 'all' || a.strength === strength));
  const visible = scoped.filter(a => teams[a.team] && results[a.result]);
  const active = visible.find(a => a.id === hover);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Chips label="Period" options={[{ key: 'all' as const, label: 'All periods' }, ...periods.map(p => ({ key: p, label: p === 'SO' ? 'Shootout' : periodName(p) }))]} value={period} onChange={setPeriod} />
        <Chips label="Strength" options={STRENGTHS} value={strength} onChange={setStrength} />
      </div>

      <div className="relative">
        <Rink away={away} home={home}>
          {visible.map(a => <Marker key={a.id} shot={a} active={a.id === hover} onEnter={() => setHover(a.id)} onLeave={() => setHover(h => (h === a.id ? null : h))} />)}
        </Rink>
        <span className="pointer-events-none absolute bottom-[3%] left-[16%] hidden sm:flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted"><TeamLogo team={{ abbrev: away }} size={16} />{away} attacks</span>
        <span className="pointer-events-none absolute bottom-[3%] right-[16%] hidden sm:flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{home} attacks<TeamLogo team={{ abbrev: home }} size={16} /></span>
        {active && (
          <div role="tooltip" className="pointer-events-none absolute z-10 w-60 -translate-x-1/2 rounded-lg border border-rule bg-paper-2 p-3 text-xs shadow-lg"
            style={{ left: `${Math.min(86, Math.max(14, ((active.x + 101) / 202) * 100))}%`, ...(active.y < 0 ? { bottom: `${((43.5 + active.y) / 87) * 100 + 5}%` } : { top: `${((43.5 - active.y) / 87) * 100 + 5}%` }) }}>
            <p className="flex items-center gap-2 font-semibold text-ink"><TeamLogo team={{ abbrev: active.team }} size={16} />{active.shooter}<span className="ml-auto font-normal text-muted tabular-nums">{periodName(active.period)} · {active.time}</span></p>
            <p className="mt-1.5 text-ink-2">
              <span className="font-semibold text-ink">{RESULT_TEXT[active.result]}</span>
              {active.shotType && ` · ${active.shotType}`}
              {active.strength !== 'EV' && ` · ${active.strength === 'EN' ? 'empty net' : active.strength}`}
            </p>
            <p className="mt-0.5 text-muted">
              {Math.round(shotDistance(active, active.team === home))} ft
              {active.result === 'shot' && active.goalie && ` · saved by ${active.goalie}`}
              {active.result === 'block' && active.blocker && ` · blocked by ${active.blocker}`}
              {active.reason && ` · ${active.reason}`}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        {RESULTS.map(r => (
          <label key={r.key} className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" className="bb-switch" checked={results[r.key]} onChange={() => setResults(s => ({ ...s, [r.key]: !s[r.key] }))} />
            <Legend result={r.key} />{r.label}
          </label>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[away, home].map(team => {
          const s = summarize(scoped, team, home);
          return (
            <div key={team} className={`rounded-xl border border-rule p-4 ${teams[team] ? '' : 'opacity-50'}`}>
              <button type="button" onClick={() => setTeams(t => ({ ...t, [team]: !t[team] }))} aria-pressed={teams[team]} className="flex w-full items-center gap-2 font-semibold">
                <span className="h-4 w-1 rounded-full" style={{ background: teamColor(team) }} aria-hidden />
                <TeamLogo team={{ abbrev: team }} size={22} />{team}
                <span className="ml-auto text-xs font-normal text-muted">{teams[team] ? 'Shown on rink' : 'Hidden'}</span>
              </button>
              <dl className="mt-3 grid grid-cols-5 gap-2 text-center">
                {([['G', s.goals], ['SOG', s.sog], ['Att', s.attempts], ['Slot SOG', s.slot], ['Avg ft', s.avg === null ? '–' : Math.round(s.avg)]] as const).map(([label, value]) => (
                  <div key={label}><dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</dt><dd className="font-display text-xl font-bold tabular-nums">{value}</dd></div>
                ))}
              </dl>
              {s.shooters.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-rule pt-3 text-sm">
                  {s.shooters.map(p => (
                    <li key={p.name} className="flex justify-between gap-2"><span className="truncate">{p.name}</span><span className="text-muted tabular-nums">{p.g ? `${p.g} G · ` : ''}{p.sog} SOG · {p.att} att</span></li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted">From NHL play-by-play, with {away} always attacking the left net and {home} the right. Att counts every attempt, including blocked and missed. Slot SOG = shots on goal within 25 ft, inside the faceoff dots. Hover a marker for details.</p>
    </div>
  );
}
