'use client';

import { useState, useEffect } from 'react';
import { Player, PlayerOutlook } from '@/lib/calculator';

interface GameLog {
  gameDate: string;
  opponentAbbrev: string;
  homeRoadFlag: string;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  powerPlayPoints: number;
  shots: number;
  hits: number;
  blockedShots: number;
  penaltyMinutes: number;
  toi: string | null;
  wins?: boolean;
  savePctg?: number;
  goalsAgainst?: number;
}

interface PlayerDetailModalProps {
  player: Player;
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'stats' | 'gamelog' | 'outlook';

export default function PlayerDetailModal({ player, isOpen, onClose }: PlayerDetailModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('stats');
  const [outlook, setOutlook] = useState<PlayerOutlook | null>(player.outlook || null);
  const [outlookLoading, setOutlookLoading] = useState(false);
  const [outlookError, setOutlookError] = useState<string | null>(null);
  const [gameLogs, setGameLogs] = useState<GameLog[]>([]);
  const [gameLogLoading, setGameLogLoading] = useState(false);
  const [injury, setInjury] = useState<{ status: string | null; description: string | null } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === 'outlook' && !outlook) fetchOutlook();
    if (activeTab === 'gamelog' && gameLogs.length === 0) fetchGameLog();
    if (activeTab === 'stats' && !injury) fetchGameLog(); // load injury status on stats tab too
  }, [isOpen, activeTab]);

  const fetchOutlook = async () => {
    setOutlookLoading(true);
    setOutlookError(null);
    try {
      const res = await fetch('/api/player-outlook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player }),
      });
      const data = await res.json();
      if (data.success) setOutlook(data.outlook);
      else setOutlookError(data.error || 'Failed to generate outlook');
    } catch {
      setOutlookError('Network error');
    } finally {
      setOutlookLoading(false);
    }
  };

  const fetchGameLog = async () => {
    setGameLogLoading(true);
    try {
      const res = await fetch(`/api/player-gamelog?playerId=${player.id}`);
      const data = await res.json();
      if (data.success) {
        setGameLogs(data.gameLogs);
        setInjury(data.injury);
      }
    } catch {
      // silently fail
    } finally {
      setGameLogLoading(false);
    }
  };

  if (!isOpen) return null;

  const getInjuryStatusColor = (status?: string | null) => {
    switch (status) {
      case 'Healthy': return 'bg-green-600 text-white';
      case 'Day-to-Day': return 'bg-yellow-600 text-white';
      case 'Questionable': return 'bg-orange-600 text-white';
      case 'IR':
      case 'Out': return 'bg-red-600 text-white';
      default: return 'bg-slate-600 text-white';
    }
  };

  const getValueColor = (value: string) => {
    switch (value) {
      case 'Must-Start': return 'bg-green-600';
      case 'Start': return 'bg-green-700';
      case 'Flex': return 'bg-yellow-600';
      case 'Bench': return 'bg-orange-600';
      case 'Drop': return 'bg-red-600';
      default: return 'bg-slate-600';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'Hot': return 'text-red-400';
      case 'Cold': return 'text-blue-400';
      default: return 'text-yellow-400';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low': return 'text-green-400';
      case 'Moderate': return 'text-yellow-400';
      case 'High': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  const injuryStatus = injury?.status ?? player.injuryStatus ?? null;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'stats', label: 'Stats' },
    { id: 'gamelog', label: 'Game Log' },
    { id: 'outlook', label: 'AI Outlook' },
  ];

  // Last 5 games point totals for sparkline-style display
  const last5 = gameLogs.slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 border-b border-slate-700 z-10 bg-slate-800">
          <div className="flex items-stretch">
            {player.headshotUrl && (
              <div className="w-64 h-64 flex-shrink-0 relative">
                <img
                  src={player.headshotUrl}
                  alt={player.name}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
            )}

            <div className="flex-1 p-8 flex flex-col justify-center">
              <div className="flex items-start justify-between">
                <div>
                  {(() => {
                    const nameParts = player.name.split(' ');
                    const firstName = nameParts.slice(0, -1).join(' ');
                    const lastName = nameParts[nameParts.length - 1];
                    return (
                      <>
                        <div className="text-2xl font-medium text-slate-300 mb-1">{firstName}</div>
                        <div className="text-5xl font-bold text-slate-100 mb-3">{lastName}</div>
                      </>
                    );
                  })()}
                  <div className="flex items-center gap-3 flex-wrap text-lg">
                    <span className="text-slate-300 font-semibold">{player.positions?.join('/') ?? ''}</span>
                    {player.nhlTeam !== 'UNK' && (
                      <>
                        <span className="text-slate-600">•</span>
                        <span className="text-slate-300 font-semibold">{player.nhlTeam}</span>
                      </>
                    )}
                    {injuryStatus && (
                      <>
                        <span className="text-slate-600">•</span>
                        <span className={`px-2 py-1 rounded text-sm font-medium ${getInjuryStatusColor(injuryStatus)}`}>
                          {injuryStatus}
                        </span>
                      </>
                    )}
                  </div>
                  {injury?.description && (
                    <p className="text-sm text-red-300 mt-2">{injury.description}</p>
                  )}

                  {/* Last 5 games quick view */}
                  {last5.length > 0 && (
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-xs text-slate-500">Last 5:</span>
                      {last5.map((g, i) => (
                        <div
                          key={i}
                          title={`${g.gameDate} vs ${g.opponentAbbrev}: ${g.goals}G ${g.assists}A`}
                          className={`w-7 h-7 rounded flex items-center justify-center text-xs font-bold ${
                            g.points >= 2 ? 'bg-blue-600 text-white' :
                            g.points === 1 ? 'bg-slate-600 text-slate-200' :
                            'bg-slate-700/50 text-slate-500'
                          }`}
                        >
                          {g.points}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">

          {/* STATS TAB */}
          {activeTab === 'stats' && (
            <>
              <div>
                <h3 className="text-xl font-bold text-slate-100 mb-4">2025-26 Stats</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'GP', value: player.gamesPlayed || 0, color: 'text-slate-100' },
                    { label: 'Points', value: player.seasonStats?.PTS || 0, color: 'text-blue-400' },
                    { label: 'Goals', value: player.seasonStats?.G || 0, color: 'text-slate-100' },
                    { label: 'Assists', value: player.seasonStats?.A || 0, color: 'text-slate-100' },
                    { label: 'PPP', value: player.seasonStats?.PPP || 0, color: 'text-slate-100' },
                    { label: 'SOG', value: player.seasonStats?.SOG || 0, color: 'text-slate-100' },
                    { label: 'Hits', value: player.seasonStats?.HIT || 0, color: 'text-slate-100' },
                    { label: 'Blocks', value: player.seasonStats?.BLK || 0, color: 'text-slate-100' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-slate-700/50 rounded-lg p-4">
                      <div className="text-xs text-slate-400 uppercase">{label}</div>
                      <div className={`text-2xl font-bold ${color}`}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Injury Section */}
              <div>
                <h3 className="text-xl font-bold text-slate-100 mb-4">Injury Status</h3>
                {gameLogLoading ? (
                  <div className="bg-slate-700/50 rounded-xl p-4 text-slate-400 text-sm">Loading injury info...</div>
                ) : (
                  <div className="bg-slate-700/50 rounded-xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 font-medium">Current Status</span>
                      <span className={`px-3 py-1 rounded-lg text-sm font-bold ${getInjuryStatusColor(injuryStatus)}`}>
                        {injuryStatus ?? 'Active'}
                      </span>
                    </div>
                    {injury?.description && (
                      <div className="border-t border-slate-600 pt-3">
                        <p className="text-sm text-slate-300 font-medium mb-1">Details</p>
                        <p className="text-sm text-red-300">{injury.description}</p>
                      </div>
                    )}
                    {!injury?.description && (
                      <p className="text-xs text-slate-500 border-t border-slate-600 pt-3">No active injury reported</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* GAME LOG TAB */}
          {activeTab === 'gamelog' && (
            <div>
              <h3 className="text-xl font-bold text-slate-100 mb-4">Recent Games</h3>
              {gameLogLoading ? (
                <div className="flex items-center justify-center py-12 text-slate-400">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mr-3"></div>
                  Loading game log...
                </div>
              ) : gameLogs.length === 0 ? (
                <div className="bg-slate-700/50 rounded-xl p-8 text-center text-slate-400">
                  No game log data available
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-2 px-3 text-xs text-slate-400 uppercase font-medium">Date</th>
                        <th className="text-left py-2 px-3 text-xs text-slate-400 uppercase font-medium">Opp</th>
                        {!player.isGoalie ? (
                          <>
                            <th className="text-right py-2 px-3 text-xs text-slate-400 uppercase font-medium">G</th>
                            <th className="text-right py-2 px-3 text-xs text-slate-400 uppercase font-medium">A</th>
                            <th className="text-right py-2 px-3 text-xs text-slate-400 uppercase font-medium">PTS</th>
                            <th className="text-right py-2 px-3 text-xs text-slate-400 uppercase font-medium">+/-</th>
                            <th className="text-right py-2 px-3 text-xs text-slate-400 uppercase font-medium">PPP</th>
                            <th className="text-right py-2 px-3 text-xs text-slate-400 uppercase font-medium">SOG</th>
                            <th className="text-right py-2 px-3 text-xs text-slate-400 uppercase font-medium">HIT</th>
                            <th className="text-right py-2 px-3 text-xs text-slate-400 uppercase font-medium">BLK</th>
                            <th className="text-right py-2 px-3 text-xs text-slate-400 uppercase font-medium">TOI</th>
                          </>
                        ) : (
                          <>
                            <th className="text-right py-2 px-3 text-xs text-slate-400 uppercase font-medium">Dec</th>
                            <th className="text-right py-2 px-3 text-xs text-slate-400 uppercase font-medium">GA</th>
                            <th className="text-right py-2 px-3 text-xs text-slate-400 uppercase font-medium">SV%</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {gameLogs.map((g, i) => (
                        <tr key={i} className={`hover:bg-slate-700/30 transition-colors ${g.points >= 2 ? 'bg-blue-900/10' : ''}`}>
                          <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                            {new Date(g.gameDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="text-slate-400 text-xs">{g.homeRoadFlag === 'H' ? 'vs' : '@'}</span>
                            {' '}<span className="text-slate-200 font-medium">{g.opponentAbbrev}</span>
                          </td>
                          {!player.isGoalie ? (
                            <>
                              <td className="py-2.5 px-3 text-right text-slate-300">{g.goals}</td>
                              <td className="py-2.5 px-3 text-right text-slate-300">{g.assists}</td>
                              <td className={`py-2.5 px-3 text-right font-bold ${g.points >= 2 ? 'text-blue-400' : g.points === 1 ? 'text-slate-200' : 'text-slate-500'}`}>
                                {g.points}
                              </td>
                              <td className={`py-2.5 px-3 text-right ${g.plusMinus > 0 ? 'text-green-400' : g.plusMinus < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                                {g.plusMinus > 0 ? `+${g.plusMinus}` : g.plusMinus}
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-300">{g.powerPlayPoints}</td>
                              <td className="py-2.5 px-3 text-right text-slate-300">{g.shots}</td>
                              <td className="py-2.5 px-3 text-right text-slate-300">{g.hits}</td>
                              <td className="py-2.5 px-3 text-right text-slate-300">{g.blockedShots}</td>
                              <td className="py-2.5 px-3 text-right text-slate-400 text-xs">{g.toi ?? '—'}</td>
                            </>
                          ) : (
                            <>
                              <td className={`py-2.5 px-3 text-right font-bold ${g.wins ? 'text-green-400' : 'text-red-400'}`}>
                                {g.wins === undefined ? '—' : g.wins ? 'W' : 'L'}
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-300">{g.goalsAgainst ?? '—'}</td>
                              <td className="py-2.5 px-3 text-right text-slate-300">
                                {g.savePctg != null ? (g.savePctg * 100).toFixed(1) + '%' : '—'}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* AI OUTLOOK TAB */}
          {activeTab === 'outlook' && (
            <>
              {outlookLoading && (
                <div className="bg-blue-900/30 border border-blue-700 rounded-xl p-8 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
                  <p className="text-blue-200">Generating AI-powered outlook...</p>
                </div>
              )}

              {outlookError && (
                <div className="bg-red-900/30 border border-red-700 rounded-xl p-4">
                  <p className="text-red-200">Error: {outlookError}</p>
                  <button
                    onClick={fetchOutlook}
                    className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}

              {outlook && !outlookLoading && (
                <>
                  <div className="bg-slate-700/50 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-slate-100">AI Outlook</h3>
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-lg text-sm font-medium ${getValueColor(outlook.fantasyValue)}`}>
                          {outlook.fantasyValue}
                        </span>
                        <span className={`text-lg font-bold ${getTrendColor(outlook.trend)}`}>
                          {outlook.trend === 'Hot' && '🔥'}
                          {outlook.trend === 'Cold' && '🥶'}
                          {outlook.trend === 'Steady' && '➡️'}
                          {' '}{outlook.trend}
                        </span>
                      </div>
                    </div>
                    <p className="text-slate-300 leading-relaxed">{outlook.summary}</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-green-900/20 border border-green-700 rounded-xl p-6">
                      <h4 className="text-lg font-bold text-green-300 mb-3">Strengths</h4>
                      <ul className="space-y-2">
                        {outlook.strengths.map((s, i) => (
                          <li key={i} className="text-slate-300 flex items-start">
                            <span className="text-green-400 mr-2">•</span>{s}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-red-900/20 border border-red-700 rounded-xl p-6">
                      <h4 className="text-lg font-bold text-red-300 mb-3">Weaknesses</h4>
                      <ul className="space-y-2">
                        {outlook.weaknesses.map((w, i) => (
                          <li key={i} className="text-slate-300 flex items-start">
                            <span className="text-red-400 mr-2">•</span>{w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="bg-purple-900/20 border border-purple-700 rounded-xl p-6">
                    <h4 className="text-lg font-bold text-purple-300 mb-3">Rest of Season Outlook</h4>
                    <p className="text-slate-300 leading-relaxed">{outlook.restOfSeasonProjection}</p>
                  </div>

                  <div className="bg-slate-700/50 rounded-xl p-4 flex items-center justify-between">
                    <span className="text-slate-300 font-medium">Injury Risk (AI Assessment)</span>
                    <span className={`text-lg font-bold ${getRiskColor(outlook.injuryRisk)}`}>
                      {outlook.injuryRisk}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 text-center">
                    Outlook generated {new Date(outlook.generatedAt).toLocaleString()}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
