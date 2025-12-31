'use client';

import { myTeam } from '@/lib/mockdata';
import { calculateFantasyPoints, defaultLeagueSettings } from '@/lib/calculator';
import { useData } from '@/lib/DataContext';

export default function Dashboard() {
  const { players, projections, isLoading, isLiveData } = useData();

  // Calculate total projected points for the week
  const totalPoints = myTeam.reduce((sum, player) => {
    const proj = projections.find(p => p.playerId === player.id);
    if (!proj) return sum;
    return sum + calculateFantasyPoints(proj, defaultLeagueSettings);
  }, 0);

  const categoryStrengths = [
    { name: 'Goals (G)', strength: 75, status: 'Strong' },
    { name: 'Assists (A)', strength: 68, status: 'Strong' },
    { name: 'Power Play Points (PPP)', strength: 50, status: 'Average' },
    { name: 'Shots on Goal (SOG)', strength: 35, status: 'Weak' },
    { name: 'Hits (HIT)', strength: 32, status: 'Weak' },
  ];

  return (
    <div className="p-8">
      <h2 className="text-3xl font-bold text-slate-100 mb-6">Dashboard</h2>

      {/* Loading Banner */}
      {isLoading && (
        <div className="bg-blue-900/30 border border-blue-700 rounded-xl p-4 mb-6">
          <p className="text-sm text-blue-200">
            <strong>⏳ Loading Live NHL Data...</strong> Fetching current season stats and projections.
          </p>
        </div>
      )}

      {/* Success Banner */}
      {!isLoading && isLiveData && (
        <div className="bg-green-900/30 border border-green-700 rounded-xl p-4 mb-6">
          <p className="text-sm text-green-200">
            <strong>🏒 Live NHL Data Active!</strong> Using real player stats from the current season.
            Projections are based on per-game averages and upcoming schedules.
          </p>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700 hover:border-slate-600 transition-all">
          <p className="text-sm text-slate-400 mb-1">Projected Points (This Week)</p>
          <p className="text-3xl font-bold text-blue-400">{totalPoints.toFixed(1)}</p>
          <p className="text-xs text-green-400 mt-2">↑ 12% vs league avg</p>
        </div>
        <div className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700 hover:border-slate-600 transition-all">
          <p className="text-sm text-slate-400 mb-1">Category Win Probability</p>
          <p className="text-3xl font-bold text-purple-400">6-3</p>
          <p className="text-xs text-slate-400 mt-2">Favored in 6 of 9 cats</p>
        </div>
        <div className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700 hover:border-slate-600 transition-all">
          <p className="text-sm text-slate-400 mb-1">Games This Week</p>
          <p className="text-3xl font-bold text-orange-400">
            {myTeam.reduce((sum, p) => {
              const proj = projections.find(pr => pr.playerId === p.id);
              return sum + (proj?.gamesPlayed || 0);
            }, 0)}
          </p>
          <p className="text-xs text-slate-400 mt-2">{myTeam.length} active roster spots</p>
        </div>
      </div>

      {/* Team Strengths */}
      <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-6 mb-8">
        <h3 className="text-xl font-bold text-slate-100 mb-4">Category Outlook</h3>
        <div className="space-y-3">
          {categoryStrengths.map((cat) => (
            <div key={cat.name}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-slate-300">{cat.name}</span>
                <span className={
                  cat.status === 'Strong' ? 'text-green-400' :
                  cat.status === 'Weak' ? 'text-red-400' : 'text-yellow-400'
                }>
                  {cat.status} {cat.status === 'Strong' ? '✓' : cat.status === 'Weak' ? '✗' : '~'}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    cat.status === 'Strong' ? 'bg-green-500' :
                    cat.status === 'Weak' ? 'bg-red-500' : 'bg-yellow-500'
                  }`}
                  style={{ width: `${cat.strength}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-blue-900/30 border border-blue-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-blue-200 mb-3">💡 Quick Recommendations</h3>
        <ul className="space-y-2 text-sm text-slate-300">
          <li>• <strong className="text-blue-300">Waiver Priority:</strong> Pick up Troy Terry (ANA) - Strong SOG/HIT contributor</li>
          <li>• <strong className="text-blue-300">Lineup Alert:</strong> Bench Mika Zibanejad tonight (vs tough defense)</li>
          <li>• <strong className="text-blue-300">Stream Target:</strong> Martin Necas has 4 games this week</li>
        </ul>
      </div>
    </div>
  );
}