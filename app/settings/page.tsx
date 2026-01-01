'use client';

import { useState, useEffect } from 'react';
import { defaultLeagueSettings } from '@/lib/calculator';
import { useData } from '@/lib/DataContext';

export default function Settings() {
  const { espnConfig, espnLeagueInfo, syncESPNLeague, leagueSettings, setLeagueSettings } = useData();

  const [leagueName, setLeagueName] = useState('My League');
  const [platform, setPlatform] = useState('ESPN');
  const [scoringType, setScoringType] = useState<'H2H_Categories' | 'H2H_Points'>('H2H_Points');

  // ESPN connection fields
  const [espnLeagueId, setESPNLeagueId] = useState('');
  const [espnSeasonId, setESPNSeasonId] = useState('2025');
  const [espnS2, setESPNS2] = useState('');
  const [espnSWID, setESPNSWID] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Roster settings
  const [rosterSlots, setRosterSlots] = useState(defaultLeagueSettings.rosterSlots);

  // Points per stat
  const [pointsPerStat, setPointsPerStat] = useState(defaultLeagueSettings.pointsPerStat || {});

  // Categories
  const [skaterCategories, setSkaterCategories] = useState({
    G: true, A: true, plusMinus: true, PPP: true,
    SOG: true, HIT: true, BLK: true, PIM: false,
  });

  const [goalieCategories, setGoalieCategories] = useState({
    W: true, SV: true, GAA: true, SV_PCT: true, SO: true,
  });

  // Load ESPN config if available
  useEffect(() => {
    if (espnConfig) {
      setESPNLeagueId(espnConfig.leagueId);
      setESPNSeasonId(espnConfig.seasonId.toString());
      setESPNS2(espnConfig.espnS2 || '');
      setESPNSWID(espnConfig.swid || '');
    }
    if (espnLeagueInfo) {
      setLeagueName(espnLeagueInfo.name);
      setPlatform('ESPN');
    }
  }, [espnConfig, espnLeagueInfo]);

  const handleESPNSync = async () => {
    if (!espnLeagueId) {
      setSyncError('Please enter your League ID');
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      await syncESPNLeague({
        leagueId: espnLeagueId,
        seasonId: parseInt(espnSeasonId), // Defaults to 2025
        espnS2: espnS2 || undefined,
        swid: espnSWID || undefined,
      });
      alert('ESPN league connected successfully! ✅');
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Failed to connect to ESPN league');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSave = () => {
    const settings = {
      leagueName,
      platform,
      scoringType,
      rosterSlots,
      ...(scoringType === 'H2H_Points' ? { pointsPerStat } : {
        skaterCategories: Object.entries(skaterCategories).filter(([_, v]) => v).map(([k]) => k),
        goalieCategories: Object.entries(goalieCategories).filter(([_, v]) => v).map(([k]) => k),
      }),
    };

    // Save to localStorage and context
    localStorage.setItem('benchBossSettings', JSON.stringify(settings));
    setLeagueSettings({
      scoringType,
      rosterSlots,
      ...(scoringType === 'H2H_Points' ? { pointsPerStat } : {
        skaterCategories: Object.entries(skaterCategories).filter(([_, v]) => v).map(([k]) => k) as any,
        goalieCategories: Object.entries(goalieCategories).filter(([_, v]) => v).map(([k]) => k) as any,
      }),
    });
    alert('Settings saved! ✅');
  };

  return (
    <div className="p-8">
      <h2 className="text-3xl font-bold text-slate-100 mb-6">League Settings</h2>

      {/* ESPN Connection */}
      <div className="bg-gradient-to-br from-red-900/30 to-slate-800 rounded-xl shadow-sm border border-red-700/50 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-slate-100">ESPN Fantasy League Connection</h3>
          {espnLeagueInfo && (
            <span className="px-3 py-1 bg-green-600 text-white text-sm font-medium rounded-lg">
              Connected
            </span>
          )}
        </div>

        {espnLeagueInfo && (
          <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-400">League Name:</span>
                <span className="ml-2 text-slate-100 font-medium">{espnLeagueInfo.name}</span>
              </div>
              <div>
                <span className="text-slate-400">Season:</span>
                <span className="ml-2 text-slate-100 font-medium">{espnLeagueInfo.seasonId}</span>
              </div>
              <div>
                <span className="text-slate-400">Teams:</span>
                <span className="ml-2 text-slate-100 font-medium">{espnLeagueInfo.size}</span>
              </div>
              <div>
                <span className="text-slate-400">Scoring:</span>
                <span className="ml-2 text-slate-100 font-medium">{espnLeagueInfo.settings.scoringType}</span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              League ID <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., 123456"
              value={espnLeagueId}
              onChange={(e) => setESPNLeagueId(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 py-2 focus:border-red-500 focus:outline-none"
            />
            <p className="text-xs text-slate-400 mt-1">
              Find this in your ESPN league URL after "leagueId="
            </p>
          </div>

          <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
            <p className="text-sm text-yellow-200 font-medium mb-2">
              For Private Leagues (Optional)
            </p>
            <p className="text-xs text-slate-400 mb-3">
              If your league is private, you'll need to provide your ESPN cookies. Open your browser's developer tools (F12), go to Application → Cookies → espn.com, and copy the values.
            </p>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">espn_s2</label>
                <input
                  type="text"
                  placeholder="Long cookie value starting with..."
                  value={espnS2}
                  onChange={(e) => setESPNS2(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">SWID</label>
                <input
                  type="text"
                  placeholder="{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}"
                  value={espnSWID}
                  onChange={(e) => setESPNSWID(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {syncError && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
              <p className="text-red-200 text-sm">{syncError}</p>
            </div>
          )}

          <button
            onClick={handleESPNSync}
            disabled={isSyncing}
            className="w-full px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed"
          >
            {isSyncing ? 'Connecting...' : espnLeagueInfo ? 'Reconnect ESPN League' : 'Connect ESPN League'}
          </button>
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-6 mb-6">
        <h3 className="text-xl font-bold mb-4">Basic Info</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">League Name</label>
            <input
              type="text"
              value={leagueName}
              onChange={(e) => setLeagueName(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 py-2 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Platform</label>
            <select
              className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 py-2 focus:border-blue-500 focus:outline-none"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
            >
              <option>ESPN</option>
              <option>Yahoo</option>
              <option>Custom</option>
            </select>
          </div>
        </div>
      </div>

      {/* Scoring Type */}
      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-6 mb-6">
        <h3 className="text-xl font-bold mb-4">Scoring Type</h3>
        <div className="space-y-3">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input 
              type="radio" 
              name="scoring" 
              checked={scoringType === 'H2H_Categories'}
              onChange={() => setScoringType('H2H_Categories')}
              className="w-4 h-4 text-blue-600"
            />
            <span className="font-medium">Head-to-Head Categories</span>
          </label>
          <label className="flex items-center space-x-3 cursor-pointer">
            <input 
              type="radio" 
              name="scoring" 
              checked={scoringType === 'H2H_Points'}
              onChange={() => setScoringType('H2H_Points')}
              className="w-4 h-4 text-blue-600"
            />
            <span className="font-medium">Head-to-Head Points</span>
          </label>
        </div>
      </div>

      {/* Points League Settings */}
      {scoringType === 'H2H_Points' && (
        <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-6 mb-6">
          <h3 className="text-xl font-bold mb-4">Points Per Stat</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(pointsPerStat).map(([stat, value]) => (
              <div key={stat}>
                <label className="block text-sm font-medium text-slate-300 mb-2">{stat}</label>
                <input 
                  type="number" 
                  step="0.1"
                  value={value}
                  onChange={(e) => setPointsPerStat({...pointsPerStat, [stat]: parseFloat(e.target.value)})}
                  className="w-full border border-slate-600 rounded-lg px-4 py-2"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category League Settings */}
      {scoringType === 'H2H_Categories' && (
        <>
          <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-6 mb-6">
            <h3 className="text-xl font-bold mb-4">Skater Categories</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(skaterCategories).map(([cat, enabled]) => (
                <label key={cat} className="flex items-center space-x-2">
                  <input 
                    type="checkbox" 
                    checked={enabled}
                    onChange={(e) => setSkaterCategories({...skaterCategories, [cat]: e.target.checked})}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm">{cat}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-6 mb-6">
            <h3 className="text-xl font-bold mb-4">Goalie Categories</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(goalieCategories).map(([cat, enabled]) => (
                <label key={cat} className="flex items-center space-x-2">
                  <input 
                    type="checkbox" 
                    checked={enabled}
                    onChange={(e) => setGoalieCategories({...goalieCategories, [cat]: e.target.checked})}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm">{cat}</span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Roster Settings */}
      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-6 mb-6">
        <h3 className="text-xl font-bold mb-4">Roster Settings</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(rosterSlots).map(([pos, count]) => (
            <div key={pos}>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {pos === 'UTIL' ? 'Utility (UTIL)' : 
                 pos === 'BN' ? 'Bench (BN)' :
                 pos === 'IR' ? 'IR Spots' : pos}
              </label>
              <input 
                type="number" 
                min="0"
                value={count || 0}
                onChange={(e) => setRosterSlots({...rosterSlots, [pos]: parseInt(e.target.value)})}
                className="w-full border border-slate-600 rounded-lg px-4 py-2"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end space-x-3">
        <button className="px-6 py-2 border border-slate-600 rounded-lg font-medium hover:bg-slate-700 transition-colors">
          Cancel
        </button>
        <button 
          onClick={handleSave}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Save Settings
        </button>
      </div>
    </div>
  );
}