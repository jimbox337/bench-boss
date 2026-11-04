'use client';

import { useState } from 'react';
import { rankWaiverTargets, defaultLeagueSettings, Player } from '@/lib/calculator';
import { useData } from '@/lib/DataContext';
import PlayerDetailModal from '@/components/PlayerDetailModal';

export default function WaiverWire() {
  const { players, projections, myTeam, addToMyTeam } = useData();
  const [timeframe, setTimeframe] = useState('next_7');
  const [sortBy, setSortBy] = useState('best_overall');
  const [position, setPosition] = useState('all');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  // Free agents are all players not on my team
  const freeAgents = players.filter(p => !myTeam.some(tp => tp.id === p.id));
  const targets = rankWaiverTargets(freeAgents, projections, defaultLeagueSettings);

  return (
    <>
    <div className="bb-page">
      <header className="bb-page-header"><div><h1>Waiver Wire Targets</h1><p>Review available players and their projected contribution.</p></div></header>

      {/* Controls */}
      <div className="bb-toolbar mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-2">Timeframe</label>
            <select aria-label="Timeframe"
              className="bb-field w-full"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
            >
              <option value="next_7">Next 7 Days</option>
              <option value="next_14">Next 14 Days</option>
              <option value="rest_of_season">Rest of Season</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-2">Sort By</label>
            <select aria-label="Sort By"
              className="bb-field w-full"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="best_overall">Best Overall</option>
              <option value="fill_weaknesses">Fill My Weaknesses</option>
              <option value="goals">Goals</option>
              <option value="assists">Assists</option>
              <option value="sog">SOG</option>
              <option value="hits">Hits</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-2">Position</label>
            <select aria-label="Position"
              className="bb-field w-full"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            >
              <option value="all">All</option>
              <option value="C">C</option>
              <option value="LW">LW</option>
              <option value="RW">RW</option>
              <option value="D">D</option>
              <option value="G">G</option>
            </select>
          </div>
        </div>
      </div>

      {/* Top Targets */}
      <div className="divide-y divide-rule border-y border-rule">
        {targets.map((target, idx) => {
          const isTopPick = idx === 0;
          const proj = target.projection;

          return (
            <div
              key={target.player.id}
              className="bg-paper-2 transition-colors cursor-pointer hover:bg-paper-3"
              tabIndex={0}
              aria-label={`View ${target.player.name}`}
              onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setSelectedPlayer(target.player); } }}
              onClick={() => setSelectedPlayer(target.player)}
            >
              <div className="p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-4">
                  <div className="flex items-center gap-4 flex-1">
                    {/* Player Headshot */}
                    {target.player.headshotUrl && (
                      <img
                        src={target.player.headshotUrl}
                        alt={target.player.name}
                        className="h-16 w-16 bg-paper-3 object-cover flex-shrink-0"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}

                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <h3 className="text-xl font-medium">{target.player.name}</h3>
                        {isTopPick && (
                          <span className="px-2 py-1 bg-paper-3 text-accent-2 text-xs font-medium">
                            Top pick
                          </span>
                        )}
                        {proj.gamesPlayed >= 4 && (
                          <span className="px-2 py-1 bg-paper-3 text-accent-2 text-xs font-medium">
                            {proj.gamesPlayed} games
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted">
                        {target.player.nhlTeam} / {target.player.positions?.join('/') ?? ''} / {target.reasoning}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-3xl font-medium ${isTopPick ? 'text-accent-2' : 'text-accent-2'}`}>
                      {target.value.toFixed(1)}
                    </p>
                    <p className="text-xs text-muted">Proj. Pts</p>
                  </div>
                </div>

                {proj.skaterStats && (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-4 text-sm mb-4 border-t border-rule pt-4">
                    <div><span className="text-muted">G:</span> <strong>{proj.skaterStats.G.toFixed(1)}</strong></div>
                    <div><span className="text-muted">A:</span> <strong>{proj.skaterStats.A.toFixed(1)}</strong></div>
                    <div><span className="text-muted">SOG:</span> <strong>{proj.skaterStats.SOG.toFixed(1)}</strong></div>
                    <div><span className="text-muted">HIT:</span> <strong>{proj.skaterStats.HIT.toFixed(1)}</strong></div>
                    <div><span className="text-muted">PPP:</span> <strong>{proj.skaterStats.PPP.toFixed(1)}</strong></div>
                  </div>
                )}

                {proj.goalieStats && (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-4 text-sm mb-4 border-t border-rule pt-4">
                    <div><span className="text-muted">W:</span> <strong>{proj.goalieStats.W.toFixed(1)}</strong></div>
                    <div><span className="text-muted">SV:</span> <strong>{proj.goalieStats.SV.toFixed(1)}</strong></div>
                    <div><span className="text-muted">GAA:</span> <strong>{proj.goalieStats.GAA.toFixed(2)}</strong></div>
                    <div><span className="text-muted">SV%:</span> <strong>{proj.goalieStats.SV_PCT.toFixed(3)}</strong></div>
                    <div><span className="text-muted">SO:</span> <strong>{proj.goalieStats.SO.toFixed(1)}</strong></div>
                  </div>
                )}

                <button className="bb-button-secondary" onClick={(event) => { event.stopPropagation(); addToMyTeam(target.player); }}>
                  Add to Team
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Player Detail Modal */}
      {selectedPlayer && (
        <PlayerDetailModal
          player={selectedPlayer}
          isOpen={!!selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
    </>
  );
}
