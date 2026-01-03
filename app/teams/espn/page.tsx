'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface ESPNTeam {
  id: number;
  name: string;
  abbrev: string;
  logo?: string;
}

interface LeagueInfo {
  id: string;
  name: string;
  seasonId: number;
}

export default function ESPNSetup() {
  const router = useRouter();
  const [leagueId, setLeagueId] = useState('');
  const [seasonId, setSeasonId] = useState('2025');
  const [espnS2, setEspnS2] = useState('');
  const [swid, setSwid] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showTeamSelection, setShowTeamSelection] = useState(false);
  const [availableTeams, setAvailableTeams] = useState<ESPNTeam[]>([]);
  const [leagueInfo, setLeagueInfo] = useState<LeagueInfo | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

  const handleOpenESPN = () => {
    window.open('https://www.espn.com/fantasy/hockey/', '_blank');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!leagueId.trim()) {
      setError('Please enter your ESPN League ID');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/espn/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId,
          seasonId,
          espnS2: espnS2 || undefined,
          swid: swid || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        if (data.requiresTeamSelection) {
          // Show team selection
          setLeagueInfo(data.league);
          setAvailableTeams(data.teams);
          setShowTeamSelection(true);
        } else {
          // Team auto-selected, redirect to myteam
          router.push('/myteam');
        }
      } else {
        setError(data.error || 'Failed to connect ESPN league');
      }
    } catch (err) {
      setError('An error occurred while connecting your league');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTeamSelection = async () => {
    if (!selectedTeamId || !leagueInfo) {
      setError('Please select a team');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/espn/select-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId,
          seasonId,
          espnS2: espnS2 || undefined,
          swid: swid || undefined,
          teamId: selectedTeamId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        router.push('/myteam');
      } else {
        setError(data.error || 'Failed to select team');
      }
    } catch (err) {
      setError('An error occurred while selecting your team');
    } finally {
      setIsLoading(false);
    }
  };

  if (showTeamSelection && leagueInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-8">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize="10" fontWeight="bold">
                  ESPN
                </text>
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-slate-100 mb-3">Select Your Team</h1>
            <p className="text-slate-400 text-lg">{leagueInfo.name}</p>
          </div>

          <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700">
            {error && (
              <div className="mb-6 bg-red-900/30 border border-red-600 text-red-200 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="space-y-3 mb-6">
              {availableTeams.map((team) => (
                <div
                  key={team.id}
                  onClick={() => setSelectedTeamId(team.id)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedTeamId === team.id
                      ? 'border-red-500 bg-red-900/20'
                      : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {team.logo && (
                      <img
                        src={team.logo}
                        alt={team.name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    )}
                    <div>
                      <h3 className="text-lg font-bold text-slate-100">{team.name}</h3>
                      <p className="text-sm text-slate-400">{team.abbrev}</p>
                    </div>
                    {selectedTeamId === team.id && (
                      <div className="ml-auto text-red-500 text-2xl">✓</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setShowTeamSelection(false)}
                className="flex-1 px-6 py-3 border border-slate-600 text-slate-300 rounded-lg font-medium hover:bg-slate-700 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleTeamSelection}
                disabled={!selectedTeamId || isLoading}
                className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Connecting...' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
              <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize="10" fontWeight="bold">
                ESPN
              </text>
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-slate-100 mb-3">Connect ESPN Fantasy</h1>
          <p className="text-slate-400 text-lg">Sync your ESPN league automatically</p>
        </div>

        <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700">
          {/* Quick Access Button */}
          <div className="mb-6 p-4 bg-gradient-to-r from-red-600 to-red-700 rounded-lg">
            <h3 className="text-white font-bold mb-2">Step 1: Open Your ESPN League</h3>
            <p className="text-red-100 text-sm mb-3">
              Click below to open ESPN Fantasy in a new tab, then come back here to complete setup
            </p>
            <button
              type="button"
              onClick={handleOpenESPN}
              className="w-full px-6 py-3 bg-white text-red-600 rounded-lg font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
            >
              <span>Open ESPN Fantasy Hockey</span>
              <span>→</span>
            </button>
          </div>

          {error && (
            <div className="mb-6 bg-red-900/30 border border-red-600 text-red-200 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="p-4 bg-blue-900/20 border border-blue-600 rounded-lg">
              <h3 className="text-blue-400 font-bold mb-2">Step 2: Get Your League Information</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                ESPN League ID *
              </label>
              <input
                type="text"
                value={leagueId}
                onChange={(e) => setLeagueId(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 py-3 focus:border-red-500 focus:outline-none"
                placeholder="12345678"
                required
              />
              <p className="text-xs text-slate-400 mt-2">
                Look at your ESPN league URL and find the number after "leagueId="
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Season Year *
              </label>
              <input
                type="text"
                value={seasonId}
                onChange={(e) => setSeasonId(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 py-3 focus:border-red-500 focus:outline-none"
                placeholder="2025"
                required
              />
              <p className="text-xs text-slate-400 mt-2">
                Current fantasy season year (usually {new Date().getFullYear()})
              </p>
            </div>

            {/* Advanced Options for Private Leagues */}
            <div className="border-t border-slate-700 pt-6">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between text-slate-300 hover:text-slate-100 transition-colors"
              >
                <span className="text-sm font-medium">
                  {showAdvanced ? '▼' : '▶'} Advanced: Private League Access
                </span>
                <span className="text-xs text-slate-500">Optional</span>
              </button>

              {showAdvanced && (
                <div className="mt-4 space-y-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                  <p className="text-xs text-slate-400">
                    If your league is private, you'll need to provide authentication cookies from ESPN.
                    These allow BenchBoss to access your private league data.
                  </p>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      espn_s2 Cookie
                    </label>
                    <input
                      type="text"
                      value={espnS2}
                      onChange={(e) => setEspnS2(e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 py-3 focus:border-red-500 focus:outline-none text-sm font-mono"
                      placeholder="AEA..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      SWID Cookie
                    </label>
                    <input
                      type="text"
                      value={swid}
                      onChange={(e) => setSwid(e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 py-3 focus:border-red-500 focus:outline-none text-sm font-mono"
                      placeholder="{...}"
                    />
                  </div>

                  <details className="text-xs text-slate-400">
                    <summary className="cursor-pointer hover:text-slate-300 font-medium mb-2">
                      How to find these cookies
                    </summary>
                    <ol className="list-decimal list-inside space-y-1 ml-2 mt-2">
                      <li>Open ESPN Fantasy in your browser and log in</li>
                      <li>Press F12 to open Developer Tools</li>
                      <li>Go to the "Application" or "Storage" tab</li>
                      <li>Click "Cookies" → "https://fantasy.espn.com"</li>
                      <li>Find and copy the values for "espn_s2" and "SWID"</li>
                    </ol>
                  </details>
                </div>
              )}
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 px-6 py-3 border border-slate-600 text-slate-300 rounded-lg font-medium hover:bg-slate-700 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Connecting...' : 'Connect League'}
              </button>
            </div>
          </form>

          <div className="mt-6 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Quick Guide:</h3>
            <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
              <li>Click "Open ESPN Fantasy Hockey" above</li>
              <li>Navigate to your league in the new tab</li>
              <li>Copy the League ID from the URL (the number after "leagueId=")</li>
              <li>Return here and paste it in the form</li>
              <li>Click "Connect League" to sync your team</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
