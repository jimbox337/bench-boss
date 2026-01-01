'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';

const navItems = [
  { icon: '📊', name: 'Dashboard', path: '/' },
  { icon: '👕', name: 'My Team', path: '/myteam' },
  { icon: '⚡', name: 'Lineup Optimizer', path: '/lineup' },
  { icon: '🤔', name: 'Start / Sit', path: '/startsit' },
  { icon: '🔄', name: 'Trade Analyzer', path: '/trades' },
  { icon: '🎯', name: 'Waiver Targets', path: '/waivers' },
  { icon: '👥', name: 'Player Explorer', path: '/players' },
  { icon: '⚙️', name: 'League Settings', path: '/settings' },
];

const publicRoutes = ['/welcome', '/login'];

export default function Layout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();

  const isLoading = status === 'loading';
  const isAuthenticated = !!session;

  // Redirect logic
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !publicRoutes.includes(pathname)) {
      router.push('/welcome');
    }
  }, [isLoading, isAuthenticated, pathname, router]);

  // If on public routes, show without sidebar
  if (publicRoutes.includes(pathname)) {
    return <>{children}</>;
  }

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex h-screen bg-slate-900 items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🏒</div>
          <div className="text-slate-300">Loading...</div>
        </div>
      </div>
    );
  }

  // If not authenticated, show nothing (redirect will happen)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen bg-slate-900">
      {/* Top Navbar */}
      <nav className="bg-slate-800 border-b border-slate-700 py-2 z-50">
        <div className="flex items-center justify-between h-full px-4">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <span className="text-2xl">🏒</span>
            <span className="text-lg font-bold text-slate-100 hidden lg:inline">Bench Boss</span>
          </div>

          {/* Navigation Icons */}
          <div className="flex items-center space-x-1 flex-1 justify-center">
            {navItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex flex-col items-center px-3 py-1 rounded-lg transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span className="text-2xl mb-0.5">{item.icon}</span>
                  <span className="text-[10px] font-medium whitespace-nowrap">{item.name}</span>
                </Link>
              );
            })}
          </div>

          {/* User Info */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
              {session?.user?.name?.charAt(0).toUpperCase()}
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/welcome' })}
              className="text-xs text-slate-400 hover:text-slate-200 py-2 px-3 rounded-lg hover:bg-slate-700 transition-colors hidden md:block"
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-slate-900">
        {children}
      </main>
    </div>
  );
}