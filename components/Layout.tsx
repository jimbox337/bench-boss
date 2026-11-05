'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { signOut, useSession } from '@/lib/AuthContext';
import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  Crosshair,
  LifeBuoy,
  LogOut,
  Plus,
  RefreshCw,
  Repeat2,
  Search,
  ShieldCheck,
  Shirt,
  Swords,
  User,
  Zap,
  Trophy,
} from 'lucide-react';
import BenchBossLogo from './BenchBossLogo';
import { useData } from '@/lib/DataContext';

const navItems = [
  { icon: BarChart3, name: 'Dashboard', path: '/' },
  { icon: CalendarDays, name: 'Scoreboard', path: '/games' },
  { icon: Trophy, name: 'NHL Teams', path: '/nhl-teams' },
  { icon: Shirt, name: 'My Team', path: '/myteam' },
  { icon: Zap, name: 'Lineup', path: '/lineup' },
  { icon: Swords, name: 'Start / Sit', path: '/startsit' },
  { icon: Repeat2, name: 'Trades', path: '/trades' },
  { icon: Crosshair, name: 'Waivers', path: '/waivers' },
  { icon: Search, name: 'Players', path: '/players' },
];

const adminNavItem = { icon: ShieldCheck, name: 'Admin', path: '/admin' };

const publicRoutes = ['/login'];

function getInitial(name?: string | null) {
  return name?.trim().charAt(0).toUpperCase() || 'B';
}

export default function Layout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const { espnConfig, syncESPNLeague } = useData();
  const [username, setUsername] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasTeam, setHasTeam] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamPlatform, setTeamPlatform] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const mobileNavRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rail = mobileNavRef.current;
    const active = rail?.querySelector<HTMLElement>('[aria-current="page"]');
    if (rail && active) rail.scrollLeft = active.offsetLeft - (rail.clientWidth - active.clientWidth) / 2;
  }, [pathname, status]);

  const isLoading = status === 'loading';
  const isAuthenticated = !!session;

  const handleSync = async () => {
    if (!espnConfig || isSyncing) return;

    setIsSyncing(true);
    setSyncStatus('idle');

    try {
      await syncESPNLeague(espnConfig);
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 2200);
    } catch {
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 2200);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      if (!session?.user) {
        setIsAdmin(false);
        return;
      }

      try {
        const [response, teamResponse] = await Promise.all([
          fetch('/api/user/profile'),
          fetch('/api/team'),
        ]);
        const data = await response.json();

        if (data.success) {
          setUsername(data.user.username || '');
          setIsAdmin(data.user.role === 'admin');
        }

        const teamData = await teamResponse.json();
        const team = teamData.team;

        setHasTeam(teamData.success && team !== null);
        if (team) {
          setTeamName(team.name || 'My Team');
          setTeamPlatform(team.platform || 'Custom');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, [session]);

  if (publicRoutes.includes(pathname)) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="flex h-screen fantasy-app-shell items-center justify-center">
        <div className="fantasy-card rounded-pill px-8 py-7 text-center">
          <BenchBossLogo size={54} />
          <p className="mt-4 text-sm font-medium text-accent">Loading Bench Boss</p>
        </div>
      </div>
    );
  }

  const syncLabel =
    isSyncing ? 'Syncing' : syncStatus === 'success' ? 'Synced' : syncStatus === 'error' ? 'Failed' : 'Sync ESPN';
  const visibleNavItems = isAdmin ? [...navItems, adminNavItem] : navItems;

  return (
    <div className="bb-shell h-screen fantasy-app-shell text-ink flex flex-col">
          <header className="bb-topbar flex shrink-0 items-center justify-between">
            <button
              onClick={() => router.push('/')}
              className="bb-masthead-brand flex items-center gap-3"
            >
              <span className="bb-logo-plate"><BenchBossLogo size={48} /></span>
              <span className="text-xl font-semibold text-on-brand">Bench Boss</span>
            </button>

            <nav className="bb-masthead-links hidden md:flex" aria-label="Site navigation">
              <Link href="/">Fantasy hockey</Link>
              <Link href="/players">Player research</Link>
              <Link href="/support">Help center</Link>
            </nav>

            <div className="flex items-center gap-2">
              {espnConfig && (
                <button
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-2 rounded-pill border border-rule bg-paper-2 px-3 py-2 text-xs font-medium text-accent transition-colors hover:bg-paper-2 disabled:opacity-60 lg:hidden"
                >
                  <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  Sync
                </button>
              )}

              {isAuthenticated ? (
                <Link
                  href="/profile"
                  className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-pill bg-paper-2 text-sm font-medium text-ink"
                  aria-label="Profile"
                >
                  {session?.user?.image ? (
                    <img src={session.user.image} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    getInitial(session?.user?.name)
                  )}
                </Link>
              ) : (
                <button
                  onClick={() => router.push('/login')}
                  className="rounded-pill px-4 py-2 fantasy-button text-sm font-medium transition-colors"
                >
                  Sign In
                </button>
              )}
            </div>
          </header>
      <div className="bb-shell-grid grid flex-1 min-h-0 w-full">
        <aside className="bb-sidebar hidden lg:flex min-h-0 flex-col border-r">
          <div className="bb-sidebar-brand">
            <button
              onClick={() => router.push('/')}
              className="flex w-full items-center gap-3 rounded-pill px-2 py-2 text-left transition-colors hover:bg-paper-2"
            >
              <Shirt className="h-5 w-5 text-accent" aria-hidden="true" />
              <span className="leading-tight">
                <span className="bb-wordmark block text-ink">My workspace</span>
                <span className="fantasy-kicker block text-xs font-medium">Fantasy hockey tools</span>
              </span>
            </button>
          </div>

          <div className="bb-team-switch">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted">Active Team</p>
                <p className="mt-1 truncate text-sm font-medium text-ink">{hasTeam ? teamName : 'No team linked'}</p>
                <p className="mt-0.5 text-xs text-accent">{hasTeam ? teamPlatform : 'Connect a league'}</p>
              </div>
              <button
                onClick={() => router.push(hasTeam ? '/myteam' : '/teams/new')}
                className="rounded-pill border border-rule bg-paper-2 p-2 text-accent transition-colors hover:bg-paper-2"
                aria-label={hasTeam ? 'Open team' : 'Add team'}
              >
                {hasTeam ? <ChevronRight className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <nav className="bb-nav flex-1 space-y-1 overflow-y-auto">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(`${item.path}/`));

              return (
                <Link
                  key={item.path}
                  href={item.path}
                  aria-current={isActive ? 'page' : undefined}
                  className="bb-nav-link group flex items-center gap-3 transition-colors"
                >
                  <Icon className={`h-5 w-5 ${isActive ? 'text-accent' : 'text-muted group-hover:text-accent'}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          <div className="bb-sidebar-footer space-y-3 border-t">
            {espnConfig && (
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className={`flex w-full items-center justify-center gap-2 rounded-pill border px-4 py-3 text-sm font-medium transition-colors disabled:opacity-60 ${
                  syncStatus === 'success'
                    ? 'border-rule bg-success/10 text-success'
                    : syncStatus === 'error'
                    ? 'border-rule bg-error/10 text-error'
                    : 'border-rule bg-paper-2 text-accent hover:bg-paper-2'
                }`}
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {syncLabel}
              </button>
            )}

            {isAuthenticated ? (
              <div className="rounded-pill border border-rule bg-paper-2 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-pill bg-paper-2 text-base font-medium text-ink">
                    {session?.user?.image ? (
                      <img src={session.user.image} alt="Profile" className="h-full w-full object-cover" />
                    ) : (
                      getInitial(session?.user?.name)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{session?.user?.name || 'Manager'}</p>
                    <p className="truncate text-xs text-muted">{username ? `@${username}` : session?.user?.email}</p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Link
                    href="/profile"
                    className="flex items-center justify-center rounded-pill bg-paper-2 py-2 text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
                    aria-label="Profile"
                  >
                    <User className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/support"
                    className="flex items-center justify-center rounded-pill bg-paper-2 py-2 text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
                    aria-label="Support"
                  >
                    <LifeBuoy className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="flex items-center justify-center rounded-pill bg-error/10 py-2 text-error transition-colors hover:bg-error/10"
                    aria-label="Sign out"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => router.push('/login')}
                className="w-full rounded-pill px-4 py-3 fantasy-button text-sm font-medium transition-colors"
              >
                Get Started
              </button>
            )}
          </div>
        </aside>

        <div className="flex min-h-0 flex-col">


          <main className="bb-main min-h-0 flex-1 overflow-y-auto fantasy-main pb-24 lg:pb-0">{children}</main>
        </div>
      </div>

      <nav className="bb-mobile-nav fixed z-50 p-2 lg:hidden">
        <div ref={mobileNavRef} className="flex gap-1 overflow-x-auto">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(`${item.path}/`));

            return (
              <Link
                key={item.path}
                href={item.path}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-14 min-w-[64px] flex-col items-center justify-center rounded-pill text-[11px] font-medium transition-colors ${
                  isActive ? 'bg-paper-2 text-accent' : 'text-muted hover:bg-paper-2 hover:text-ink'
                }`}
              >
                <Icon className={`mb-1 h-5 w-5 ${isActive ? 'text-accent' : ''}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
