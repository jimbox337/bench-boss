'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { useData } from '@/lib/DataContext';
import { mapESPNPlayersToNHL } from '@/lib/espnFantasyApi';

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

function ESPNSetupInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { players, setMyTeam, setESPNConfig, setLeagueSettings } = useData();
  const [leagueId, setLeagueId] = useState('');
  const [leagueIdInput, setLeagueIdInput] = useState('');
  const [seasonId] = useState('2025');
  const [espnS2, setEspnS2] = useState('');
  const [swid, setSwid] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showTeamSelection, setShowTeamSelection] = useState(false);
  const [availableTeams, setAvailableTeams] = useState<ESPNTeam[]>([]);
  const [leagueInfo, setLeagueInfo] = useState<LeagueInfo | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

  // Auto-fill cookies from bookmarklet redirect params
  useEffect(() => {
    const s2 = searchParams.get('espn_s2');
    const swidParam = searchParams.get('swid');
    if (s2) { setEspnS2(s2); setShowAdvanced(true); }
    if (swidParam) { setSwid(swidParam); setShowAdvanced(true); }
  }, [searchParams]);

  const handleOpenESPN = () => {
    window.open('https://www.espn.com/fantasy/hockey/', '_blank');
  };

  const parseLeagueInput = (value: string) => {
    setLeagueIdInput(value);
    const match = value.match(/leagueId=(\d+)/);
    if (match) {
      setLeagueId(match[1]);
    } else if (/^\d+$/.test(value.trim())) {
      setLeagueId(value.trim());
    } else {
      setLeagueId('');
    }
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
          setLeagueInfo(data.league);
          setAvailableTeams(data.teams);
          setShowTeamSelection(true);
        } else {
          router.push('/myteam');
        }
      } else {
        setError(data.error || 'Failed to connect ESPN league');
      }
    } catch {
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
      const config = {
        leagueId,
        seasonId: parseInt(seasonId),
        espnS2: espnS2 || undefined,
        swid: swid || undefined,
      };

      const res = await fetch('/api/espn-league', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch league data');
      }

      const selectedTeam = data.teams?.find((t: any) => t.id === selectedTeamId);
      if (!selectedTeam) {
        throw new Error('Selected team not found');
      }

      const mappedPlayers = mapESPNPlayersToNHL(selectedTeam.roster, players);

      if (mappedPlayers.length === 0) {
        throw new Error('No players could be matched. NHL player data may still be loading — try again in a moment.');
      }

      setESPNConfig(config);
      if (data.leagueInfo?.settings) {
        setLeagueSettings(data.leagueInfo.settings);
      }
      setMyTeam(mappedPlayers);

      router.push('/myteam');
    } catch (err: any) {
      setError(err?.message || 'An error occurred while selecting your team');
    } finally {
      setIsLoading(false);
    }
  };

  const bookmarkletCode = `javascript:(function(){var c=document.cookie,s2=c.match(/espn_s2=([^;]+)/),sw=c.match(/SWID=([^;]+)/);if(!s2||!sw){alert('Not found. Make sure you are logged in to ESPN.');return;}window.location='https://www.benchboss.pro/teams/espn?espn_s2='+encodeURIComponent(s2[1])+'&swid='+encodeURIComponent(sw[1]);})()`;

  if (showTeamSelection && leagueInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-8">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white font-black text-xl">
              ESPN
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
                      <img src={team.logo} alt={team.name} className="w-12 h-12 rounded-lg object-cover" />
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
          <div className="w-20 h-20 bg-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white font-black text-xl">
            ESPN
          </div>
          <h1 className="text-4xl font-bold text-slate-100 mb-3">Connect ESPN Fantasy</h1>
          <p className="text-slate-400 text-lg">Sync your ESPN league automatically</p>
        </div>

        <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700">
          {/* Open ESPN */}
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

          {/* Bookmarklet */}
          <div className="mb-6 p-4 bg-slate-900/60 border border-slate-600 rounded-lg">
            <h3 className="text-slate-200 font-semibold mb-1 text-sm">Private league? Auto-grab cookies</h3>
            <p className="text-slate-400 text-xs mb-3">
              Drag the button to your bookmarks bar. Then visit ESPN Fantasy, click it, and your cookies will be filled in automatically.
            </p>
            <div className="flex items-center gap-3">
              <div
                dangerouslySetInnerHTML={{
                  __html: `<a href="${bookmarkletCode}" draggable="true" style="display:inline-block;padding:8px 16px;background:#EAB308;color:#000;font-size:14px;font-weight:700;border-radius:8px;cursor:grab;text-decoration:none;user-select:none;">BenchBoss ESPN Auth</a>`
                }}
              />
              <span className="text-slate-500 text-xs">← drag to bookmarks bar</span>
            </div>
          </div>

          {error && (
            <div className="mb-6 bg-red-900/30 border border-red-600 text-red-200 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="p-4 bg-blue-900/20 border border-blue-600 rounded-lg">
              <h3 className="text-blue-400 font-bold mb-0">Step 2: Enter Your League ID</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                ESPN League URL or ID *
              </label>
              <input
                type="text"
                value={leagueIdInput}
                onChange={(e) => parseLeagueInput(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 py-3 focus:border-red-500 focus:outline-none"
                placeholder="Paste your league URL or just the ID"
                required
              />
              {leagueId && leagueIdInput !== leagueId && (
                <p className="text-xs text-green-400 mt-2">League ID detected: <strong>{leagueId}</strong></p>
              )}
              {!leagueId && leagueIdInput && (
                <p className="text-xs text-red-400 mt-2">Couldn't find a league ID — try pasting the full URL</p>
              )}
              {!leagueIdInput && (
                <p className="text-xs text-slate-400 mt-2">
                  Paste your ESPN league URL (e.g. <span className="text-slate-300">fantasy.espn.com/hockey/league?leagueId=12345678</span>) or just the numeric ID
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Season Year</label>
              <input
                type="text"
                value={seasonId}
                readOnly
                className="w-full bg-slate-600 border border-slate-600 text-slate-300 rounded-lg px-4 py-3 cursor-not-allowed"
              />
              <p className="text-xs text-slate-400 mt-2">Current season (2024-2025) — ESPN uses end year</p>
            </div>

            {/* Private League Options */}
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
                  {espnS2 && swid && (
                    <div className="flex items-center gap-2 text-green-400 text-xs bg-green-900/20 border border-green-700 rounded px-3 py-2">
                      <span>✓</span>
                      <span>Cookies loaded — ready to connect private league</span>
                    </div>
                  )}
                  <p className="text-xs text-slate-400">
                    Required for private leagues. Use the bookmarklet above to auto-fill these, or paste manually.
                  </p>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">espn_s2 Cookie</label>
                    <input
                      type="text"
                      value={espnS2}
                      onChange={(e) => setEspnS2(e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 py-3 focus:border-red-500 focus:outline-none text-sm font-mono"
                      placeholder="AEA..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">SWID Cookie</label>
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
                      How to find these manually
                    </summary>
                    <ol className="list-decimal list-inside space-y-1 ml-2 mt-2">
                      <li>Open ESPN Fantasy in your browser and log in</li>
                      <li>Press F12 to open Developer Tools</li>
                      <li>Go to the "Application" tab → Cookies → espn.com</li>
                      <li>Copy the values for "espn_s2" and "SWID"</li>
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
        </div>
      </div>
    </div>
  );
}

export default function ESPNSetup() {
  return (
    <Suspense>
      <ESPNSetupInner />
    </Suspense>
  );
}
