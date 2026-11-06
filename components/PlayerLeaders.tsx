'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { BarChart3, ExternalLink } from 'lucide-react';
import { useData } from '@/lib/DataContext';
import { usePlayerCard } from '@/components/player/PlayerCardProvider';

export default function PlayerLeaders() {
  const { players, isLoading, isLiveData } = useData();
  const { openPlayer } = usePlayerCard();
  const leaders = useMemo(() => players
    .filter((player) => !player.isGoalie && player.seasonStats && Number.isFinite(player.seasonStats.PTS))
    .sort((a, b) => (b.seasonStats?.PTS ?? 0) - (a.seasonStats?.PTS ?? 0) || a.name.localeCompare(b.name))
    .slice(0, 8), [players]);

  return (
    <section className="bb-panel bb-dashboard-leaders overflow-hidden" aria-labelledby="player-leaders-title">
      <div className="bb-dashboard-panel-heading flex items-center justify-between gap-3 border-b border-rule px-5 py-4">
        <h2 id="player-leaders-title" className="text-lg">NHL points leaders</h2>
        <BarChart3 className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
      </div>
      <div className="flex justify-between gap-3 border-b border-rule bg-paper-3 px-5 py-2 text-xs text-muted">
        <span>{isLiveData ? 'NHL season stats' : 'Available season stats'}</span>
        <span>Points</span>
      </div>
      {isLoading && leaders.length === 0 ? (
        <div className="px-5 py-10 text-sm text-muted" role="status">Loading NHL player stats…</div>
      ) : leaders.length === 0 ? (
        <div className="px-5 py-8 text-sm text-muted">
          <p>Player stats are not available yet.</p>
          <a href="https://www.nhl.com/stats" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 font-medium text-accent">View NHL stats <ExternalLink size={14} aria-hidden="true" /></a>
        </div>
      ) : (
        <ol className="divide-y divide-rule">
          {leaders.map((player, index) => (
            <li key={player.id}>
              <button onClick={() => openPlayer(player.id)} className="flex w-full items-center gap-3 px-5 py-2 text-left hover:bg-paper-3" aria-label={`View ${player.name}, ${player.seasonStats?.PTS} points`}>
                <span className="w-4 shrink-0 text-xs tabular-nums text-muted">{index + 1}</span>
                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper-3 text-xs font-medium text-muted">
                  {/* Initials only when there is no photo (NHL headshots are transparent PNGs). */}
                  <span className={player.headshotUrl ? 'hidden' : undefined}>{player.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>
                  {player.headshotUrl && <img src={player.headshotUrl} alt="" className="absolute inset-0 h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; event.currentTarget.previousElementSibling?.classList.remove('hidden'); }} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm leading-5 font-semibold text-accent">{player.name}</span>
                  <span className="block text-xs leading-4 text-muted">{player.nhlTeam} / {player.positions?.join('/') || 'Skater'}</span>
                </span>
                <span className="text-base font-semibold tabular-nums text-ink">{player.seasonStats?.PTS}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      <div className="border-t border-rule px-5 py-2">
        <Link href="/players" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline">View player explorer</Link>
      </div>
    </section>
  );
}

