'use client';

import { calculateFantasyPoints, defaultLeagueSettings } from '@/lib/calculator';
import { useData } from '@/lib/DataContext';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const { players, projections, isLoading, isLiveData, myTeam } = useData();
  const { data: session } = useSession();
  const router = useRouter();
  const [hasTeam, setHasTeam] = useState<boolean | null>(null);

  useEffect(() => {
    const checkTeam = async () => {
      if (session?.user) {
        try {
          const response = await fetch('/api/team');
          const data = await response.json();
          setHasTeam(data.success && data.team !== null);
        } catch (error) {
          setHasTeam(false);
        }
      } else {
        setHasTeam(false);
      }
    };

    checkTeam();
  }, [session]);

  // Calculate total projected points for the week
  const totalPoints = myTeam.reduce((sum, player) => {
    const proj = projections.find(p => p.playerId === player.id);
    if (!proj) return sum;
    return sum + calculateFantasyPoints(proj, defaultLeagueSettings);
  }, 0);

  // Show welcome page if no team is linked
  if (hasTeam === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        {/* Hero Section */}
        <div className="p-8 pt-12">
          <div className="max-w-6xl mx-auto text-center mb-12">
            <div className="text-6xl mb-4">🏒</div>
            <h1 className="text-5xl font-bold text-slate-100 mb-4">Welcome to Bench Boss</h1>
            <p className="text-xl text-slate-400 mb-8">
              Your ultimate fantasy hockey companion. Get started by linking your team.
            </p>
            <button
              onClick={() => router.push('/teams/new')}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold rounded-xl transition-colors shadow-lg hover:shadow-xl"
            >
              Add Your Team
            </button>
          </div>

          {/* Features Grid */}
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-blue-600 transition-colors">
              <div className="text-4xl mb-3">⚡</div>
              <h3 className="text-xl font-bold text-slate-100 mb-2">Lineup Optimizer</h3>
              <p className="text-slate-400 text-sm">
                Maximize your weekly points with AI-powered lineup recommendations
              </p>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-purple-600 transition-colors">
              <div className="text-4xl mb-3">🔄</div>
              <h3 className="text-xl font-bold text-slate-100 mb-2">Trade Analyzer</h3>
              <p className="text-slate-400 text-sm">
                Evaluate trade proposals with advanced analytics and projections
              </p>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-green-600 transition-colors">
              <div className="text-4xl mb-3">🎯</div>
              <h3 className="text-xl font-bold text-slate-100 mb-2">Waiver Targets</h3>
              <p className="text-slate-400 text-sm">
                Discover hidden gems and trending players on the waiver wire
              </p>
            </div>
          </div>

          {/* NHL News Section */}
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-100">Latest NHL News</h2>
              <a
                href="https://www.nhl.com/news"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                View More →
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* News Card 1 */}
              <a
                href="https://www.nhl.com"
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-slate-800 border border-slate-700 rounded-xl overflow-hidden hover:border-blue-600 transition-all"
              >
                <div className="aspect-video bg-gradient-to-br from-blue-900/30 to-slate-700 flex items-center justify-center">
                  <span className="text-6xl">🏆</span>
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-bold text-slate-100 mb-2 group-hover:text-blue-400 transition-colors">
                    NHL Standings Update
                  </h3>
                  <p className="text-sm text-slate-400 mb-3">
                    Check out the latest standings and playoff race updates from around the league
                  </p>
                  <span className="text-xs text-slate-500">NHL.com</span>
                </div>
              </a>

              {/* News Card 2 */}
              <a
                href="https://www.nhl.com/stats"
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-slate-800 border border-slate-700 rounded-xl overflow-hidden hover:border-purple-600 transition-all"
              >
                <div className="aspect-video bg-gradient-to-br from-purple-900/30 to-slate-700 flex items-center justify-center">
                  <span className="text-6xl">📊</span>
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-bold text-slate-100 mb-2 group-hover:text-purple-400 transition-colors">
                    Player Stats & Leaders
                  </h3>
                  <p className="text-sm text-slate-400 mb-3">
                    View the top scorers, goalies, and statistical leaders across the NHL
                  </p>
                  <span className="text-xs text-slate-500">NHL Stats</span>
                </div>
              </a>

              {/* News Card 3 */}
              <a
                href="https://www.nhl.com/video"
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-slate-800 border border-slate-700 rounded-xl overflow-hidden hover:border-orange-600 transition-all"
              >
                <div className="aspect-video bg-gradient-to-br from-orange-900/30 to-slate-700 flex items-center justify-center">
                  <span className="text-6xl">🎥</span>
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-bold text-slate-100 mb-2 group-hover:text-orange-400 transition-colors">
                    Game Highlights
                  </h3>
                  <p className="text-sm text-slate-400 mb-3">
                    Watch the best goals, saves, and moments from recent NHL games
                  </p>
                  <span className="text-xs text-slate-500">NHL Video</span>
                </div>
              </a>

              {/* News Card 4 */}
              <a
                href="https://www.nhl.com/news/injuries"
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-slate-800 border border-slate-700 rounded-xl overflow-hidden hover:border-red-600 transition-all"
              >
                <div className="aspect-video bg-gradient-to-br from-red-900/30 to-slate-700 flex items-center justify-center">
                  <span className="text-6xl">🏥</span>
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-bold text-slate-100 mb-2 group-hover:text-red-400 transition-colors">
                    Injury Reports
                  </h3>
                  <p className="text-sm text-slate-400 mb-3">
                    Stay updated on player injuries and their fantasy hockey impact
                  </p>
                  <span className="text-xs text-slate-500">NHL Injuries</span>
                </div>
              </a>

              {/* News Card 5 */}
              <a
                href="https://www.nhl.com/news/trades"
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-slate-800 border border-slate-700 rounded-xl overflow-hidden hover:border-green-600 transition-all"
              >
                <div className="aspect-video bg-gradient-to-br from-green-900/30 to-slate-700 flex items-center justify-center">
                  <span className="text-6xl">🔄</span>
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-bold text-slate-100 mb-2 group-hover:text-green-400 transition-colors">
                    Trade Deadline News
                  </h3>
                  <p className="text-sm text-slate-400 mb-3">
                    Follow the latest trades, rumors, and roster moves around the NHL
                  </p>
                  <span className="text-xs text-slate-500">NHL Trades</span>
                </div>
              </a>

              {/* News Card 6 */}
              <a
                href="https://www.nhl.com/stanley-cup-playoffs"
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-slate-800 border border-slate-700 rounded-xl overflow-hidden hover:border-yellow-600 transition-all"
              >
                <div className="aspect-video bg-gradient-to-br from-yellow-900/30 to-slate-700 flex items-center justify-center">
                  <span className="text-6xl">🥇</span>
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-bold text-slate-100 mb-2 group-hover:text-yellow-400 transition-colors">
                    Playoff Picture
                  </h3>
                  <p className="text-sm text-slate-400 mb-3">
                    Track the playoff race and postseason matchups as they develop
                  </p>
                  <span className="text-xs text-slate-500">NHL Playoffs</span>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
