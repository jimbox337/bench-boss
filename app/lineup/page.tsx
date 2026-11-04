'use client';

import { useState } from 'react';
import { calculateFantasyPoints, defaultLeagueSettings, optimizeLineup } from '@/lib/calculator';
import { useData } from '@/lib/DataContext';

export default function LineupOptimizer() {
  const { projections, myTeam } = useData();
  const [timeframe, setTimeframe] = useState('next_7');
  const [optimized, setOptimized] = useState(false);

  const handleOptimize = () => {
    setOptimized(true);
  };

  const lineup = optimizeLineup(myTeam, projections, defaultLeagueSettings);

  return (
    <>
    <div className="bb-page">
      {!myTeam.length && <div className="bb-panel p-5 mb-5">Add players to your <a className="text-accent underline" href="/myteam">guest or personal roster</a> to optimize your lineup. No account needed.</div>}
      <header className="bb-page-header"><div><h1>Lineup Optimizer</h1><p>Review projected points and choose your active roster.</p></div></header>

      {/* Controls */}
      <div className="bb-toolbar mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-2">Date Range</label>
            <select aria-label="Date Range"
              className="bb-field w-full"
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
            <label className="block text-sm font-medium text-ink-2 mb-2">Team</label>
            <select aria-label="Team" className="bb-field w-full">
              <option>My Team</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              disabled={!myTeam.length}
              onClick={handleOptimize}
              className="w-full bb-button"
            >
              Optimize Lineup
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {optimized && (
        <div className="bb-panel overflow-hidden">
          <div className="p-6 border-b border-rule">
            <h3 className="text-xl font-medium text-ink">Recommended Lineup</h3>
            <p className="text-sm text-muted mt-1">
              Projected: <strong className="text-accent-2">{lineup.totalProjectedPoints?.toFixed(1)} pts</strong> this week
            </p>
          </div>

          {/* Active Roster */}
          <div className="overflow-x-auto">
            <p className="mb-3 text-xs text-muted md:hidden">Swipe across the table for all stats.</p>
            <table className="bb-table w-full">
              <thead className="bg-paper-3 border-b border-rule">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted">Slot</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted">Player</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted">Team</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted">Games</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted">Proj. Pts</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted">G</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted">A</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted">SOG</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {lineup.activeRoster.map((slot, idx) => {
                  const proj = slot.projection;
                  const points = proj ? calculateFantasyPoints(proj, defaultLeagueSettings) : 0;

                  return (
                    <tr key={idx} className="hover:bg-paper-3">
                      <td className="px-6 py-4 text-sm font-medium text-ink">{slot.slotType}</td>
                      <td className="px-6 py-4 text-sm text-ink">{slot.player?.name}</td>
                      <td className="px-6 py-4 text-sm text-muted">{slot.player?.nhlTeam}</td>
                      <td className="px-6 py-4 text-sm text-muted">{proj?.gamesPlayed || 0}</td>
                      <td className="px-6 py-4 text-sm font-medium text-accent-2">{points.toFixed(1)}</td>
                      <td className="px-6 py-4 text-sm text-muted">{proj?.skaterStats?.G.toFixed(1) || '-'}</td>
                      <td className="px-6 py-4 text-sm text-muted">{proj?.skaterStats?.A.toFixed(1) || '-'}</td>
                      <td className="px-6 py-4 text-sm text-muted">{proj?.skaterStats?.SOG.toFixed(1) || '-'}</td>
                    </tr>
                  );
                })}

                {/* Bench Section */}
                {lineup.bench.length > 0 && (
                  <>
                    <tr className="bg-paper-3 border-t-2 border-rule">
                      <td colSpan={8} className="px-6 py-2 text-xs font-medium text-muted">
                        Bench
                      </td>
                    </tr>
                    {lineup.bench.map((slot, idx) => {
                      const proj = slot.projection;
                      const points = proj ? calculateFantasyPoints(proj, defaultLeagueSettings) : 0;

                      return (
                        <tr key={`bench-${idx}`} className="bg-paper-3 opacity-75">
                          <td className="px-6 py-4 text-sm font-medium text-muted">BN</td>
                          <td className="px-6 py-4 text-sm text-muted">{slot.player?.name}</td>
                          <td className="px-6 py-4 text-sm text-muted">{slot.player?.nhlTeam}</td>
                          <td className="px-6 py-4 text-sm text-muted">{proj?.gamesPlayed || 0}</td>
                          <td className="px-6 py-4 text-sm text-muted">{points.toFixed(1)}</td>
                          <td className="px-6 py-4 text-sm text-muted">{proj?.skaterStats?.G.toFixed(1) || '-'}</td>
                          <td className="px-6 py-4 text-sm text-muted">{proj?.skaterStats?.A.toFixed(1) || '-'}</td>
                          <td className="px-6 py-4 text-sm text-muted">{proj?.skaterStats?.SOG.toFixed(1) || '-'}</td>
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
        <div className="bg-paper-2 p-12 text-center border border-rule">
          <p className="text-muted text-lg">Select “Optimize Lineup” to see your best roster</p>
        </div>
      )}
    </div>
    </>
  );
}
