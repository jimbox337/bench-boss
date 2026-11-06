'use client';

import { calculateFantasyPoints, defaultLeagueSettings } from '@/lib/calculator';
import { useData } from '@/lib/DataContext';
import { useSession } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import PlayerLeaders from '@/components/PlayerLeaders';
import NhlNewsTicker from '@/components/NhlNewsTicker';
import NoTeamDashboard from '@/components/NoTeamDashboard';
import FeaturedGame from '@/components/gamecenter/FeaturedGame';
import { PlayerLink } from '@/components/player/PlayerCardProvider';
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
    return <NoTeamDashboard onAddTeam={() => router.push('/myteam')} onBrowsePlayers={() => router.push('/players')} />;
  }

  if (hasTeam === false) {
    return (
      <div className="min-h-screen">
        {/* Hero Section */}
        <div className="px-5 py-8 md:p-10">
          <div className="max-w-6xl mx-auto mb-10 fantasy-card rounded-none p-7 md:p-10 overflow-hidden relative">

            <div className="grid lg:grid-cols-[1.12fr_0.88fr] gap-8 items-center">
              <div>
                <h1 className="text-4xl md:text-6xl font-medium text-ink mb-4 leading-tight">
                  Build a fantasy hockey war room.
                </h1>
                <p className="text-lg md:text-xl text-ink-2 mb-8 max-w-2xl">
                  Link your team, scout player value, and make start/sit decisions from a command center built for fantasy hockey managers.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => router.push('/teams/new')}
                    className="px-8 py-4 fantasy-button text-lg font-medium rounded-none transition-colors"
                  >
                    Add Your Team
                  </button>
                  <button
                    onClick={() => router.push('/players')}
                    className="px-8 py-4 bg-paper-2 hover:bg-paper-2 text-ink text-lg font-medium rounded-none border border-rule transition-colors"
                  >
                    Scout Players
                  </button>
                </div>
              </div>

              <div className="relative min-h-72 rounded-none border border-rule bg-paper-2 p-5 overflow-hidden">
                <div className="absolute inset-4 rounded-[50%] border border-rule" />
                <div className="absolute left-1/2 top-0 h-full w-px bg-error/10" />
                <div className="absolute inset-x-8 top-1/2 h-px bg-paper-2" />
                <div className="relative grid grid-cols-2 gap-4 h-full">
                  {[
                    ['Example roster score', '92', 'text-ink'],
                    ['Example waiver edge', '+18%', 'text-success'],
                    ['Example trade rating', 'A-', 'text-ink'],
                    ['Example injury risk', 'Low', 'text-accent-2'],
                  ].map(([label, value, color]) => (
                    <div key={label} className="rounded-none bg-paper-3 border border-rule p-4 flex flex-col justify-between min-h-28">
                      <span className="text-xs text-muted font-medium">{label}</span>
                      <span className={`text-3xl font-medium ${color}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-6xl mx-auto text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-medium text-ink">Every decision gets a second opinion.</h2>
          </div>

          {/* Features Grid */}
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="fantasy-card fantasy-card-hover rounded-none p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-none bg-paper-2 text-ink">
                <Bolt className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-medium text-ink mb-2">Lineup Optimizer</h3>
              <p className="text-muted text-sm">
                Maximize your weekly points with data-driven lineup recommendations
              </p>
            </div>

            <div className="fantasy-card fantasy-card-hover rounded-none p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-none bg-success/10 text-success">
                <Repeat2 className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-medium text-ink mb-2">Trade Analyzer</h3>
              <p className="text-muted text-sm">
                Evaluate trade proposals with advanced analytics and projections
              </p>
            </div>

            <div className="fantasy-card fantasy-card-hover rounded-none p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-none bg-paper-2 text-ink">
                <Crosshair className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-medium text-ink mb-2">Waiver Targets</h3>
              <p className="text-muted text-sm">
                Discover hidden gems and trending players on the waiver wire
              </p>
            </div>
          </div>

          {/* NHL News Section */}
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-medium text-ink">League Intel</h2>
              <a
                href="https://www.nhl.com/news"
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink hover:text-ink text-sm font-medium"
              >
                View More
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* News Card 1 */}
              <a
                href="https://www.nhl.com"
                target="_blank"
                rel="noopener noreferrer"
                className="group fantasy-card fantasy-card-hover rounded-none overflow-hidden"
              >
                <div className="aspect-video bg-paper-3  flex items-center justify-center">
                  <Trophy className="h-14 w-14 text-ink" />
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-medium text-ink mb-2 group-hover:text-ink transition-colors">
                    NHL Standings Update
                  </h3>
                  <p className="text-sm text-muted mb-3">
                    Check out the latest standings and playoff race updates from around the league
                  </p>
                  <span className="text-xs text-muted">NHL.com</span>
                </div>
              </a>

              {/* News Card 2 */}
              <a
                href="https://www.nhl.com/stats"
                target="_blank"
                rel="noopener noreferrer"
                className="group fantasy-card fantasy-card-hover rounded-none overflow-hidden"
              >
                <div className="aspect-video bg-paper-3  flex items-center justify-center">
                  <BarChart3 className="h-14 w-14 text-accent" />
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-medium text-ink mb-2 group-hover:text-ink transition-colors">
                    Player Stats & Leaders
                  </h3>
                  <p className="text-sm text-muted mb-3">
                    View the top scorers, goalies, and statistical leaders across the NHL
                  </p>
                  <span className="text-xs text-muted">NHL Stats</span>
                </div>
              </a>

              {/* News Card 3 */}
              <a
                href="https://www.nhl.com/video"
                target="_blank"
                rel="noopener noreferrer"
                className="group fantasy-card fantasy-card-hover rounded-none overflow-hidden"
              >
                <div className="aspect-video bg-paper-3  flex items-center justify-center">
                  <Clapperboard className="h-14 w-14 text-accent" />
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-medium text-ink mb-2 group-hover:text-ink transition-colors">
                    Game Highlights
                  </h3>
                  <p className="text-sm text-muted mb-3">
                    Watch the best goals, saves, and moments from recent NHL games
                  </p>
                  <span className="text-xs text-muted">NHL Video</span>
                </div>
              </a>

              {/* News Card 4 */}
              <a
                href="https://www.nhl.com/news/injuries"
                target="_blank"
                rel="noopener noreferrer"
                className="group fantasy-card fantasy-card-hover rounded-none overflow-hidden"
              >
                <div className="aspect-video bg-paper-3  flex items-center justify-center">
                  <HeartPulse className="h-14 w-14 text-error" />
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-medium text-ink mb-2 group-hover:text-error transition-colors">
                    Injury Reports
                  </h3>
                  <p className="text-sm text-muted mb-3">
                    Stay updated on player injuries and their fantasy hockey impact
                  </p>
                  <span className="text-xs text-muted">NHL Injuries</span>
                </div>
              </a>

              {/* News Card 5 */}
              <a
                href="https://www.nhl.com/news/trades"
                target="_blank"
                rel="noopener noreferrer"
                className="group fantasy-card fantasy-card-hover rounded-none overflow-hidden"
              >
                <div className="aspect-video bg-paper-3  flex items-center justify-center">
                  <Repeat2 className="h-14 w-14 text-success" />
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-medium text-ink mb-2 group-hover:text-success transition-colors">
                    Trade Deadline News
                  </h3>
                  <p className="text-sm text-muted mb-3">
                    Follow the latest trades, rumors, and roster moves around the NHL
                  </p>
                  <span className="text-xs text-muted">NHL Trades</span>
                </div>
              </a>

              {/* News Card 6 */}
              <a
                href="https://www.nhl.com/stanley-cup-playoffs"
                target="_blank"
                rel="noopener noreferrer"
                className="group fantasy-card fantasy-card-hover rounded-none overflow-hidden"
              >
                <div className="aspect-video bg-paper-3  flex items-center justify-center">
                  <Medal className="h-14 w-14 text-ink" />
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-medium text-ink mb-2 group-hover:text-ink transition-colors">
                    Playoff Picture
                  </h3>
                  <p className="text-sm text-muted mb-3">
                    Track the playoff race and postseason matchups as they develop
                  </p>
                  <span className="text-xs text-muted">NHL Playoffs</span>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bb-page bb-dashboard">
      <header className="bb-page-header">
        <div><h1>My dashboard</h1><p>Your roster, weekly projections, and player research.</p></div>
        <button onClick={() => router.push('/lineup')} className="bb-button">Optimize Lineup</button>
      </header>
      <FeaturedGame />

      {isLoading && (
        <div className="mb-5 flex items-center gap-2 text-sm text-muted" role="status">
          <Activity className="h-4 w-4 shrink-0" aria-hidden="true" />
          Loading NHL stats and projections…
        </div>
      )}
      {!isLoading && isLiveData && (
        <div className="mb-5 flex items-start gap-2 text-xs text-muted">
          <Activity className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
          <p>NHL stats connected. Projections use per-game averages and upcoming schedules.</p>
        </div>
      )}

      <div className="bb-dashboard-layout grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <section className="bb-panel bb-dashboard-summary overflow-hidden" aria-label="Roster summary">
            <div className="grid grid-cols-1 divide-y divide-rule sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="px-5 py-5">
                <p className="text-xs font-medium text-muted">Projected points</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-ink">{isLoading ? '—' : totalPoints.toFixed(1)}</p>
                <p className="mt-1 text-xs text-muted">Weekly roster projection</p>
              </div>
              <div className="px-5 py-5">
                <p className="text-xs font-medium text-muted">Players on roster</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-ink">{myTeam.length}</p>
                <p className="mt-1 text-xs text-muted">{myTeam.filter((player) => player.isGoalie).length} goalies / {myTeam.filter((player) => !player.isGoalie).length} skaters</p>
              </div>
              <div className="px-5 py-5">
                <p className="text-xs font-medium text-muted">Games this week</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-ink">{isLoading ? '—' : myTeam.reduce((sum, player) => sum + (projections.find((projection) => projection.playerId === player.id)?.gamesPlayed || 0), 0)}</p>
                <p className="mt-1 text-xs text-muted">Across your roster</p>
              </div>
            </div>
          </section>

          {myTeam.length > 0 && (
            <section className="bb-panel bb-dashboard-roster overflow-hidden" aria-labelledby="my-roster-title">
              <div className="bb-dashboard-panel-heading flex flex-wrap items-center justify-between gap-3 border-b border-rule px-5 py-3">
                <h2 id="my-roster-title" className="text-lg">My roster</h2>
                <button onClick={() => router.push('/myteam')} className="bb-button-secondary text-sm">Full Roster</button>
              </div>
              <p className="px-5 pt-3 text-xs text-muted md:hidden">Swipe across the table for all stats.</p>
              <div className="overflow-x-auto">
                <table className="bb-table w-full">
                  <thead><tr>
                    <th className="px-4 py-3 text-left">Player</th>
                    <th className="px-4 py-3 text-right">PTS</th>
                    <th className="px-4 py-3 text-left">Team</th>
                    <th className="px-4 py-3 text-left">Pos</th>
                    <th className="px-4 py-3 text-right">GP</th>
                    <th className="px-4 py-3 text-right">G</th>
                    <th className="px-4 py-3 text-right">A</th>
                    <th className="px-4 py-3 text-right">SOG</th>
                  </tr></thead>
                  <tbody className="divide-y divide-rule">
                    {myTeam.slice(0, 10).map((player) => (
                      <tr key={player.id}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-ink"><PlayerLink id={player.id} className="bb-player-link">{player.name}</PlayerLink></td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-semibold tabular-nums text-accent">{player.seasonStats?.PTS || 0}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-ink-2">{player.nhlTeam}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-ink-2">{player.positions?.join('/') ?? ''}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm tabular-nums text-ink-2">{player.gamesPlayed || 0}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm tabular-nums text-ink-2">{player.seasonStats?.G || 0}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm tabular-nums text-ink-2">{player.seasonStats?.A || 0}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm tabular-nums text-ink-2">{player.seasonStats?.SOG || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {myTeam.length > 10 && (
                <p className="border-t border-rule px-5 py-4 text-xs text-muted">Showing 10 of {myTeam.length} players. <a href="/myteam" className="font-semibold text-accent hover:underline">View all</a></p>
              )}
            </section>
          )}

          {myTeam.length === 0 && !isLoading && (
            <section className="bb-panel px-6 py-8">
              <Shirt className="mb-4 h-7 w-7 text-accent" aria-hidden="true" />
              <h2 className="text-xl">No players on your roster</h2>
              <p className="mt-2 text-sm text-muted">Add players to your roster to get started.</p>
              <button
                onClick={() => {
                  if (!session) { router.push('/login'); }
                  else { router.push('/myteam'); }
                }}
                className="bb-button mt-5"
              >Build My Team</button>
            </section>
          )}

          <section className="bb-panel overflow-hidden" aria-labelledby="next-move-title">
            <div className="bb-dashboard-panel-heading border-b border-rule px-5 py-4"><h2 id="next-move-title" className="text-lg">Plan your next move</h2></div>
            <div className="grid grid-cols-1 divide-y divide-rule sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <a href="/startsit" className="px-5 py-5 hover:bg-paper-3"><h3 className="text-sm text-accent">Start / sit</h3><p className="mt-2 text-xs leading-5 text-muted">Compare two players before setting your lineup.</p></a>
              <a href="/waivers" className="px-5 py-5 hover:bg-paper-3"><h3 className="text-sm text-accent">Waiver targets</h3><p className="mt-2 text-xs leading-5 text-muted">Review the available player pool.</p></a>
              <a href="/trades" className="px-5 py-5 hover:bg-paper-3"><h3 className="text-sm text-accent">Trade analyzer</h3><p className="mt-2 text-xs leading-5 text-muted">Compare both sides of a roster move.</p></a>
            </div>
          </section>
        </div>
        <aside className="min-w-0 space-y-6" aria-label="Player research"><PlayerLeaders /><NhlNewsTicker /></aside>
      </div>
    </div>
  );
}
