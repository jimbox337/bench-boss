'use client';

import { useState } from 'react';
import { myTeam } from '@/lib/mockdata';
import { calculateFantasyPoints, defaultLeagueSettings, optimizeLineup } from '@/lib/calculator';
import { useData } from '@/lib/DataContext';

export default function LineupOptimizer() {
  const { projections } = useData();
  const [timeframe, setTimeframe] = useState('next_7');
  const [optimized, setOptimized] = useState(false);

  const handleOptimize = () => {
    setOptimized(true);
  };

  const lineup = optimizeLineup(myTeam, projections, defaultLeagueSettings);

  return (
    <div className="p-8">
      <h2 className="text-3xl font-bold text-slate-100 mb-6">Lineup Optimizer</h2>

      {/* Controls */}
      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Date Range</label>
            <select 
              className="w-full border border-slate-600 rounded-lg px-4 py-2"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
            >
              <option value="today">Today</option>
              <option value="next_7">This Week (Next 7 Days)</option>
              <option value="next_14">Next 14 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Team</label>
            <select className="w-full border border-slate-600 rounded-lg px-4 py-2">
              <option>My Team</option>
            </select>
          </div>
          <div className="flex items-end">
            <button 
              onClick={handleOptimize}
              className="w-full bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Optimize Lineup
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {optimized && (
        <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-700">
            <h3 className="text-xl font-bold">Recommended Lineup</h3>
            <p className="text-sm text-slate-400 mt-1">
              Projected: <strong>{lineup.totalProjectedPoints?.toFixed(1)} pts</strong> this week
            </p>
          </div>

          {/* Active Roster */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700 border-b border-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Slot</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Player</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Team</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Games</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Proj. Pts</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">G</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">A</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">SOG</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {lineup.activeRoster.map((slot, idx) => {
                  const proj = slot.projection;
                  const points = proj ? calculateFantasyPoints(proj, defaultLeagueSettings) : 0;
                  
                  return (
                    <tr key={idx} className="hover:bg-slate-700">
                      <td className="px-6 py-4 text-sm font-medium text-slate-100">{slot.slotType}</td>
                      <td className="px-6 py-4 text-sm text-slate-100">{slot.player?.name}</td>
                      <td className="px-6 py-4 text-sm text-slate-400">{slot.player?.nhlTeam}</td>
                      <td className="px-6 py-4 text-sm text-slate-400">{proj?.gamesPlayed || 0}</td>
                      <td className="px-6 py-4 text-sm font-bold text-blue-600">{points.toFixed(1)}</td>
                      <td className="px-6 py-4 text-sm text-slate-400">{proj?.skaterStats?.G.toFixed(1) || '-'}</td>
                      <td className="px-6 py-4 text-sm text-slate-400">{proj?.skaterStats?.A.toFixed(1) || '-'}</td>
                      <td className="px-6 py-4 text-sm text-slate-400">{proj?.skaterStats?.SOG.toFixed(1) || '-'}</td>
                    </tr>
                  );
                })}

                {/* Bench Section */}
                {lineup.bench.length > 0 && (
                  <>
                    <tr className="bg-slate-700 border-t-2 border-slate-600">
                      <td colSpan={8} className="px-6 py-2 text-xs font-bold text-slate-400 uppercase">
                        Bench
                      </td>
                    </tr>
                    {lineup.bench.map((slot, idx) => {
                      const proj = slot.projection;
                      const points = proj ? calculateFantasyPoints(proj, defaultLeagueSettings) : 0;
                      
                      return (
                        <tr key={`bench-${idx}`} className="bg-slate-700 opacity-75">
                          <td className="px-6 py-4 text-sm font-medium text-slate-400">BN</td>
                          <td className="px-6 py-4 text-sm text-slate-400">{slot.player?.name}</td>
                          <td className="px-6 py-4 text-sm text-slate-400">{slot.player?.nhlTeam}</td>
                          <td className="px-6 py-4 text-sm text-slate-400">{proj?.gamesPlayed || 0}</td>
                          <td className="px-6 py-4 text-sm text-slate-400">{points.toFixed(1)}</td>
                          <td className="px-6 py-4 text-sm text-slate-400">{proj?.skaterStats?.G.toFixed(1) || '-'}</td>
                          <td className="px-6 py-4 text-sm text-slate-400">{proj?.skaterStats?.A.toFixed(1) || '-'}</td>
                          <td className="px-6 py-4 text-sm text-slate-400">{proj?.skaterStats?.SOG.toFixed(1) || '-'}</td>
                        </tr>
                      );
                    })}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!optimized && (
        <div className="bg-gray-100 rounded-xl p-12 text-center">
          <p className="text-slate-400 text-lg">Click "Optimize Lineup" to see your best roster</p>
        </div>
      )}
    </div>
  );
}