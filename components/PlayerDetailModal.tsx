'use client';

import { useState, useEffect, useRef } from 'react';
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

  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => previousFocus?.focus();
  }, [isOpen]);

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
      case 'Healthy': return 'bg-success/10 text-success';
      case 'Day-to-Day': return 'bg-accent/10 text-accent';
      case 'Questionable': return 'bg-accent/10 text-accent';
      case 'IR':
      case 'Out': return 'bg-error/10 text-error';
      default: return 'bg-paper-3 text-ink';
    }
  };

  const getValueColor = (value: string) => {
    switch (value) {
      case 'Must-Start': return 'bg-success/10';
      case 'Start': return 'bg-success/10';
      case 'Flex': return 'bg-accent/10';
      case 'Bench': return 'bg-accent/10';
      case 'Drop': return 'bg-error/10';
      default: return 'bg-paper-3';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'Hot': return 'text-error';
      case 'Cold': return 'text-accent-2';
      default: return 'text-accent';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low': return 'text-success';
      case 'Moderate': return 'text-accent';
      case 'High': return 'text-error';
      default: return 'text-muted';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper/85 p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${player.name} player details`}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
          if (event.key === 'Tab') {
            const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input, select, textarea, [tabindex="0"]');
            if (!controls?.length) return;
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
          }
        }}
        className="bb-panel max-w-4xl w-full max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-rule bg-paper-2">
          <div className="flex items-center">
            {player.headshotUrl && (
              <div className="w-20 h-24 sm:w-40 sm:h-44 shrink-0 self-end relative">
                <img
                  src={player.headshotUrl}
                  alt={player.name}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
            )}

            <div className="min-w-0 flex-1 p-4 sm:p-6 flex flex-col justify-center">
              <div className="flex items-start justify-between">
                <div>
                  {(() => {
                    const nameParts = player.name.split(' ');
                    const firstName = nameParts.slice(0, -1).join(' ');
                    const lastName = nameParts[nameParts.length - 1];
                    return (
                      <>
                        <div className="text-lg font-medium text-ink-2 mb-1">{firstName}</div>
                        <div className="text-3xl sm:text-4xl font-medium text-ink mb-3 break-words">{lastName}</div>
                      </>
                    );
                  })()}
                  <div className="flex items-center gap-3 flex-wrap text-lg">
                    <span className="text-ink-2 font-medium">{player.positions?.join('/') ?? ''}</span>
                    {player.nhlTeam !== 'UNK' && (
                      <>
                        <span className="text-muted" aria-hidden="true">/</span>
                        <span className="text-ink-2 font-medium">{player.nhlTeam}</span>
                      </>
                    )}
                    {injuryStatus && (
                      <>
                        <span className="text-muted" aria-hidden="true">/</span>
                        <span className={`px-2 py-1  text-sm font-medium ${getInjuryStatusColor(injuryStatus)}`}>
                          {injuryStatus}
                        </span>
                      </>
                    )}
                  </div>
                  {injury?.description && (
                    <p className="text-sm text-error mt-2">{injury.description}</p>
                  )}

                  {/* Last 5 games quick view */}
                  {last5.length > 0 && (
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-xs text-muted">Last 5:</span>
                      {last5.map((g, i) => (
                        <div
                          key={i}
                          title={`${g.gameDate} vs ${g.opponentAbbrev}: ${g.goals}G ${g.assists}A`}
                          className={`w-7 h-7  flex items-center justify-center text-xs font-medium ${
                            g.points >= 2 ? 'bg-paper-3 text-ink' :
                            g.points === 1 ? 'bg-paper-3 text-ink' :
                            'bg-paper-3 text-muted'
                          }`}
                        >
                          {g.points}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={onClose} aria-label="Close player details" className="bb-button-secondary shrink-0 self-start">
                  <svg aria-hidden="true" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto border-b border-rule px-4 sm:px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              aria-pressed={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted hover:text-ink-2'
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
                <h3 className="text-xl font-medium text-ink mb-4">2025-26 Stats</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 border-y border-rule py-4">
                  {[
                    { label: 'GP', value: player.gamesPlayed || 0, color: 'text-ink' },
                    { label: 'Points', value: player.seasonStats?.PTS || 0, color: 'text-accent-2' },
                    { label: 'Goals', value: player.seasonStats?.G || 0, color: 'text-ink' },
                    { label: 'Assists', value: player.seasonStats?.A || 0, color: 'text-ink' },
                    { label: 'PPP', value: player.seasonStats?.PPP || 0, color: 'text-ink' },
                    { label: 'SOG', value: player.seasonStats?.SOG || 0, color: 'text-ink' },
                    { label: 'Hits', value: player.seasonStats?.HIT || 0, color: 'text-ink' },
                    { label: 'Blocks', value: player.seasonStats?.BLK || 0, color: 'text-ink' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="border-l border-rule px-4">
                      <div className="text-sm text-muted">{label}</div>
                      <div className={`text-2xl font-medium ${color}`}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Injury Section */}
              <div>
                <h3 className="text-xl font-medium text-ink mb-4">Injury Status</h3>
                {gameLogLoading ? (
                  <div className="bg-paper-3  p-4 text-muted text-sm">Loading injury info…</div>
                ) : (
                  <div className="bg-paper-3  p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-ink-2 font-medium">Current Status</span>
                      <span className={`px-3 py-1  text-sm font-medium ${getInjuryStatusColor(injuryStatus)}`}>
                        {injuryStatus ?? 'Active'}
                      </span>
                    </div>
                    {injury?.description && (
                      <div className="border-t border-rule pt-3">
                        <p className="text-sm text-ink-2 font-medium mb-1">Details</p>
                        <p className="text-sm text-error">{injury.description}</p>
                      </div>
                    )}
                    {!injury?.description && (
                      <p className="text-xs text-muted border-t border-rule pt-3">No active injury reported</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* GAME LOG TAB */}
          {activeTab === 'gamelog' && (
            <div>
              <h3 className="text-xl font-medium text-ink mb-4">Recent Games</h3>
              {gameLogLoading ? (
                <div className="flex items-center justify-center py-12 text-muted">
                  <div className="motion-safe:animate-spin motion-reduce:animate-none rounded-full h-8 w-8 border-b-2 border-rule mr-3"></div>
                  Loading game log…
                </div>
              ) : gameLogs.length === 0 ? (
                <div className="bg-paper-3  p-8 text-center text-muted">
                  No game log data available
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="bb-table w-full text-sm">
                    <thead>
                      <tr className="border-b border-rule">
                        <th className="text-left py-2 px-3 text-xs text-muted  font-medium">Date</th>
                        <th className="text-left py-2 px-3 text-xs text-muted  font-medium">Opp</th>
                        {!player.isGoalie ? (
                          <>
                            <th className="text-right py-2 px-3 text-xs text-muted  font-medium">G</th>
                            <th className="text-right py-2 px-3 text-xs text-muted  font-medium">A</th>
                            <th className="text-right py-2 px-3 text-xs text-muted  font-medium">PTS</th>
                            <th className="text-right py-2 px-3 text-xs text-muted  font-medium">+/-</th>
                            <th className="text-right py-2 px-3 text-xs text-muted  font-medium">PPP</th>
                            <th className="text-right py-2 px-3 text-xs text-muted  font-medium">SOG</th>
                            <th className="text-right py-2 px-3 text-xs text-muted  font-medium">HIT</th>
                            <th className="text-right py-2 px-3 text-xs text-muted  font-medium">BLK</th>
                            <th className="text-right py-2 px-3 text-xs text-muted  font-medium">TOI</th>
                          </>
                        ) : (
                          <>
                            <th className="text-right py-2 px-3 text-xs text-muted  font-medium">Dec</th>
                            <th className="text-right py-2 px-3 text-xs text-muted  font-medium">GA</th>
                            <th className="text-right py-2 px-3 text-xs text-muted  font-medium">SV%</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rule">
                      {gameLogs.map((g, i) => (
                        <tr key={i} className={`hover:bg-paper-3 transition-colors ${g.points >= 2 ? 'bg-paper-3' : ''}`}>
                          <td className="py-2.5 px-3 text-ink-2 whitespace-nowrap">
                            {new Date(g.gameDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="text-muted text-xs">{g.homeRoadFlag === 'H' ? 'vs' : '@'}</span>
                            {' '}<span className="text-ink font-medium">{g.opponentAbbrev}</span>
                          </td>
                          {!player.isGoalie ? (
                            <>
                              <td className="py-2.5 px-3 text-right text-ink-2">{g.goals}</td>
                              <td className="py-2.5 px-3 text-right text-ink-2">{g.assists}</td>
                              <td className={`py-2.5 px-3 text-right font-medium ${g.points >= 2 ? 'text-accent-2' : g.points === 1 ? 'text-ink' : 'text-muted'}`}>
                                {g.points}
                              </td>
                              <td className={`py-2.5 px-3 text-right ${g.plusMinus > 0 ? 'text-success' : g.plusMinus < 0 ? 'text-error' : 'text-muted'}`}>
                                {g.plusMinus > 0 ? `+${g.plusMinus}` : g.plusMinus}
                              </td>
                              <td className="py-2.5 px-3 text-right text-ink-2">{g.powerPlayPoints}</td>
                              <td className="py-2.5 px-3 text-right text-ink-2">{g.shots}</td>
                              <td className="py-2.5 px-3 text-right text-ink-2">{g.hits}</td>
                              <td className="py-2.5 px-3 text-right text-ink-2">{g.blockedShots}</td>
                              <td className="py-2.5 px-3 text-right text-muted text-xs">{g.toi ?? '—'}</td>
                            </>
                          ) : (
                            <>
                              <td className={`py-2.5 px-3 text-right font-medium ${g.wins ? 'text-success' : 'text-error'}`}>
                                {g.wins === undefined ? '—' : g.wins ? 'W' : 'L'}
                              </td>
                              <td className="py-2.5 px-3 text-right text-ink-2">{g.goalsAgainst ?? '—'}</td>
                              <td className="py-2.5 px-3 text-right text-ink-2">
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
                <div className="bg-paper-3 border border-rule  p-8 text-center">
                  <div className="motion-safe:animate-spin motion-reduce:animate-none rounded-full h-12 w-12 border-b-2 border-rule mx-auto mb-4"></div>
                  <p className="text-accent-2">Generating AI-powered outlook…</p>
                </div>
              )}

              {outlookError && (
                <div className="bg-error/10 border border-error  p-4">
                  <p className="text-error">Error: {outlookError}</p>
                  <button
                    onClick={fetchOutlook}
                    className="bb-button-secondary mt-3"
                  >
                    Retry
                  </button>
                </div>
              )}

              {outlook && !outlookLoading && (
                <>
                  <div className="bg-paper-3  p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-medium text-ink">AI Outlook</h3>
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1  text-sm font-medium ${getValueColor(outlook.fantasyValue)}`}>
                          {outlook.fantasyValue}
                        </span>
                        <span className={`text-lg font-medium ${getTrendColor(outlook.trend)}`}>
                          {' '}{outlook.trend}
                        </span>
                      </div>
                    </div>
                    <p className="text-ink-2 leading-relaxed">{outlook.summary}</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="border-t border-rule pt-6">
                      <h4 className="text-lg font-medium text-success mb-3">Strengths</h4>
                      <ul className="space-y-2">
                        {outlook.strengths.map((s, i) => (
                          <li key={i} className="text-ink-2 flex items-start">
                            <span className="text-success mr-2">•</span>{s}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="border-t border-rule pt-6">
                      <h4 className="text-lg font-medium text-error mb-3">Weaknesses</h4>
                      <ul className="space-y-2">
                        {outlook.weaknesses.map((w, i) => (
                          <li key={i} className="text-ink-2 flex items-start">
                            <span className="text-error mr-2">•</span>{w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="border-t border-rule pt-6">
                    <h4 className="text-lg font-medium text-accent-2 mb-3">Rest of Season Outlook</h4>
                    <p className="text-ink-2 leading-relaxed">{outlook.restOfSeasonProjection}</p>
                  </div>

                  <div className="bg-paper-3  p-4 flex items-center justify-between">
                    <span className="text-ink-2 font-medium">Injury Risk (AI Assessment)</span>
                    <span className={`text-lg font-medium ${getRiskColor(outlook.injuryRisk)}`}>
                      {outlook.injuryRisk}
                    </span>
                  </div>

                  <div className="text-xs text-muted text-center">
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
