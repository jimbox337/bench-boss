'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useData } from '@/lib/DataContext';
import { calculateFantasyPoints, calculateFantasyRange, type Player, type Projection } from '@/lib/calculator';
import { pointsScoring } from '@/components/gamecenter/shared';
import './tools.css';
import { hasPosition } from '@/lib/positions';

export const POSITION_ORDER = ['C', 'LW', 'RW', 'D', 'G'] as const;

export function primaryPosition(player: Pick<Player, 'positions' | 'isGoalie'>): string {
  if (player.isGoalie) return 'G';
  return POSITION_ORDER.find((pos) => hasPosition(player, pos)) ?? player.positions?.[0] ?? 'F';
}

export type ToolPlayer = {
  player: Player;
  projection: Projection | null;
  /** Projected fantasy points, next 7 days. */
  fpts: number | null;
  range: { low: number; high: number } | null;
  /** Rank at the player's main position by projected points, e.g. 4 for "C4". */
  posRank: number | null;
};

/** Projections, fantasy points and position ranks for every player, in one place for all tools. */
export function useToolData() {
  const data = useData();
  const scoring = useMemo(() => pointsScoring(data.leagueSettings), [data.leagueSettings]);

  const byId = useMemo(() => {
    const projections = new Map(data.projections.filter((p) => p.timeframe === 'next_7').map((p) => [p.playerId, p]));
    const rows = new Map<string, ToolPlayer>();
    for (const player of data.players) {
      const projection = projections.get(player.id) ?? null;
      let fpts: number | null = null;
      let range: ToolPlayer['range'] = null;
      if (projection) {
        try {
          fpts = calculateFantasyPoints(projection, scoring.settings);
          const r = calculateFantasyRange(projection, scoring.settings);
          if (r) range = { low: r.low, high: r.high };
        } catch { /* category leagues: no points */ }
      }
      rows.set(player.id, { player, projection, fpts, range, posRank: null });
    }
    const byPos = new Map<string, ToolPlayer[]>();
    for (const row of rows.values()) {
      if (row.fpts === null) continue;
      const pos = primaryPosition(row.player);
      byPos.set(pos, [...(byPos.get(pos) ?? []), row]);
    }
    for (const list of byPos.values()) {
      list.sort((a, b) => (b.fpts ?? 0) - (a.fpts ?? 0)).forEach((row, i) => { row.posRank = i + 1; });
    }
    return rows;
  }, [data.players, data.projections, scoring.settings]);

  return { ...data, scoring, byId };
}

export function PosBadge({ position, rank }: { position: string; rank?: number | null }) {
  return <span className={`tk-pos tk-pos-${position}`}>{position}{rank ? <span className="tk-pos-rank">{rank}</span> : null}</span>;
}

export function Headshot({ player, size = 44 }: { player: Player; size?: number }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="tk-headshot" style={{ width: size, height: size }}>
      {player.headshotUrl && !broken
        // eslint-disable-next-line @next/next/no-img-element -- remote NHL headshots
        ? <img src={player.headshotUrl} alt="" onError={() => setBroken(true)} />
        : <span>{player.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>}
    </span>
  );
}

const INJURY_SHORT: Record<string, string> = { 'Day-to-Day': 'DTD', Questionable: 'Q', IR: 'IR', Out: 'O' };

/** A player as a rounded chip: headshot, name, position badge with rank, and a projected-points pill. */
export function PlayerChip({ row, onRemove, onOpen, tone }: {
  row: ToolPlayer;
  onRemove?: () => void;
  onOpen?: () => void;
  tone?: 'win' | 'loss';
}) {
  const { player, fpts, posRank } = row;
  const injury = player.injuryStatus && player.injuryStatus !== 'Healthy' ? INJURY_SHORT[player.injuryStatus] ?? player.injuryStatus : null;
  return (
    <div className={`tk-chip${tone ? ` tk-chip-${tone}` : ''}`}>
      <Headshot player={player} />
      <div className="tk-chip-body">
        <button type="button" className="tk-chip-name" onClick={onOpen} disabled={!onOpen}>{player.name}</button>
        <div className="tk-chip-meta">
          <PosBadge position={primaryPosition(player)} rank={posRank} />
          <span className="tk-value" title="Projected fantasy points, next 7 days">{fpts === null ? '–' : fpts.toFixed(1)}</span>
          <span className="tk-team">{player.nhlTeam}</span>
          {injury && <span className="tk-injury" title={player.injuryStatus}>{injury}</span>}
        </div>
      </div>
      {onRemove && (
        <button type="button" className="tk-chip-remove" onClick={onRemove} aria-label={`Remove ${player.name}`}><X size={18} aria-hidden="true" /></button>
      )}
    </div>
  );
}

/** Type-ahead player search. Shows the best projected matches first; Enter picks the highlighted one. */
export function PlayerSearch({ rows, exclude = [], onPick, placeholder = 'Add a player', autoFocus }: {
  rows: ToolPlayer[];
  exclude?: string[];
  onPick: (row: ToolPlayer) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const skip = new Set(exclude);
    return rows
      .filter((r) => !skip.has(r.player.id) && (r.player.name.toLowerCase().includes(q) || r.player.nhlTeam.toLowerCase() === q))
      .sort((a, b) => Number(b.player.name.toLowerCase().startsWith(q)) - Number(a.player.name.toLowerCase().startsWith(q)) || (b.fpts ?? -1) - (a.fpts ?? -1))
      .slice(0, 8);
  }, [query, rows, exclude]);

  const pick = (row: ToolPlayer) => {
    onPick(row);
    setQuery('');
    setActive(0);
    input.current?.focus();
  };

  return (
    <div className="tk-search">
      <Search size={16} className="tk-search-icon" aria-hidden="true" />
      <input
        ref={input}
        type="text"
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={matches[active] ? `${listId}-${active}` : undefined}
        placeholder={placeholder}
        value={query}
        autoFocus={autoFocus}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, matches.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
          if (e.key === 'Enter' && matches[active]) { e.preventDefault(); pick(matches[active]); }
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && matches.length > 0 && (
        <ul id={listId} role="listbox" className="tk-search-list">
          {matches.map((row, i) => (
            <li
              key={row.player.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'is-active' : undefined}
              onMouseDown={(e) => { e.preventDefault(); pick(row); }}
              onMouseEnter={() => setActive(i)}
            >
              <Headshot player={row.player} size={30} />
              <span className="tk-search-name">{row.player.name}</span>
              <PosBadge position={primaryPosition(row.player)} rank={row.posRank} />
              <span className="tk-team">{row.player.nhlTeam}</span>
              <span className="tk-value">{row.fpts === null ? '–' : row.fpts.toFixed(1)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Two-sided bar: how much of the combined value sits on "my" side (0–1). */
export function BalanceBar({ share, label }: { share: number; label: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, share)) * 100);
  const tone = pct >= 55 ? 'win' : pct <= 45 ? 'loss' : 'even';
  return (
    <div className={`tk-balance tk-balance-${tone}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}>
      <span style={{ width: `${pct}%` }} />
      <i aria-hidden="true" />
    </div>
  );
}

export function ToolHeader({ eyebrow, title, blurb, accent }: { eyebrow: string; title: string; blurb: string; accent: string }) {
  return (
    <header className={`tk-hero tk-hero-${accent}`}>
      <span className="tk-eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{blurb}</p>
    </header>
  );
}

export function ScoringNote({ label }: { label: string }) {
  return <p className="tk-note">Projected fantasy points for the next 7 days from the Bench Boss model, using {label}. Badges show the player&apos;s position rank.</p>;
}
