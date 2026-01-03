'use client';

import { useState, useMemo } from 'react';
import { calculateFantasyPoints, defaultLeagueSettings } from '@/lib/calculator';
import { useData } from '@/lib/DataContext';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function StartSit() {
  const { players, projections } = useData();
  const [player1Name, setPlayer1Name] = useState('');
  const [player2Name, setPlayer2Name] = useState('');
  const [timeframe, setTimeframe] = useState('next_7');
  const [showPlayer1Suggestions, setShowPlayer1Suggestions] = useState(false);
  const [showPlayer2Suggestions, setShowPlayer2Suggestions] = useState(false);

  // Filter players based on search input
  const player1Suggestions = useMemo(() => {
    if (!player1Name || player1Name.length < 2) return [];
    return players
      .filter(p => p.name.toLowerCase().includes(player1Name.toLowerCase()))
      .slice(0, 10);
  }, [player1Name, players]);

  const player2Suggestions = useMemo(() => {
    if (!player2Name || player2Name.length < 2) return [];
    return players
      .filter(p => p.name.toLowerCase().includes(player2Name.toLowerCase()))
      .slice(0, 10);
  }, [player2Name, players]);

  // Find exact matches
  const player1 = players.find(p => p.name.toLowerCase() === player1Name.toLowerCase());
  const player2 = players.find(p => p.name.toLowerCase() === player2Name.toLowerCase());

  const proj1 = player1 ? projections.find(p => p.playerId === player1.id) : undefined;
  const proj2 = player2 ? projections.find(p => p.playerId === player2.id) : undefined;
  
  const points1 = proj1 ? calculateFantasyPoints(proj1, defaultLeagueSettings) : 0;
  const points2 = proj2 ? calculateFantasyPoints(proj2, defaultLeagueSettings) : 0;

  const winner = points1 > points2 ? player1 : player2;
  const winnerProj = points1 > points2 ? proj1 : proj2;

  return (
    <ProtectedRoute requiresTeam={true}>
    <div className="p-8">
      <h2 className="text-3xl font-bold text-slate-100 mb-6">Start / Sit Tool</h2>

      {/* Controls */}
      <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-6 mb-6">
        <h3 className="text-lg font-bold text-slate-100 mb-4">Compare Players</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <label className="block text-sm font-medium text-slate-300 mb-2">Player 1</label>
            <input
              type="text"
              className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 py-2 focus:border-blue-500 focus:outline-none"
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
              <div className="absolute z-10 w-full mt-1 bg-slate-700 border border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {player1Suggestions.map(p => (
                  <div
                    key={p.id}
                    className="px-4 py-2 hover:bg-slate-600 cursor-pointer text-slate-100"
                    onClick={() => {
                      setPlayer1Name(p.name);
                      setShowPlayer1Suggestions(false);
                    }}
                  >
                    {p.name} <span className="text-slate-400 text-sm">({p.nhlTeam} - {p.positions.join('/')})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <label className="block text-sm font-medium text-slate-300 mb-2">Player 2</label>
            <input
              type="text"
              className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 py-2 focus:border-blue-500 focus:outline-none"
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
              <div className="absolute z-10 w-full mt-1 bg-slate-700 border border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {player2Suggestions.map(p => (
                  <div
                    key={p.id}
                    className="px-4 py-2 hover:bg-slate-600 cursor-pointer text-slate-100"
                    onClick={() => {
                      setPlayer2Name(p.name);
                      setShowPlayer2Suggestions(false);
                    }}
                  >
                    {p.name} <span className="text-slate-400 text-sm">({p.nhlTeam} - {p.positions.join('/')})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Timeframe</label>
            <select
              className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 py-2 focus:border-blue-500 focus:outline-none"
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

      {/* Recommendation */}
      <div className="bg-green-900/30 border-2 border-green-600 rounded-xl p-6 mb-6">
        <div className="flex items-start">
          <div className="text-3xl mr-4">✅</div>
          <div>
            <h3 className="text-lg font-bold text-green-300">Start {winner?.name}</h3>
            <p className="text-sm text-green-200 mt-1">
              {winner?.name} has {winnerProj?.gamesPlayed} games vs {points1 > points2 ? player2?.name : player1?.name}'s {points1 > points2 ? proj2?.gamesPlayed : proj1?.gamesPlayed},
              and projects {Math.abs(points1 - points2).toFixed(1)} more fantasy points this week.
            </p>
          </div>
        </div>
      </div>

      {/* Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Player 1 Card */}
        <div className={`bg-slate-800 rounded-xl shadow-lg overflow-hidden ${points1 > points2 ? 'border-2 border-green-500' : 'border border-slate-700 opacity-75'}`}>
          <div className={`p-4 border-b ${points1 > points2 ? 'bg-green-900/30 border-green-700' : 'bg-slate-750 border-slate-700'}`}>
            <h4 className={`font-bold ${points1 > points2 ? 'text-green-300' : 'text-slate-200'}`}>
              {player1?.name}
            </h4>
            <p className={`text-sm ${points1 > points2 ? 'text-green-200' : 'text-slate-400'}`}>
              {player1?.nhlTeam} • {player1?.positions.join('/')} • {proj1?.gamesPlayed} games this week
            </p>
          </div>
          <div className="p-6 space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-400">Projected Points</span>
              <span className={`font-bold ${points1 > points2 ? 'text-green-400' : 'text-slate-200'}`}>
                {points1.toFixed(1)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Goals</span>
              <span className="font-bold text-slate-200">{proj1?.skaterStats?.G.toFixed(1) || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Assists</span>
              <span className="font-bold text-slate-200">{proj1?.skaterStats?.A.toFixed(1) || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Shots on Goal</span>
              <span className="font-bold text-slate-200">{proj1?.skaterStats?.SOG.toFixed(1) || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">PPP</span>
              <span className="font-bold text-slate-200">{proj1?.skaterStats?.PPP.toFixed(1) || '-'}</span>
            </div>
          </div>
        </div>

        {/* Player 2 Card */}
        <div className={`bg-slate-800 rounded-xl shadow-lg overflow-hidden ${points2 > points1 ? 'border-2 border-green-500' : 'border border-slate-700 opacity-75'}`}>
          <div className={`p-4 border-b ${points2 > points1 ? 'bg-green-900/30 border-green-700' : 'bg-slate-750 border-slate-700'}`}>
            <h4 className={`font-bold ${points2 > points1 ? 'text-green-300' : 'text-slate-200'}`}>
              {player2?.name}
            </h4>
            <p className={`text-sm ${points2 > points1 ? 'text-green-200' : 'text-slate-400'}`}>
              {player2?.nhlTeam} • {player2?.positions.join('/')} • {proj2?.gamesPlayed} games this week
            </p>
          </div>
          <div className="p-6 space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-400">Projected Points</span>
              <span className={`font-bold ${points2 > points1 ? 'text-green-400' : 'text-slate-200'}`}>
                {points2.toFixed(1)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Goals</span>
              <span className="font-bold text-slate-200">{proj2?.skaterStats?.G.toFixed(1) || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Assists</span>
              <span className="font-bold text-slate-200">{proj2?.skaterStats?.A.toFixed(1) || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Shots on Goal</span>
              <span className="font-bold text-slate-200">{proj2?.skaterStats?.SOG.toFixed(1) || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">PPP</span>
              <span className="font-bold text-slate-200">{proj2?.skaterStats?.PPP.toFixed(1) || '-'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    </ProtectedRoute>
  );
}