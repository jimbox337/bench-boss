'use client';

import { useState } from 'react';
import { defaultLeagueSettings } from '@/lib/calculator';

export default function Settings() {
  const [leagueName, setLeagueName] = useState('My League');
  const [platform, setPlatform] = useState('Yahoo');
  const [scoringType, setScoringType] = useState<'H2H_Categories' | 'H2H_Points'>('H2H_Points');

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
    
    // Save to localStorage
    localStorage.setItem('benchBossSettings', JSON.stringify(settings));
    alert('Settings saved! ✅');
  };

  return (
    <div className="p-8">
      <h2 className="text-3xl font-bold text-slate-100 mb-6">League Settings</h2>

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
              className="w-full border border-slate-600 rounded-lg px-4 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Platform</label>
            <select 
              className="w-full border border-slate-600 rounded-lg px-4 py-2"
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

      {/* Import Players */}
      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-6 mb-6">
        <h3 className="text-xl font-bold mb-4">Import Players</h3>
        <p className="text-sm text-slate-400 mb-4">Paste your roster and free agents below (format: Name, Team, Position)</p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-2">My Team Roster</label>
          <textarea
            className="w-full border border-slate-600 rounded-lg px-4 py-2 font-mono text-sm"
            rows={6}
            placeholder="Connor McDavid, EDM, C&#10;Nikita Kucherov, TBL, RW&#10;Nathan MacKinnon, COL, C&#10;..."
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-2">Free Agents Available</label>
          <textarea
            className="w-full border border-slate-600 rounded-lg px-4 py-2 font-mono text-sm"
            rows={6}
            placeholder="Troy Terry, ANA, RW&#10;Martin Necas, CAR, C/RW&#10;..."
          />
        </div>

        <button className="bg-gray-700 text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors">
          Import Players
        </button>
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