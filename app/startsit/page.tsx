'use client';

import { useState } from 'react';
import { myTeam } from '@/lib/mockdata';
import { calculateFantasyPoints, defaultLeagueSettings } from '@/lib/calculator';
import { useData } from '@/lib/DataContext';

export default function StartSit() {
  const { players, projections } = useData();
  const [player1Id, setPlayer1Id] = useState(myTeam[0]?.id || '');
  const [player2Id, setPlayer2Id] = useState(myTeam[1]?.id || '');
  const [timeframe, setTimeframe] = useState('next_7');

  const player1 = players.find(p => p.id === player1Id);
  const player2 = players.find(p => p.id === player2Id);

  const proj1 = projections.find(p => p.playerId === player1Id);
  const proj2 = projections.find(p => p.playerId === player2Id);
  
  const points1 = proj1 ? calculateFantasyPoints(proj1, defaultLeagueSettings) : 0;
  const points2 = proj2 ? calculateFantasyPoints(proj2, defaultLeagueSettings) : 0;

  const winner = points1 > points2 ? player1 : player2;
  const winnerProj = points1 > points2 ? proj1 : proj2;

  return (
    <div className="p-8">
      <h2 className="text-3xl font-bold text-slate-100 mb-6">Start / Sit Tool</h2>

      {/* Controls */}
      <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-6 mb-6">
        <h3 className="text-lg font-bold text-slate-100 mb-4">Compare Players</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Player 1</label>
            <select
              className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 py-2 focus:border-blue-500 focus:outline-none"
              value={player1Id}
              onChange={(e) => setPlayer1Id(e.target.value)}
            >
              {myTeam.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Player 2</label>
            <select
              className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 py-2 focus:border-blue-500 focus:outline-none"
              value={player2Id}
              onChange={(e) => setPlayer2Id(e.target.value)}
            >
              {myTeam.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
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
  );
}