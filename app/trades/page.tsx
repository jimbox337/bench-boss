'use client';

import { useState } from 'react';
import { myTeam } from '@/lib/mockdata';
import { analyzeTrade, defaultLeagueSettings } from '@/lib/calculator';
import { useData } from '@/lib/DataContext';

export default function TradeAnalyzer() {
  const { players, projections } = useData();
  const [playersOut, setPlayersOut] = useState<string[]>([myTeam[2]?.id || '']);
  const [playersIn, setPlayersIn] = useState<string[]>([myTeam[0]?.id || '']);
  const [analyzed, setAnalyzed] = useState(false);

  const handleAnalyze = () => {
    setAnalyzed(true);
  };

  const playersOutObjs = playersOut.map(id => players.find(p => p.id === id)!).filter(Boolean);
  const playersInObjs = playersIn.map(id => players.find(p => p.id === id)!).filter(Boolean);

  const analysis = analyzeTrade(playersOutObjs, playersInObjs, projections, defaultLeagueSettings);

  return (
    <div className="p-8">
      <h2 className="text-3xl font-bold text-slate-100 mb-6">Trade Analyzer</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Giving Up */}
        <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-6">
          <h3 className="text-lg font-bold text-red-600 mb-4">🔴 Giving Up</h3>
          <div className="space-y-2 mb-4">
            {playersOut.map((id, idx) => {
              const player = players.find(p => p.id === id);
              return (
                <div key={idx} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <select
                    className="flex-1 bg-transparent border-none font-medium text-slate-100"
                    value={id}
                    onChange={(e) => {
                      const newPlayersOut = [...playersOut];
                      newPlayersOut[idx] = e.target.value;
                      setPlayersOut(newPlayersOut);
                    }}
                  >
                    {myTeam.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <button 
                    onClick={() => setPlayersOut(playersOut.filter((_, i) => i !== idx))}
                    className="text-red-600 hover:text-red-700 ml-2"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
          <button 
            onClick={() => setPlayersOut([...playersOut, myTeam[0]?.id || ''])}
            className="w-full border-2 border-dashed border-slate-600 rounded-lg py-2 text-slate-400 hover:border-red-400 hover:text-red-600 transition-colors"
          >
            + Add Player
          </button>
        </div>

        {/* Getting */}
        <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-6">
          <h3 className="text-lg font-bold text-green-600 mb-4">🟢 Getting</h3>
          <div className="space-y-2 mb-4">
            {playersIn.map((id, idx) => {
              const player = players.find(p => p.id === id);
              return (
                <div key={idx} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <select
                    className="flex-1 bg-transparent border-none font-medium text-slate-100"
                    value={id}
                    onChange={(e) => {
                      const newPlayersIn = [...playersIn];
                      newPlayersIn[idx] = e.target.value;
                      setPlayersIn(newPlayersIn);
                    }}
                  >
                    {players.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <button 
                    onClick={() => setPlayersIn(playersIn.filter((_, i) => i !== idx))}
                    className="text-green-600 hover:text-green-700 ml-2"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => setPlayersIn([...playersIn, players[0]?.id || ''])}
            className="w-full border-2 border-dashed border-slate-600 rounded-lg py-2 text-slate-400 hover:border-green-400 hover:text-green-600 transition-colors"
          >
            + Add Player
          </button>
        </div>
      </div>

      <button 
        onClick={handleAnalyze}
        className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-bold text-lg hover:bg-blue-700 transition-colors mb-6"
      >
        Analyze Trade
      </button>

      {/* Trade Result */}
      {analyzed && (
        <>
          <div className={`rounded-xl p-6 mb-6 border-2 ${
            analysis.verdict === 'Win' ? 'bg-gradient-to-r from-green-50 to-green-100 border-green-500' :
            analysis.verdict === 'Loss' ? 'bg-gradient-to-r from-red-50 to-red-100 border-red-500' :
            'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-500'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className={`text-2xl font-bold ${
                  analysis.verdict === 'Win' ? 'text-green-900' :
                  analysis.verdict === 'Loss' ? 'text-red-900' : 'text-yellow-900'
                }`}>
                  {analysis.verdict === 'Win' ? '✅ ACCEPT THIS TRADE' :
                   analysis.verdict === 'Loss' ? '❌ REJECT THIS TRADE' :
                   '⚖️ FAIR TRADE'}
                </h3>
                <p className={`mt-1 ${
                  analysis.verdict === 'Win' ? 'text-green-700' :
                  analysis.verdict === 'Loss' ? 'text-red-700' : 'text-yellow-700'
                }`}>
                  {analysis.summary}
                </p>
              </div>
              <div className="text-5xl">
                {analysis.verdict === 'Win' ? '🎯' :
                 analysis.verdict === 'Loss' ? '🚫' : '🤝'}
              </div>
            </div>
          </div>

          {/* Detailed Stats */}
          <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-6">
            <h3 className="text-xl font-bold mb-4">Net Gain/Loss</h3>
            <div className="text-center">
              <p className={`text-4xl font-bold ${analysis.netGain > 0 ? 'text-green-600' : analysis.netGain < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                {analysis.netGain > 0 ? '+' : ''}{analysis.netGain.toFixed(1)} pts
              </p>
              <p className="text-sm text-slate-400 mt-2">Rest of Season</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}