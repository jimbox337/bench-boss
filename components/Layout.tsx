'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState, useRef } from 'react';
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isLoading = status === 'loading';
  const isAuthenticated = !!session;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

          {/* User Profile Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center space-x-2 hover:bg-slate-700 rounded-lg p-1 transition-colors"
            >
              <div className="w-10 h-10 rounded-full overflow-hidden bg-blue-600 flex items-center justify-center text-white font-bold border-2 border-transparent hover:border-blue-400 transition-all">
                {session?.user?.image ? (
                  <img
                    src={session.user.image}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`text-lg ${session?.user?.image ? 'hidden' : ''}`}>
                  {session?.user?.name?.charAt(0).toUpperCase()}
                </div>
              </div>
              <svg
                className="w-4 h-4 text-slate-400 hidden md:block"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu - Two Column Layout */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-[600px] bg-slate-800 border border-slate-700 rounded-lg shadow-2xl z-50">
                {/* User Info Header */}
                <div className="p-4 border-b border-slate-700 bg-slate-750">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-blue-600 flex items-center justify-center text-white font-bold">
                      {session?.user?.image ? (
                        <img src={session.user.image} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl">{session?.user?.name?.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-slate-100">{session?.user?.name}</div>
                      <div className="text-sm text-slate-400">{session?.user?.email}</div>
                      <div className="text-xs text-slate-500 mt-0.5">@{session?.user?.email?.split('@')[0]}</div>
                    </div>
                  </div>
                </div>

                {/* Two Column Content */}
                <div className="grid grid-cols-2 divide-x divide-slate-700">
                  {/* Left Column - My Teams */}
                  <div className="p-3">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 px-2">
                      My Teams
                    </div>
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {/* Placeholder teams - will be replaced with actual data */}
                      <button
                        onClick={() => setIsDropdownOpen(false)}
                        className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-700 transition-colors text-left"
                      >
                        <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center flex-shrink-0">
                          <img
                            src="https://a.espncdn.com/redesign/assets/img/logos/espn-logo-white.svg"
                            alt="ESPN"
                            className="w-5 h-5"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-200 truncate">Current Team</div>
                          <div className="text-xs text-slate-400">ESPN</div>
                        </div>
                      </button>

                      {/* Add New Team Button */}
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          router.push('/welcome');
                        }}
                        className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-700 transition-colors text-left border border-dashed border-slate-600"
                      >
                        <div className="w-8 h-8 bg-slate-700 rounded flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-slate-300">Add New Team</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Right Column - Settings & Actions */}
                  <div className="p-3">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 px-2">
                      Account
                    </div>
                    <div className="space-y-1">
                      <Link
                        href="/profile"
                        onClick={() => setIsDropdownOpen(false)}
                        className="flex items-center gap-3 px-2 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Profile
                      </Link>

                      <Link
                        href="/settings"
                        onClick={() => setIsDropdownOpen(false)}
                        className="flex items-center gap-3 px-2 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        League Settings
                      </Link>

                      <Link
                        href="/support"
                        onClick={() => setIsDropdownOpen(false)}
                        className="flex items-center gap-3 px-2 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        Support
                      </Link>

                      <div className="border-t border-slate-700 my-2"></div>

                      <button
                        onClick={() => signOut({ callbackUrl: '/welcome' })}
                        className="w-full flex items-center gap-3 px-2 py-2 text-sm text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign Out
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
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