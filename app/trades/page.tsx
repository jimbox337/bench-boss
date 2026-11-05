'use client';

import { useState } from 'react';
import { Scale, X } from 'lucide-react';
import { analyzeTrade } from '@/lib/calculator';
import { pointsScoring } from '@/components/gamecenter/shared';
import { useData } from '@/lib/DataContext';

export default function TradeAnalyzer() {
  const { players, projections, myTeam, leagueSettings } = useData();
  const scoring = pointsScoring(leagueSettings);
  const outgoingPlayers = myTeam.length ? myTeam : players;
  const [playersOut, setPlayersOut] = useState<string[]>([myTeam[2]?.id || '']);
  const [playersIn, setPlayersIn] = useState<string[]>([myTeam[0]?.id || '']);
  const [analyzed, setAnalyzed] = useState(false);

  const handleAnalyze = () => {
    setAnalyzed(true);
  };

  const playersOutObjs = playersOut.map(id => players.find(p => p.id === id)!).filter(Boolean);
  const playersInObjs = playersIn.map(id => players.find(p => p.id === id)!).filter(Boolean);

  const analysis = analyzeTrade(playersOutObjs, playersInObjs, projections, scoring.settings);

  return (
    <>
    <div className="bb-page">
      <header className="bb-page-header"><div><h1>Trade Analyzer</h1><p>Compare the players leaving your roster with the players coming in.</p></div></header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Giving Up */}
        <div className="bb-panel p-6">
          <h3 className="text-lg font-medium text-error mb-4">Giving up</h3>
          <div className="space-y-2 mb-4">
            {playersOut.map((id, idx) => {
              const player = players.find(p => p.id === id);
              return (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    className="bb-field min-w-0 flex-1"
                    value={id}
                    onChange={(e) => {
                      const newPlayersOut = [...playersOut];
                      newPlayersOut[idx] = e.target.value;
                      setPlayersOut(newPlayersOut);
                    }}
                  >
                    <option value="">Choose a player</option>
                    {outgoingPlayers.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setPlayersOut(playersOut.filter((_, i) => i !== idx))}
                    aria-label={`Remove ${player?.name || 'player'} from giving up`} className="bb-button-secondary shrink-0"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => setPlayersOut([...playersOut, myTeam[0]?.id || ''])}
            className="bb-button-secondary w-full"
          >
            + Add Player
          </button>
        </div>

        {/* Getting */}
        <div className="bb-panel p-6">
          <h3 className="text-lg font-medium text-success mb-4">Getting</h3>
          <div className="space-y-2 mb-4">
            {playersIn.map((id, idx) => {
              const player = players.find(p => p.id === id);
              return (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    className="bb-field min-w-0 flex-1"
                    value={id}
                    onChange={(e) => {
                      const newPlayersIn = [...playersIn];
                      newPlayersIn[idx] = e.target.value;
                      setPlayersIn(newPlayersIn);
                    }}
                  >
                    <option value="">Choose a player</option>
                    {players.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setPlayersIn(playersIn.filter((_, i) => i !== idx))}
                    aria-label={`Remove ${player?.name || 'player'} from getting`} className="bb-button-secondary shrink-0"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => setPlayersIn([...playersIn, players[0]?.id || ''])}
            className="bb-button-secondary w-full"
          >
            + Add Player
          </button>
        </div>
      </div>

      <button
        disabled={!playersOutObjs.length || !playersInObjs.length}
        onClick={handleAnalyze}
        className="bb-button mb-8"
      >
        Analyze Trade
      </button>

      {/* Trade Result */}
      {analyzed && (
        <>
          <div className={` p-6 mb-6 border-2 ${
            analysis.verdict === 'Win' ? 'bg-paper-2 border-success' :
            analysis.verdict === 'Loss' ? 'bg-paper-2 border-error' :
            'bg-paper-2 border-accent'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className={`text-2xl font-medium ${
                  analysis.verdict === 'Win' ? 'text-success' :
                  analysis.verdict === 'Loss' ? 'text-error' : 'text-accent'
                }`}>
                  {analysis.verdict === 'Win' ? 'Accept this trade' :
                   analysis.verdict === 'Loss' ? 'Reject this trade' :
                   'Fair trade'}
                </h3>
                <p className={`mt-1 ${
                  analysis.verdict === 'Win' ? 'text-success' :
                  analysis.verdict === 'Loss' ? 'text-error' : 'text-accent'
                }`}>
                  {analysis.summary}
                </p>
              </div>
              <div className="text-5xl">
                <Scale className="h-8 w-8 text-muted" aria-hidden="true" />
              </div>
            </div>
          </div>

          {/* Detailed Stats */}
          <div className="bb-panel p-6">
            <h3 className="text-xl font-medium mb-4">Net Gain/Loss</h3>
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <p className={`text-4xl font-medium ${analysis.netGain > 0 ? 'text-success' : analysis.netGain < 0 ? 'text-error' : 'text-muted'}`}>
                {analysis.netGain > 0 ? '+' : ''}{analysis.netGain.toFixed(1)} pts
              </p>
              <p className="text-sm text-muted mt-2">Rest of Season</p>
            </div>
          </div>
        </>
      )}
    </div>
    </>
  );
}
