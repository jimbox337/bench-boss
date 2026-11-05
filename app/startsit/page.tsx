'use client';

import { useState, useMemo } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { calculateFantasyPoints, calculateFantasyRange } from '@/lib/calculator';
import { pointsScoring } from '@/components/gamecenter/shared';
import { useData } from '@/lib/DataContext';

export default function StartSit() {
  const { players, projections, leagueSettings } = useData();
  const scoring = pointsScoring(leagueSettings);
  const [player1Name, setPlayer1Name] = useState('');
  const [player2Name, setPlayer2Name] = useState('');
  const [timeframe, setTimeframe] = useState('next_7');
  const [showPlayer1Suggestions, setShowPlayer1Suggestions] = useState(false);
  const [showPlayer2Suggestions, setShowPlayer2Suggestions] = useState(false);

  // Filter players based on search input
  const player1Suggestions = useMemo(() => {
    if (!player1Name || player1Name.length < 2) return [];
    return players
      .filter(p => p.name?.toLowerCase().includes(player1Name.toLowerCase()))
      .slice(0, 10);
  }, [player1Name, players]);

  const player2Suggestions = useMemo(() => {
    if (!player2Name || player2Name.length < 2) return [];
    return players
      .filter(p => p.name?.toLowerCase().includes(player2Name.toLowerCase()))
      .slice(0, 10);
  }, [player2Name, players]);

  // Find exact matches
  const player1 = players.find(p => p.name.toLowerCase() === player1Name.toLowerCase());
  const player2 = players.find(p => p.name.toLowerCase() === player2Name.toLowerCase());

  const proj1 = player1 ? projections.find(p => p.playerId === player1.id) : undefined;
  const proj2 = player2 ? projections.find(p => p.playerId === player2.id) : undefined;

  const points1 = proj1 ? calculateFantasyPoints(proj1, scoring.settings) : 0;
  const points2 = proj2 ? calculateFantasyPoints(proj2, scoring.settings) : 0;

  const winner = points1 > points2 ? player1 : player2;
  const winnerProj = points1 > points2 ? proj1 : proj2;

  return (
    <>
    <div className="bb-page">
      <header className="bb-page-header"><div><h1>Start / Sit Tool</h1><p>Put two players side by side before making the call.</p></div></header>

      {/* Controls */}
      <div className="bb-toolbar mb-6">
        <h3 className="text-lg font-medium text-ink mb-4">Compare Players</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <label className="block text-sm font-medium text-ink-2 mb-2">Player 1</label>
            <input aria-label="Player 1"
              type="text"
              className="bb-field w-full"
              placeholder="Enter player name..."
              value={player1Name}
              onChange={(e) => {
                setPlayer1Name(e.target.value);
                setShowPlayer1Suggestions(true);
              }}
              onFocus={() => setShowPlayer1Suggestions(true)}
              onBlur={() => setTimeout(() => setShowPlayer1Suggestions(false), 200)}
            />
            {showPlayer1Suggestions && player1Suggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-paper-3 border border-rule max-h-60 overflow-y-auto">
                {player1Suggestions.map(p => (
                  <button type="button"
                    key={p.id}
                    className="block w-full px-4 py-3 text-left hover:bg-paper-2 text-ink"
                    onClick={() => {
                      setPlayer1Name(p.name);
                      setShowPlayer1Suggestions(false);
                    }}
                  >
                    {p.name} <span className="text-muted text-sm">({p.nhlTeam} - {p.positions?.join('/') ?? ''})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <label className="block text-sm font-medium text-ink-2 mb-2">Player 2</label>
            <input aria-label="Player 2"
              type="text"
              className="bb-field w-full"
              placeholder="Enter player name..."
              value={player2Name}
              onChange={(e) => {
                setPlayer2Name(e.target.value);
                setShowPlayer2Suggestions(true);
              }}
              onFocus={() => setShowPlayer2Suggestions(true)}
              onBlur={() => setTimeout(() => setShowPlayer2Suggestions(false), 200)}
            />
            {showPlayer2Suggestions && player2Suggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-paper-3 border border-rule max-h-60 overflow-y-auto">
                {player2Suggestions.map(p => (
                  <button type="button"
                    key={p.id}
                    className="block w-full px-4 py-3 text-left hover:bg-paper-2 text-ink"
                    onClick={() => {
                      setPlayer2Name(p.name);
                      setShowPlayer2Suggestions(false);
                    }}
                  >
                    {p.name} <span className="text-muted text-sm">({p.nhlTeam} - {p.positions?.join('/') ?? ''})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-2">Timeframe</label>
            <select aria-label="Timeframe"
              className="bb-field w-full"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
            >
              <option value="today">Today</option>
              <option value="next_7">This Week</option>
              <option value="next_14">Next 2 Weeks</option>
              <option value="rest_of_season">Rest of Season</option>
            </select>
          </div>
        </div>
      </div>

      {player1 && player2 ? <>
      {/* Recommendation */}
      <div className="border-l-2 border-success bg-paper-2 p-6 mb-6">
        <div className="flex items-start">
          <CheckCircle2 className="mr-4 h-6 w-6 shrink-0 text-success" aria-hidden="true" />
          <div>
            <h3 className="text-lg font-medium text-success">Start {winner?.name}</h3>
            <p className="text-sm text-success mt-1">
              {winner?.name} has {winnerProj?.gamesPlayed?.toFixed(1)} games vs {points1 > points2 ? player2?.name : player1?.name}’s {(points1 > points2 ? proj2?.gamesPlayed : proj1?.gamesPlayed)?.toFixed(1)},
              and projects {Math.abs(points1 - points2).toFixed(1)} more fantasy points this week.
            </p>
          </div>
        </div>
      </div>

      {/* Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-px border border-rule bg-rule">
        {/* Player 1 Card */}
        <div className={`bg-paper-2   overflow-hidden ${points1 > points2 ? 'border-t-2 border-success' : 'border-t-2 border-rule'}`}>
          <div className={`p-4 border-b ${points1 > points2 ? 'bg-success/10 border-success' : 'bg-paper-3 border-rule'}`}>
            <h4 className={`font-medium ${points1 > points2 ? 'text-success' : 'text-ink'}`}>
              {player1?.name}
            </h4>
            <p className={`text-sm ${points1 > points2 ? 'text-success' : 'text-muted'}`}>
              {player1?.nhlTeam} / {player1?.positions?.join('/') ?? ''} / {proj1?.gamesPlayed?.toFixed(1)} games this week{proj1?.source === 'model' ? ' · model estimate' : ''}
            </p>
          </div>
          <div className="p-6 space-y-3">
            <div className="flex justify-between">
              <span className="text-muted">Projected Points</span>
              <span className={`font-medium ${points1 > points2 ? 'text-success' : 'text-ink'}`}>
                {points1.toFixed(1)}
              </span>
            </div>
            {proj1 && calculateFantasyRange(proj1, scoring.settings) && (() => { const r = calculateFantasyRange(proj1, scoring.settings)!; return (
              <div className="flex justify-between text-sm"><span className="text-muted">80% range</span><span className="tabular-nums text-ink-2">{r.low.toFixed(1)} – {r.high.toFixed(1)}</span></div>
            ); })()}
            <div className="flex justify-between">
              <span className="text-muted">Goals</span>
              <span className="font-medium text-ink">{proj1?.skaterStats?.G.toFixed(1) || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Assists</span>
              <span className="font-medium text-ink">{proj1?.skaterStats?.A.toFixed(1) || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Shots on Goal</span>
              <span className="font-medium text-ink">{proj1?.skaterStats?.SOG.toFixed(1) || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">PPP</span>
              <span className="font-medium text-ink">{proj1?.skaterStats?.PPP.toFixed(1) || '-'}</span>
            </div>
          </div>
        </div>

        {/* Player 2 Card */}
        <div className={`bg-paper-2   overflow-hidden ${points2 > points1 ? 'border-t-2 border-success' : 'border-t-2 border-rule'}`}>
          <div className={`p-4 border-b ${points2 > points1 ? 'bg-success/10 border-success' : 'bg-paper-3 border-rule'}`}>
            <h4 className={`font-medium ${points2 > points1 ? 'text-success' : 'text-ink'}`}>
              {player2?.name}
            </h4>
            <p className={`text-sm ${points2 > points1 ? 'text-success' : 'text-muted'}`}>
              {player2?.nhlTeam} / {player2?.positions?.join('/') ?? ''} / {proj2?.gamesPlayed?.toFixed(1)} games this week{proj2?.source === 'model' ? ' · model estimate' : ''}
            </p>
          </div>
          <div className="p-6 space-y-3">
            <div className="flex justify-between">
              <span className="text-muted">Projected Points</span>
              <span className={`font-medium ${points2 > points1 ? 'text-success' : 'text-ink'}`}>
                {points2.toFixed(1)}
              </span>
            </div>
            {proj2 && calculateFantasyRange(proj2, scoring.settings) && (() => { const r = calculateFantasyRange(proj2, scoring.settings)!; return (
              <div className="flex justify-between text-sm"><span className="text-muted">80% range</span><span className="tabular-nums text-ink-2">{r.low.toFixed(1)} – {r.high.toFixed(1)}</span></div>
            ); })()}
            <div className="flex justify-between">
              <span className="text-muted">Goals</span>
              <span className="font-medium text-ink">{proj2?.skaterStats?.G.toFixed(1) || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Assists</span>
              <span className="font-medium text-ink">{proj2?.skaterStats?.A.toFixed(1) || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Shots on Goal</span>
              <span className="font-medium text-ink">{proj2?.skaterStats?.SOG.toFixed(1) || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">PPP</span>
              <span className="font-medium text-ink">{proj2?.skaterStats?.PPP.toFixed(1) || '-'}</span>
            </div>
          </div>
        </div>
      </div>
      </> : <div className="bb-empty"><h2>Select two players</h2><p>Search for a player in each field to compare their projections.</p></div>}
    </div>
    </>
  );
}
