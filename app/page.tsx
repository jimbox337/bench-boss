'use client';

import { calculateFantasyPoints, defaultLeagueSettings } from '@/lib/calculator';
import { useData } from '@/lib/DataContext';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CountUp, Reveal } from '@/components/ui/reveal';
import NoTeamDashboard from '@/components/NoTeamDashboard';
import {
  Activity,
  BarChart3,
  Bolt,
  Clapperboard,
  Crosshair,
  HeartPulse,
  Medal,
  Repeat2,
  Shirt,
  Trophy,
} from 'lucide-react';

export default function Dashboard() {
  const { projections, isLoading, isLiveData, myTeam } = useData();
  const { data: session } = useSession();
  const router = useRouter();
  const [hasTeam, setHasTeam] = useState<boolean | null>(null);
  const useLegacyOnboarding = process.env.NEXT_PUBLIC_LEGACY_ONBOARDING === 'true';

  useEffect(() => {
    const checkTeam = async () => {
      if (session?.user) {
        try {
          const response = await fetch('/api/team');
          const data = await response.json();
          setHasTeam(data.success && data.team !== null);
        } catch {
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
  if (hasTeam === false && !useLegacyOnboarding) {
    return <NoTeamDashboard onAddTeam={() => router.push('/teams/new')} onBrowsePlayers={() => router.push('/players')} />;
  }

  if (hasTeam === false) {
    return (
      <div className="min-h-screen">
        {/* Hero Section */}
        <div className="px-5 py-8 md:p-10">
          <div className="max-w-6xl mx-auto mb-10 fantasy-card rounded-3xl p-7 md:p-10 overflow-hidden relative">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-yellow-300 to-emerald-400" />
            <div className="grid lg:grid-cols-[1.12fr_0.88fr] gap-8 items-center">
              <div>
                <p className="fantasy-kicker text-xs font-black mb-3">Draft Night Starts Here</p>
                <h1 className="text-4xl md:text-6xl font-black text-white mb-4 leading-tight">
                  Build a fantasy hockey war room.
                </h1>
                <p className="text-lg md:text-xl text-slate-300 mb-8 max-w-2xl">
                  Link your team, scout player value, and make start/sit decisions from a command center built for fantasy hockey managers.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => router.push('/teams/new')}
                    className="px-8 py-4 fantasy-button text-white text-lg font-black rounded-xl transition-all"
                  >
                    Add Your Team
                  </button>
                  <button
                    onClick={() => router.push('/players')}
                    className="px-8 py-4 bg-white/5 hover:bg-white/10 text-cyan-100 text-lg font-bold rounded-xl border border-white/10 transition-all"
                  >
                    Scout Players
                  </button>
                </div>
              </div>

              <div className="relative min-h-72 rounded-2xl border border-cyan-200/20 bg-slate-950/50 p-5 overflow-hidden">
                <div className="absolute inset-4 rounded-[50%] border border-cyan-200/15" />
                <div className="absolute left-1/2 top-0 h-full w-px bg-red-400/35" />
                <div className="absolute inset-x-8 top-1/2 h-px bg-cyan-200/25" />
                <div className="relative grid grid-cols-2 gap-4 h-full">
                  {[
                    ['Roster Score', '92', 'text-cyan-300'],
                    ['Waiver Edge', '+18%', 'text-emerald-300'],
                    ['Trade Heat', 'A-', 'text-yellow-300'],
                    ['Injury Risk', 'Low', 'text-sky-300'],
                  ].map(([label, value, color]) => (
                    <div key={label} className="rounded-2xl bg-black/30 border border-white/10 p-4 flex flex-col justify-between min-h-28">
                      <span className="text-xs text-slate-400 uppercase font-bold">{label}</span>
                      <span className={`text-3xl font-black ${color}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-6xl mx-auto text-center mb-10">
            <p className="fantasy-kicker text-xs font-black mb-3">Manager Toolkit</p>
            <h2 className="text-3xl md:text-4xl font-black text-white">Every decision gets a second opinion.</h2>
          </div>

          {/* Features Grid */}
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="fantasy-card fantasy-card-hover rounded-2xl p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200">
                <Bolt className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">Lineup Optimizer</h3>
              <p className="text-slate-400 text-sm">
                Maximize your weekly points with AI-powered lineup recommendations
              </p>
            </div>

            <div className="fantasy-card fantasy-card-hover rounded-2xl p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-200">
                <Repeat2 className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">Trade Analyzer</h3>
              <p className="text-slate-400 text-sm">
                Evaluate trade proposals with advanced analytics and projections
              </p>
            </div>

            <div className="fantasy-card fantasy-card-hover rounded-2xl p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400/10 text-yellow-200">
                <Crosshair className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">Waiver Targets</h3>
              <p className="text-slate-400 text-sm">
                Discover hidden gems and trending players on the waiver wire
              </p>
            </div>
          </div>

          {/* NHL News Section */}
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-white">League Intel</h2>
              <a
                href="https://www.nhl.com/news"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-300 hover:text-yellow-200 text-sm font-bold"
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
                className="group fantasy-card fantasy-card-hover rounded-2xl overflow-hidden"
              >
                <div className="aspect-video bg-gradient-to-br from-cyan-500/20 to-slate-950 flex items-center justify-center">
                  <Trophy className="h-14 w-14 text-cyan-200" />
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-black text-white mb-2 group-hover:text-cyan-300 transition-colors">
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
                className="group fantasy-card fantasy-card-hover rounded-2xl overflow-hidden"
              >
                <div className="aspect-video bg-gradient-to-br from-violet-500/20 to-slate-950 flex items-center justify-center">
                  <BarChart3 className="h-14 w-14 text-violet-200" />
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-black text-white mb-2 group-hover:text-violet-300 transition-colors">
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
                className="group fantasy-card fantasy-card-hover rounded-2xl overflow-hidden"
              >
                <div className="aspect-video bg-gradient-to-br from-orange-500/20 to-slate-950 flex items-center justify-center">
                  <Clapperboard className="h-14 w-14 text-orange-200" />
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-black text-white mb-2 group-hover:text-orange-300 transition-colors">
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
                className="group fantasy-card fantasy-card-hover rounded-2xl overflow-hidden"
              >
                <div className="aspect-video bg-gradient-to-br from-red-500/20 to-slate-950 flex items-center justify-center">
                  <HeartPulse className="h-14 w-14 text-red-200" />
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-black text-white mb-2 group-hover:text-red-300 transition-colors">
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
                className="group fantasy-card fantasy-card-hover rounded-2xl overflow-hidden"
              >
                <div className="aspect-video bg-gradient-to-br from-emerald-500/20 to-slate-950 flex items-center justify-center">
                  <Repeat2 className="h-14 w-14 text-emerald-200" />
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-black text-white mb-2 group-hover:text-emerald-300 transition-colors">
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
                className="group fantasy-card fantasy-card-hover rounded-2xl overflow-hidden"
              >
                <div className="aspect-video bg-gradient-to-br from-yellow-500/20 to-slate-950 flex items-center justify-center">
                  <Medal className="h-14 w-14 text-yellow-200" />
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-black text-white mb-2 group-hover:text-yellow-300 transition-colors">
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
    <div className="px-5 py-6 md:p-8">
      <Reveal className="mb-7" delay={0.02}>
        <div className="fantasy-card fantasy-card-command rounded-3xl p-6 md:p-8 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-yellow-300 to-emerald-400" />
        <p className="fantasy-kicker text-xs font-black mb-2">Live Bench Command</p>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h2 className="text-4xl md:text-5xl font-black text-white">Dashboard</h2>
            <p className="text-slate-300 mt-2">Track matchup leverage, roster volume, and player form from one fantasy war room.</p>
          </div>
          <button
            onClick={() => router.push('/lineup')}
            className="w-fit px-5 py-3 fantasy-button-gold rounded-xl font-black transition-all"
          >
            Optimize Lineup
          </button>
        </div>
        </div>
      </Reveal>

      {/* Loading Banner */}
      {isLoading && (
        <div className="fantasy-card border-cyan-300/30 rounded-2xl p-4 mb-6">
          <p className="text-sm text-cyan-100">
            <strong>⏳ Loading Live NHL Data...</strong> Fetching current season stats and projections.
          </p>
        </div>
      )}

      {/* Success Banner */}
      {!isLoading && isLiveData && (
        <div className="bg-emerald-500/10 border border-emerald-300/30 rounded-2xl p-4 mb-6 shadow-[0_0_24px_rgba(16,185,129,0.12)]">
          <p className="flex items-start gap-2 text-sm text-emerald-100">
            <Activity className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Live NHL Data Active!</strong> Using real player stats from the current season.
            Projections are based on per-game averages and upcoming schedules.
            </span>
          </p>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Reveal delay={0.06}>
          <div className="fantasy-card fantasy-card-hover fantasy-stat-card p-6 rounded-2xl">
          <p className="text-sm text-slate-400 mb-1 font-bold uppercase">Projected Points</p>
            <CountUp value={totalPoints} decimals={1} className="text-4xl font-black tabular-nums text-cyan-300" />
          <p className="text-xs text-emerald-300 mt-2 font-bold">↑ 12% vs league avg</p>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="fantasy-card fantasy-card-hover fantasy-stat-card p-6 rounded-2xl">
          <p className="text-sm text-slate-400 mb-1 font-bold uppercase">Category Edge</p>
          <p className="text-4xl font-black text-yellow-300">6-3</p>
          <p className="text-xs text-slate-400 mt-2">Favored in 6 of 9 cats</p>
          </div>
        </Reveal>
        <Reveal delay={0.14}>
          <div className="fantasy-card fantasy-card-hover fantasy-stat-card p-6 rounded-2xl">
          <p className="text-sm text-slate-400 mb-1 font-bold uppercase">Games This Week</p>
            <CountUp
              value={myTeam.reduce((sum, p) => {
              const proj = projections.find(pr => pr.playerId === p.id);
              return sum + (proj?.gamesPlayed || 0);
              }, 0)}
              className="text-4xl font-black tabular-nums text-emerald-300"
            />
          <p className="text-xs text-slate-400 mt-2">{myTeam.length} active roster spots</p>
          </div>
        </Reveal>
      </div>

      {/* My Team Roster */}
      {myTeam.length > 0 && (
        <Reveal className="mb-8" delay={0.08}>
          <div className="fantasy-card rounded-3xl p-5 md:p-6">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <p className="fantasy-kicker text-xs font-black mb-1">Roster Board</p>
              <h3 className="text-2xl font-black text-white">My Roster</h3>
            </div>
            <button
              onClick={() => router.push('/myteam')}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-sm font-bold text-cyan-100 transition-all"
            >
              Full Roster
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full ice-table">
              <thead className="border-b border-white/10">
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
              <tbody className="divide-y divide-white/10">
                {myTeam.slice(0, 10).map((player) => (
                  <tr key={player.id} className="transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-100">
                      {player.name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300">
                      {player.nhlTeam}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300">
                      {player.positions?.join('/') ?? ''}
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
              Showing 10 of {myTeam.length} players. <a href="/myteam" className="text-cyan-300 hover:text-yellow-200 font-bold">View all</a>
            </p>
          )}
          </div>
        </Reveal>
      )}

      {/* Empty State */}
      {myTeam.length === 0 && !isLoading && (
        <div className="fantasy-card rounded-3xl p-12 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-400/10 text-cyan-200">
            <Shirt className="h-8 w-8" />
          </div>
          <h3 className="text-2xl font-black text-white mb-2">No Team Yet</h3>
          <p className="text-slate-400 mb-6">Add players to your roster to get started</p>
          <button
            onClick={() => {
              if (!session) {
                router.push('/login');
              } else {
                router.push('/myteam');
              }
            }}
            className="inline-block px-6 py-3 fantasy-button text-white rounded-xl font-black transition-all"
          >
            Build My Team
          </button>
        </div>
      )}
    </div>
  );
}
