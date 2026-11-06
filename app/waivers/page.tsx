'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, Check, Plus } from 'lucide-react';
import { usePlayerCard } from '@/components/player/PlayerCardProvider';
import { PlayerChip, ScoringNote, ToolHeader, primaryPosition, useToolData, type ToolPlayer } from '@/components/tools/toolkit';
import './waivers.css';
import { hasPosition } from '@/lib/positions';

const POSITIONS = ['All', 'C', 'LW', 'RW', 'D', 'G'] as const;
const SORTS = [
  ['fpts', 'Best overall'],
  ['G', 'Goals'],
  ['A', 'Assists'],
  ['SOG', 'Shots'],
  ['HIT', 'Hits'],
  ['BLK', 'Blocks'],
] as const;
type SortKey = (typeof SORTS)[number][0];
const PAGE = 20;

function strengths(row: ToolPlayer): string[] {
  const s = row.projection?.skaterStats;
  const g = row.projection?.goalieStats;
  const tags: string[] = [];
  const games = Math.round(row.projection?.gamesPlayed ?? 0);
  if (games >= 4) tags.push(`${games} games`);
  if (s) {
    if (s.G >= 1.5) tags.push('Goals');
    if (s.PPP >= 1.2) tags.push('Power play');
    if (s.SOG >= 10) tags.push('Shots');
    if (s.HIT >= 8) tags.push('Hits');
    if (s.BLK >= 5) tags.push('Blocks');
  }
  if (g && g.W >= 1.5) tags.push('Wins');
  return tags;
}

export default function WaiverWire() {
  const { byId, myTeam, addToMyTeam, scoring } = useToolData();
  const { openPlayer } = usePlayerCard();
  const [position, setPosition] = useState<(typeof POSITIONS)[number]>('All');
  const [sort, setSort] = useState<SortKey>('fpts');
  const [shown, setShown] = useState(PAGE);

  const mineIds = useMemo(() => new Set(myTeam.map((p) => p.id)), [myTeam]);
  const myRows = useMemo(() => myTeam.map((p) => byId.get(p.id)).filter((r): r is ToolPlayer => Boolean(r)), [myTeam, byId]);

  const targets = useMemo(() => {
    const value = (r: ToolPlayer) => (sort === 'fpts' ? r.fpts ?? -1 : (r.projection?.skaterStats?.[sort] as number | undefined) ?? -1);
    return [...byId.values()]
      .filter((r) => !mineIds.has(r.player.id) && r.fpts !== null)
      .filter((r) => position === 'All' || hasPosition(r.player, position))
      .sort((a, b) => value(b) - value(a));
  }, [byId, mineIds, position, sort]);

  /** My weakest player at the same position, if the free agent projects better. */
  const dropFor = (row: ToolPlayer): ToolPlayer | null => {
    const pos = primaryPosition(row.player);
    const same = myRows.filter((r) => primaryPosition(r.player) === pos).sort((a, b) => (a.fpts ?? 0) - (b.fpts ?? 0));
    const weakest = same[0];
    return weakest && (row.fpts ?? 0) > (weakest.fpts ?? 0) ? weakest : null;
  };

  return (
    <div className="bb-page">
      <ToolHeader accent="waivers" eyebrow="Waiver wire" title="Win the wire" blurb="The best players not on your roster this week, ranked by projected points, with the player on your team they would replace." />

      <div className="tk-card mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="tk-pills" role="group" aria-label="Position">
          {POSITIONS.map((pos) => <button key={pos} type="button" aria-pressed={position === pos} onClick={() => { setPosition(pos); setShown(PAGE); }}>{pos}</button>)}
        </div>
        <div className="tk-pills" role="group" aria-label="Sort by">
          {SORTS.map(([key, label]) => <button key={key} type="button" aria-pressed={sort === key} onClick={() => { setSort(key); setShown(PAGE); }}>{label}</button>)}
        </div>
      </div>

      <ol className="wv-list">
        {targets.slice(0, shown).map((row, i) => {
          const drop = dropFor(row);
          const tags = strengths(row);
          const added = mineIds.has(row.player.id);
          return (
            <li key={row.player.id} className="wv-item">
              <span className={`wv-rank${i < 3 ? ' is-top' : ''}`}>{i + 1}</span>
              <div className="wv-main">
                <PlayerChip row={row} onOpen={() => openPlayer(row.player.id)} />
                {tags.length > 0 && <div className="wv-tags">{tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
              </div>
              <div className="wv-side">
                {drop ? (
                  <p className="wv-drop">
                    <span>Replaces</span> <strong>{drop.player.name}</strong>
                    <em>+{((row.fpts ?? 0) - (drop.fpts ?? 0)).toFixed(1)} pts</em>
                  </p>
                ) : myRows.length > 0 ? <p className="wv-drop"><span>Depth add</span></p> : null}
                <button type="button" className="wv-add" onClick={() => addToMyTeam(row.player)} disabled={added}>
                  {added ? <><Check size={15} aria-hidden="true" /> Added</> : <><Plus size={15} aria-hidden="true" /> Add</>}
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      {targets.length === 0 && <div className="tk-empty">No projected players match. Try another position.</div>}
      {targets.length > shown && (
        <button type="button" className="bb-button-secondary mt-4 inline-flex items-center gap-2" onClick={() => setShown((n) => n + PAGE)}>
          Show {Math.min(PAGE, targets.length - shown)} more <ArrowRight size={15} aria-hidden="true" />
        </button>
      )}

      <ScoringNote label={scoring.label} />
      {myRows.length === 0 && <p className="tk-note">Add players on My team and we&apos;ll show who each pickup would replace.</p>}
    </div>
  );
}
