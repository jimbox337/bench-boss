'use client';

import { useState } from 'react';
import { rankWaiverTargets, defaultLeagueSettings, calculateFantasyPoints, Player } from '@/lib/calculator';
import { useData } from '@/lib/DataContext';
import PlayerDetailModal from '@/components/PlayerDetailModal';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function WaiverWire() {
  const { players, projections, myTeam } = useData();
  const [timeframe, setTimeframe] = useState('next_7');
  const [sortBy, setSortBy] = useState('best_overall');
  const [position, setPosition] = useState('all');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  // Free agents are all players not on my team
  const freeAgents = players.filter(p => !myTeam.some(tp => tp.id === p.id));
  const targets = rankWaiverTargets(freeAgents, projections, defaultLeagueSettings);

  return (
    <ProtectedRoute requiresTeam={true}>
    <div className="p-8">
      <h2 className="text-3xl font-bold text-slate-100 mb-6">Waiver Wire Targets</h2>

      {/* Controls */}
      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Timeframe</label>
            <select 
              className="w-full border border-slate-600 rounded-lg px-4 py-2"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
            >
              <option value="next_7">Next 7 Days</option>
              <option value="next_14">Next 14 Days</option>
              <option value="rest_of_season">Rest of Season</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Sort By</label>
            <select 
              className="w-full border border-slate-600 rounded-lg px-4 py-2"
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
            <label className="block text-sm font-medium text-slate-300 mb-2">Position</label>
            <select 
              className="w-full border border-slate-600 rounded-lg px-4 py-2"
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
      <div className="grid grid-cols-1 gap-4">
        {targets.map((target, idx) => {
          const isTopPick = idx === 0;
          const proj = target.projection;
          
          return (
            <div
              key={target.player.id}
              className={`bg-slate-800 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
                isTopPick ? 'border-2 border-blue-500' : 'border border-slate-700'
              }`}
              onClick={() => setSelectedPlayer(target.player)}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4 flex-1">
                    {/* Player Headshot */}
                    {target.player.headshotUrl && (
                      <img
                        src={target.player.headshotUrl}
                        alt={target.player.name}
                        className="h-16 w-16 rounded-full bg-slate-700 object-cover flex-shrink-0"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}

                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-xl font-bold">{target.player.name}</h3>
                        {isTopPick && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                            🔥 TOP PICK
                          </span>
                        )}
                        {proj.gamesPlayed >= 4 && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded">
                            📅 {proj.gamesPlayed} GAMES
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-400">
                        {target.player.nhlTeam} • {target.player.positions.join('/')} • {target.reasoning}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-3xl font-bold ${isTopPick ? 'text-blue-600' : 'text-purple-600'}`}>
                      {target.value.toFixed(1)}
                    </p>
                    <p className="text-xs text-slate-400">Proj. Pts</p>
                  </div>
                </div>

                {proj.skaterStats && (
                  <div className="flex justify-between text-sm mb-4">
                    <div><span className="text-slate-400">G:</span> <strong>{proj.skaterStats.G.toFixed(1)}</strong></div>
                    <div><span className="text-slate-400">A:</span> <strong>{proj.skaterStats.A.toFixed(1)}</strong></div>
                    <div><span className="text-slate-400">SOG:</span> <strong>{proj.skaterStats.SOG.toFixed(1)}</strong></div>
                    <div><span className="text-slate-400">HIT:</span> <strong>{proj.skaterStats.HIT.toFixed(1)}</strong></div>
                    <div><span className="text-slate-400">PPP:</span> <strong>{proj.skaterStats.PPP.toFixed(1)}</strong></div>
                  </div>
                )}

                {proj.goalieStats && (
                  <div className="flex justify-between text-sm mb-4">
                    <div><span className="text-slate-400">W:</span> <strong>{proj.goalieStats.W.toFixed(1)}</strong></div>
                    <div><span className="text-slate-400">SV:</span> <strong>{proj.goalieStats.SV.toFixed(1)}</strong></div>
                    <div><span className="text-slate-400">GAA:</span> <strong>{proj.goalieStats.GAA.toFixed(2)}</strong></div>
                    <div><span className="text-slate-400">SV%:</span> <strong>{proj.goalieStats.SV_PCT.toFixed(3)}</strong></div>
                    <div><span className="text-slate-400">SO:</span> <strong>{proj.goalieStats.SO.toFixed(1)}</strong></div>
                  </div>
                )}

                <button className={`w-full py-2 rounded-lg font-medium transition-colors ${
                  isTopPick 
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-700 text-white hover:bg-gray-800'
                }`}>
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
    </ProtectedRoute>
  );
}