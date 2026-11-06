'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  BarChart3, CalendarDays, ChevronDown, Home, LifeBuoy, LogOut, Plus, RefreshCw, ShieldCheck,
  Shirt, Trophy, User, Wrench, X, Zap,
} from 'lucide-react';
import { signOut, useSession } from '@/lib/AuthContext';
import { useData } from '@/lib/DataContext';
import BenchBossLogo from './BenchBossLogo';
import ScoreStrip from './shell/ScoreStrip';
import AlertsMenu from './shell/AlertsMenu';
import SearchBar from './shell/CommandSearch';
import { platformLabel } from '@/lib/teamSetup';

const TOOL_PATHS = ['/startsit', '/trades', '/waivers'];

const railItems = [
  { icon: Home, name: 'Home', path: '/', match: ['/'] },
  { icon: CalendarDays, name: 'Scores', path: '/games', match: ['/games'] },
  { icon: Zap, name: 'Lineup', path: '/lineup', match: ['/lineup'] },
  { icon: BarChart3, name: 'Rankings', path: '/players', match: ['/players'] },
  { icon: Wrench, name: 'Tools', path: '/startsit', match: TOOL_PATHS },
  { icon: Trophy, name: 'Teams', path: '/nhl-teams', match: ['/nhl-teams'] },
  { icon: Shirt, name: 'My team', path: '/myteam', match: ['/myteam', '/teams'] },
];
const mobileItems = railItems.filter(item => ['Home', 'Scores', 'Lineup', 'Tools', 'Teams'].includes(item.name));
const toolTabs = [
  { name: 'Start / Sit', path: '/startsit' },
  { name: 'Trade Analyzer', path: '/trades' },
  { name: 'Waiver Wire', path: '/waivers' },
];

const publicRoutes = ['/login'];
const BANNER_KEY = 'benchBossConnectBannerDismissed';

function isActive(pathname: string, match: string[]) {
  return match.some(path => (path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`)));
}

function getInitial(name?: string | null) {
  return name?.trim().charAt(0).toUpperCase() || 'B';
}

// Banner dismissal lives in localStorage; read it without a set-state-in-effect.
function subscribeStorage(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener('bb-banner', callback);
  return () => { window.removeEventListener('storage', callback); window.removeEventListener('bb-banner', callback); };
}
const readBannerDismissed = () => { try { return localStorage.getItem(BANNER_KEY) === '1'; } catch { return false; } };

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
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const bannerDismissed = useSyncExternalStore(subscribeStorage, readBannerDismissed, () => true);


  const isLoading = status === 'loading';
  const isAuthenticated = !!session;

  useEffect(() => {
    if (!profileOpen) return;
    const onDown = (event: MouseEvent) => { if (!profileRef.current?.contains(event.target as Node)) setProfileOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setProfileOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [profileOpen]);

  const handleSync = async () => {
    if (!espnConfig || isSyncing) return;
    setIsSyncing(true);
    setSyncStatus('idle');
    try {
      await syncESPNLeague(espnConfig);
      setSyncStatus('success');
    } catch {
      setSyncStatus('error');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus('idle'), 2200);
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      if (!session?.user) {
        setIsAdmin(false);
        return;
      }
      try {
        const [response, teamResponse] = await Promise.all([fetch('/api/user/profile'), fetch('/api/team')]);
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
          setTeamPlatform(platformLabel(team.platform));
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };
    fetchUserData();
  }, [session]);

  if (publicRoutes.includes(pathname)) return <>{children}</>;

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

  const syncLabel = isSyncing ? 'Syncing' : syncStatus === 'success' ? 'Synced' : syncStatus === 'error' ? 'Sync failed' : 'Sync ESPN';
  const showBanner = !hasTeam && !espnConfig && !bannerDismissed;
  const inTools = isActive(pathname, TOOL_PATHS);
  const dismissBanner = () => { try { localStorage.setItem(BANNER_KEY, '1'); } catch { /* ignore */ } window.dispatchEvent(new Event('bb-banner')); };

  return (
    <div className="bb-app fantasy-app-shell text-ink">
      <aside className="bb-rail" aria-label="Main">
        <Link href="/" className="bb-rail-logo" aria-label="Bench Boss home"><BenchBossLogo size={40} /></Link>
        <nav className="bb-rail-nav">
          {railItems.map(item => {
            const Icon = item.icon;
            const active = isActive(pathname, item.match);
            return (
              <Link key={item.name} href={item.path} className="bb-rail-item" aria-current={active ? 'page' : undefined}>
                <span className="bb-rail-icon"><Icon className="h-5 w-5" aria-hidden /></span>
                <span className="bb-rail-label">{item.name}</span>
              </Link>
            );
          })}
        </nav>
        <div className="bb-rail-foot">
          {isAdmin && (
            <Link href="/admin" className="bb-rail-item" aria-current={pathname.startsWith('/admin') ? 'page' : undefined}>
              <span className="bb-rail-icon"><ShieldCheck className="h-5 w-5" aria-hidden /></span><span className="bb-rail-label">Admin</span>
            </Link>
          )}
          <Link href="/support" className="bb-rail-item" aria-current={pathname === '/support' ? 'page' : undefined}>
            <span className="bb-rail-icon"><LifeBuoy className="h-5 w-5" aria-hidden /></span><span className="bb-rail-label">Help</span>
          </Link>
        </div>
      </aside>

      <div className="bb-app-body">
        <header className="bb-bar">
          <Link href="/" className="bb-bar-logo" aria-label="Bench Boss home"><BenchBossLogo size={34} /></Link>
          <SearchBar />
          <div className="bb-bar-actions">
            {espnConfig && (
              <button type="button" onClick={handleSync} disabled={isSyncing} className="bb-sync" data-status={syncStatus}>
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} aria-hidden /><span>{syncLabel}</span>
              </button>
            )}
            <Link href={hasTeam ? '/myteam' : '/teams/new'} className="bb-team-chip">
              {hasTeam ? <Shirt className="h-4 w-4 text-accent" aria-hidden /> : <Plus className="h-4 w-4 text-accent" aria-hidden />}
              <span className="bb-team-chip-text"><span className="block truncate font-semibold">{hasTeam ? teamName : 'Add a team'}</span><span className="block text-xs text-muted">{hasTeam ? teamPlatform : 'Connect a league'}</span></span>
            </Link>
            <AlertsMenu />
            {isAuthenticated ? (
              <div ref={profileRef} className="relative">
                <button type="button" className="bb-avatar-button" onClick={() => setProfileOpen(o => !o)} aria-expanded={profileOpen} aria-haspopup="true" aria-label="Account menu">
                  <span className="bb-avatar">
                    {session?.user?.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- OAuth avatar from the user's provider
                      <img src={session.user.image} alt="" className="h-full w-full object-cover" />
                    ) : getInitial(session?.user?.name)}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted" aria-hidden />
                </button>
                {profileOpen && (
                  <div className="bb-popover right-0 w-64" role="menu">
                    <div className="border-b border-rule px-4 py-3">
                      <p className="truncate text-sm font-semibold">{session?.user?.name || 'Manager'}</p>
                      <p className="truncate text-xs text-muted">{username ? `@${username}` : session?.user?.email}</p>
                    </div>
                    <Link href="/profile" role="menuitem" className="bb-menu-item" onClick={() => setProfileOpen(false)}><User className="h-4 w-4" aria-hidden />Profile</Link>
                    <Link href="/support" role="menuitem" className="bb-menu-item" onClick={() => setProfileOpen(false)}><LifeBuoy className="h-4 w-4" aria-hidden />Help center</Link>
                    {isAdmin && <Link href="/admin" role="menuitem" className="bb-menu-item" onClick={() => setProfileOpen(false)}><ShieldCheck className="h-4 w-4" aria-hidden />Admin</Link>}
                    <button type="button" role="menuitem" className="bb-menu-item text-error" onClick={() => signOut({ callbackUrl: '/' })}><LogOut className="h-4 w-4" aria-hidden />Sign out</button>
                  </div>
                )}
              </div>
            ) : (
              <button type="button" onClick={() => router.push('/login')} className="bb-signin">Sign in</button>
            )}
          </div>
        </header>

        <main className="bb-main fantasy-main">
          {pathname === '/' && <ScoreStrip />}

          {showBanner && (
            <div className="bb-connect" role="region" aria-label="Connect your league">
              <span className="bb-connect-icon" aria-hidden><RefreshCw className="h-4 w-4" /></span>
              <p><span className="font-semibold">Connect your ESPN league</span> to get projections and advice in your league’s scoring.</p>
              <Link href="/teams/new" className="bb-connect-cta">Connect league</Link>
              <button type="button" className="bb-connect-close" onClick={dismissBanner} aria-label="Dismiss"><X className="h-4 w-4" /></button>
            </div>
          )}
          {inTools && (
            <nav className="bb-section-tabs" aria-label="Tools">
              {toolTabs.map(tab => (
                <Link key={tab.path} href={tab.path} className="bb-pill-tab" aria-current={pathname === tab.path ? 'page' : undefined}>{tab.name}</Link>
              ))}
            </nav>
          )}
          {children}
        </main>
      </div>

      <nav className="bb-bottom-nav" aria-label="Main">
        {mobileItems.map(item => {
          const Icon = item.icon;
          const active = isActive(pathname, item.match);
          return (
            <Link key={item.name} href={item.path} className="bb-bottom-item" aria-current={active ? 'page' : undefined}>
              <Icon className="h-5 w-5" aria-hidden /><span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

    </div>
  );
}
