'use client';

import { useState, useEffect } from 'react';
import { Player, PlayerOutlook } from '@/lib/calculator';

interface PlayerDetailModalProps {
  player: Player;
  isOpen: boolean;
  onClose: () => void;
}

export default function PlayerDetailModal({ player, isOpen, onClose }: PlayerDetailModalProps) {
  const [outlook, setOutlook] = useState<PlayerOutlook | null>(player.outlook || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && !outlook) {
      fetchOutlook();
    }
  }, [isOpen]);

  const fetchOutlook = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/player-outlook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player })
      });

      const data = await response.json();

      if (data.success) {
        setOutlook(data.outlook);
      } else {
        setError(data.error || 'Failed to generate outlook');
      }
    } catch (err) {
      setError('Network error');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'Hot': return 'text-red-400';
      case 'Cold': return 'text-blue-400';
      default: return 'text-yellow-400';
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

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low': return 'text-green-400';
      case 'Moderate': return 'text-yellow-400';
      case 'High': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  const getInjuryStatusColor = (status?: string) => {
    switch (status) {
      case 'Healthy': return 'bg-green-600 text-white';
      case 'Day-to-Day': return 'bg-yellow-600 text-white';
      case 'Questionable': return 'bg-orange-600 text-white';
      case 'IR':
      case 'Out': return 'bg-red-600 text-white';
      default: return 'bg-slate-600 text-white';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 z-10 overflow-hidden">
          <div className="flex items-stretch relative">
            {/* Headshot */}
            {player.headshotUrl && (
              <div className="w-64 h-64 bg-slate-700 flex-shrink-0 relative">
                <img
                  src={player.headshotUrl}
                  alt={player.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}

            {/* Slanted dividers with gradient */}
            <div className="absolute left-64 top-0 bottom-0 w-8 -ml-4">
              <div className="absolute top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 to-purple-500 transform -skew-x-12"></div>
              <div className="absolute top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-400 to-purple-400 transform -skew-x-12 ml-3"></div>
            </div>

            {/* Player Info */}
            <div className="flex-1 p-8 flex flex-col justify-center ml-8 bg-gradient-to-r from-slate-900 to-slate-800">
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
                  <div className="flex items-center gap-4 text-lg">
                    <span className="text-slate-300 font-semibold">{player.positions.join('/')}</span>
                    {player.nhlTeam !== 'UNK' && (
                      <>
                        <span className="text-slate-600">•</span>
                        <span className="text-slate-300">#{player.id.slice(-2)}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-slate-300 font-semibold">{player.nhlTeam}</span>
                      </>
                    )}
                    {player.injuryStatus && (
                      <>
                        <span className="text-slate-600">•</span>
                        <span className={`px-2 py-1 rounded text-sm font-medium ${getInjuryStatusColor(player.injuryStatus)}`}>
                          {player.injuryStatus}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Season Stats */}
          <div>
            <h3 className="text-xl font-bold text-slate-100 mb-4">2025-26 Stats</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="text-xs text-slate-400 uppercase">GP</div>
                <div className="text-2xl font-bold text-slate-100">{player.gamesPlayed || 0}</div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="text-xs text-slate-400 uppercase">Points</div>
                <div className="text-2xl font-bold text-blue-400">{player.seasonStats?.PTS || 0}</div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="text-xs text-slate-400 uppercase">Goals</div>
                <div className="text-2xl font-bold text-slate-100">{player.seasonStats?.G || 0}</div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="text-xs text-slate-400 uppercase">Assists</div>
                <div className="text-2xl font-bold text-slate-100">{player.seasonStats?.A || 0}</div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="text-xs text-slate-400 uppercase">PPP</div>
                <div className="text-2xl font-bold text-slate-100">{player.seasonStats?.PPP || 0}</div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="text-xs text-slate-400 uppercase">SOG</div>
                <div className="text-2xl font-bold text-slate-100">{player.seasonStats?.SOG || 0}</div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="text-xs text-slate-400 uppercase">Hits</div>
                <div className="text-2xl font-bold text-slate-100">{player.seasonStats?.HIT || 0}</div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="text-xs text-slate-400 uppercase">Blocks</div>
                <div className="text-2xl font-bold text-slate-100">{player.seasonStats?.BLK || 0}</div>
              </div>
            </div>
          </div>

          {/* AI Outlook */}
          {isLoading && (
            <div className="bg-blue-900/30 border border-blue-700 rounded-xl p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
              <p className="text-blue-200">Generating AI-powered outlook...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-xl p-4">
              <p className="text-red-200">Error: {error}</p>
              <button
                onClick={fetchOutlook}
                className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {outlook && !isLoading && (
            <>
              {/* Summary */}
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

              {/* Strengths & Weaknesses */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-green-900/20 border border-green-700 rounded-xl p-6">
                  <h4 className="text-lg font-bold text-green-300 mb-3">✅ Strengths</h4>
                  <ul className="space-y-2">
                    {outlook.strengths.map((strength, idx) => (
                      <li key={idx} className="text-slate-300 flex items-start">
                        <span className="text-green-400 mr-2">•</span>
                        {strength}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-red-900/20 border border-red-700 rounded-xl p-6">
                  <h4 className="text-lg font-bold text-red-300 mb-3">⚠️ Weaknesses</h4>
                  <ul className="space-y-2">
                    {outlook.weaknesses.map((weakness, idx) => (
                      <li key={idx} className="text-slate-300 flex items-start">
                        <span className="text-red-400 mr-2">•</span>
                        {weakness}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Rest of Season */}
              <div className="bg-purple-900/20 border border-purple-700 rounded-xl p-6">
                <h4 className="text-lg font-bold text-purple-300 mb-3">🔮 Rest of Season Outlook</h4>
                <p className="text-slate-300 leading-relaxed">{outlook.restOfSeasonProjection}</p>
              </div>

              {/* Injury Risk */}
              <div className="bg-slate-700/50 rounded-xl p-4 flex items-center justify-between">
                <span className="text-slate-300 font-medium">Injury Risk Assessment</span>
                <span className={`text-lg font-bold ${getRiskColor(outlook.injuryRisk)}`}>
                  {outlook.injuryRisk}
                </span>
              </div>

              <div className="text-xs text-slate-500 text-center">
                Outlook generated {new Date(outlook.generatedAt).toLocaleString()}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
