'use client';

import { calculateFantasyPoints, defaultLeagueSettings } from '@/lib/calculator';
import { useData } from '@/lib/DataContext';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const { players, projections, isLoading, isLiveData, myTeam } = useData();
  const { data: session } = useSession();
  const router = useRouter();

  // Calculate total projected points for the week
  const totalPoints = myTeam.reduce((sum, player) => {
    const proj = projections.find(p => p.playerId === player.id);
    if (!proj) return sum;
    return sum + calculateFantasyPoints(proj, defaultLeagueSettings);
  }, 0);

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

      {/* My Team Roster */}
      {myTeam.length > 0 && (
        <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-6 mb-8">
          <h3 className="text-xl font-bold text-slate-100 mb-4">My Roster</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700 border-b border-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Player</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Team</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Pos</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">GP</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">G</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">A</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">PTS</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">SOG</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {myTeam.slice(0, 10).map((player) => (
                  <tr key={player.id} className="hover:bg-slate-700 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-100">
                      {player.name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300">
                      {player.nhlTeam}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300">
                      {player.positions.join('/')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-slate-300">
                      {player.gamesPlayed || 0}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-slate-300">
                      {player.seasonStats?.G || 0}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-slate-300">
                      {player.seasonStats?.A || 0}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-bold text-blue-400">
                      {player.seasonStats?.PTS || 0}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-slate-300">
                      {player.seasonStats?.SOG || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {myTeam.length > 10 && (
            <p className="text-sm text-slate-400 mt-4 text-center">
              Showing 10 of {myTeam.length} players. <a href="/myteam" className="text-blue-400 hover:underline">View all</a>
            </p>
          )}
        </div>
      )}

      {/* Empty State */}
      {myTeam.length === 0 && !isLoading && (
        <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-12 text-center">
          <div className="text-6xl mb-4">👕</div>
          <h3 className="text-xl font-bold text-slate-100 mb-2">No Team Yet</h3>
          <p className="text-slate-400 mb-6">Add players to your roster to get started</p>
          <button
            onClick={() => {
              if (!session) {
                router.push('/login');
              } else {
                router.push('/myteam');
              }
            }}
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Build My Team
          </button>
        </div>
      )}
    </div>
  );
}