'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { optimizeLineup, type RosterSlot } from '@/lib/calculator';
import { usePlayerCard } from '@/components/player/PlayerCardProvider';
import { PlayerChip, ScoringNote, ToolHeader, useToolData } from '@/components/tools/toolkit';
import './lineup.css';

export default function LineupOptimizer() {
  const { byId, myTeam, projections, scoring } = useToolData();
  const { openPlayer } = usePlayerCard();

  const lineup = useMemo(
    () => optimizeLineup(myTeam, projections.filter((p) => p.timeframe === 'next_7'), scoring.settings),
    [myTeam, projections, scoring.settings],
  );
  const benchPoints = lineup.bench.reduce((sum, slot) => sum + (slot.player ? byId.get(slot.player.id)?.fpts ?? 0 : 0), 0);

  const SlotRow = ({ slot, label }: { slot: RosterSlot; label: string }) => {
    const row = slot.player ? byId.get(slot.player.id) : null;
    return (
      <li className="lu-row">
        <span className={`lu-slot lu-slot-${label}`}>{label}</span>
        {row ? <PlayerChip row={row} onOpen={() => openPlayer(row.player.id)} /> : <span className="lu-empty">Empty slot</span>}
        <span className="lu-games">{Math.round(slot.projection?.gamesPlayed ?? 0)} GP</span>
      </li>
    );
  };

  return (
    <div className="bb-page">
      <ToolHeader accent="lineup" eyebrow="Lineup optimizer" title="Set your best lineup" blurb="We fill every active slot with the players projected to score the most this week, counting games played." />

      {!myTeam.length ? (
        <div className="tk-empty">
          Add players to your <Link href="/myteam" className="font-semibold text-accent underline">roster</Link> and your best lineup appears here. No account needed.
        </div>
      ) : (
        <>
          <section className="tk-card tk-verdict mb-5">
            <p className="tk-verdict-title is-win">{(lineup.totalProjectedPoints ?? 0).toFixed(1)} pts</p>
            <p className="tk-verdict-sub">Projected for your active lineup this week · {benchPoints.toFixed(1)} pts left on the bench</p>
          </section>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <section className="tk-card" aria-labelledby="active-title">
              <h2 id="active-title">Active</h2>
              <ol className="lu-list">
                {lineup.activeRoster.map((slot, i) => <SlotRow key={`a${i}`} slot={slot} label={slot.slotType} />)}
              </ol>
            </section>
            <section className="tk-card" aria-labelledby="bench-title">
              <h2 id="bench-title">Bench</h2>
              {lineup.bench.length ? (
                <ol className="lu-list">
                  {lineup.bench.map((slot, i) => <SlotRow key={`b${i}`} slot={slot} label="BN" />)}
                </ol>
              ) : <p className="mt-3 text-sm text-muted">Nobody on the bench.</p>}
            </section>
          </div>
        </>
      )}

      <ScoringNote label={scoring.label} />
    </div>
  );
}
