'use client';

import { useState } from 'react';
import type { PlayEvent } from '@/lib/nhlGameCenter';
import { teamColor } from '@/lib/teamColors';
import { TeamLogo } from './shared';

type ShotType = 'goal' | 'shot' | 'miss';
const TYPES: { key: ShotType; label: string }[] = [
  { key: 'goal', label: 'Goals' },
  { key: 'shot', label: 'Shots saved' },
  { key: 'miss', label: 'Missed' },
];

/** NHL rink in feet (x -100..100, y -42.5..42.5) with shots at their recorded coordinates. */
function Rink({ children }: { children: React.ReactNode }) {
  const red = '#E5485F';
  const blue = '#5B8CFF';
  return (
    <svg viewBox="-101 -43.5 202 87" className="h-auto w-full" role="img" aria-label="Shot locations on the rink">
      <rect x="-100" y="-42.5" width="200" height="85" rx="28" fill="oklch(24% 0.022 252)" stroke="oklch(46% 0.02 255)" strokeWidth="0.8" />
      <line x1="0" y1="-42.5" x2="0" y2="42.5" stroke={red} strokeWidth="1" strokeDasharray="2 1.2" />
      {[-25, 25].map(x => <line key={x} x1={x} y1="-42.5" x2={x} y2="42.5" stroke={blue} strokeWidth="1" />)}
      {[-89, 89].map(x => <line key={x} x1={x} y1="-39.5" x2={x} y2="39.5" stroke={red} strokeWidth="0.4" />)}
      {[-89, 89].map(x => <path key={`c${x}`} d={x < 0 ? 'M -89 -4 A 6 6 0 0 1 -89 4' : 'M 89 -4 A 6 6 0 0 0 89 4'} fill="oklch(36% 0.07 250)" stroke={red} strokeWidth="0.4" />)}
      <circle cx="0" cy="0" r="15" fill="none" stroke={blue} strokeWidth="0.5" />
      <circle cx="0" cy="0" r="0.8" fill={blue} />
      {[-69, 69].flatMap(x => [-22, 22].map(y => (
        <g key={`${x}${y}`}><circle cx={x} cy={y} r="15" fill="none" stroke={red} strokeWidth="0.5" /><circle cx={x} cy={y} r="1" fill={red} /></g>
      )))}
      {[-20, 20].flatMap(x => [-22, 22].map(y => <circle key={`n${x}${y}`} cx={x} cy={y} r="0.8" fill={red} />))}
      {children}
    </svg>
  );
}

export default function ShotChart({ plays, away, home }: { plays: PlayEvent[]; away: string; home: string }) {
  const [teams, setTeams] = useState<Record<string, boolean>>({ [away]: true, [home]: true });
  const [types, setTypes] = useState<Record<ShotType, boolean>>({ goal: true, shot: true, miss: false });
  const shots = plays.filter(p => (p.kind === 'goal' || p.kind === 'shot' || p.kind === 'miss') && p.x !== undefined && p.y !== undefined && p.team);
  const visible = shots.filter(p => teams[p.team!] && types[p.kind as ShotType]);
  const count = (team: string, kind: ShotType) => shots.filter(p => p.team === team && p.kind === kind).length;

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_200px]">
      <Rink>
        {visible.map(p => {
          const color = teamColor(p.team);
          // NHL y increases toward the top of the broadcast view; SVG y increases downward.
          const cx = p.x!, cy = -p.y!;
          if (p.kind === 'goal') return <circle key={p.id} cx={cx} cy={cy} r="2.6" fill={color} stroke="#fff" strokeWidth="0.7"><title>{p.text}</title></circle>;
          if (p.kind === 'shot') return <circle key={p.id} cx={cx} cy={cy} r="2" fill="#fff" stroke={color} strokeWidth="0.9"><title>{p.text}</title></circle>;
          return <circle key={p.id} cx={cx} cy={cy} r="1.3" fill={color} opacity="0.35"><title>{p.text}</title></circle>;
        })}
      </Rink>
      <div className="space-y-4 text-sm">
        {[away, home].map(team => (
          <div key={team}>
            <button type="button" onClick={() => setTeams(t => ({ ...t, [team]: !t[team] }))} aria-pressed={teams[team]}
              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 font-semibold ${teams[team] ? 'border-field-border' : 'border-rule opacity-50'}`}>
              <TeamLogo team={{ abbrev: team }} size={22} />{team}
              <span className="ml-auto text-xs font-normal text-muted tabular-nums">{count(team, 'goal')} G · {count(team, 'shot') + count(team, 'goal')} SOG</span>
            </button>
          </div>
        ))}
        <div className="space-y-1.5">
          {TYPES.map(type => (
            <label key={type.key} className="flex cursor-pointer items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden>
                  {type.key === 'goal' ? <circle r="5.5" fill="currentColor" stroke="var(--color-paper-2)" strokeWidth="1" /> : type.key === 'shot' ? <circle r="5" fill="var(--color-paper-2)" stroke="currentColor" strokeWidth="1.6" /> : <circle r="3.5" fill="currentColor" opacity="0.4" />}
                </svg>
                {type.label}
              </span>
              <input type="checkbox" className="bb-switch" checked={types[type.key]} onChange={() => setTypes(t => ({ ...t, [type.key]: !t[type.key] }))} />
            </label>
          ))}
        </div>
        <p className="text-xs text-muted">Locations from NHL play-by-play. Teams switch ends each period.</p>
      </div>
    </div>
  );
}
