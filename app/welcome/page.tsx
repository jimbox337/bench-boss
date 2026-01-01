'use client';

import { useRouter } from 'next/navigation';
import { useData } from '@/lib/DataContext';
import { useEffect } from 'react';

export default function WelcomePage() {
  const router = useRouter();
  const { myTeam, espnConfig } = useData();

  // Redirect if user already has a team or ESPN config
  useEffect(() => {
    if (myTeam.length > 0 || espnConfig) {
      router.push('/');
    }
  }, [myTeam, espnConfig, router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-slate-100 mb-4">
            Welcome to Bench Boss
          </h1>
          <p className="text-xl text-slate-300">
            Your ultimate fantasy hockey decision-making tool
          </p>
        </div>

        {/* Options */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* ESPN Option */}
          <div className="bg-gradient-to-br from-red-900/30 to-slate-800 rounded-xl shadow-xl border border-red-700/50 p-8 hover:border-red-600 transition-all">
            <div className="flex flex-col h-full">
              <div className="mb-6">
                <div className="w-16 h-16 bg-red-600 rounded-xl flex items-center justify-center mb-4 p-2">
                  <img
                    src="https://a.espncdn.com/redesign/assets/img/logos/espn-logo-white.svg"
                    alt="ESPN Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <h2 className="text-2xl font-bold text-slate-100 mb-3">
                  Connect ESPN League
                </h2>
                <p className="text-slate-300 mb-4">
                  Automatically import your ESPN Fantasy Hockey league settings, scoring format, and roster.
                </p>
              </div>

              <div className="mt-auto space-y-3">
                <div className="flex items-start text-sm text-slate-400">
                  <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Auto-sync league settings and scoring
                </div>
                <div className="flex items-start text-sm text-slate-400">
                  <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Import your team roster instantly
                </div>
                <div className="flex items-start text-sm text-slate-400">
                  <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Choose from all teams in your league
                </div>

                <button
                  onClick={() => router.push('/settings')}
                  className="w-full mt-6 px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                >
                  Connect ESPN
                </button>
              </div>
            </div>
          </div>

          {/* Custom Team Option */}
          <div className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 p-8 hover:border-slate-600 transition-all">
            <div className="flex flex-col h-full">
              <div className="mb-6">
                <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mb-4">
                  <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-100 mb-3">
                  Build Custom Team
                </h2>
                <p className="text-slate-300 mb-4">
                  Manually select players and customize your league settings for maximum flexibility.
                </p>
              </div>

              <div className="mt-auto space-y-3">
                <div className="flex items-start text-sm text-slate-400">
                  <svg className="w-5 h-5 text-blue-500 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Browse 800+ NHL players
                </div>
                <div className="flex items-start text-sm text-slate-400">
                  <svg className="w-5 h-5 text-blue-500 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Customize league settings manually
                </div>
                <div className="flex items-start text-sm text-slate-400">
                  <svg className="w-5 h-5 text-blue-500 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Perfect for Yahoo, custom leagues
                </div>

                <button
                  onClick={() => router.push('/players')}
                  className="w-full mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Browse Players
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Skip Option */}
        <div className="text-center mt-8">
          <button
            onClick={() => router.push('/')}
            className="text-slate-400 hover:text-slate-200 text-sm transition-colors"
          >
            Skip for now, I'll set this up later
          </button>
        </div>
      </div>
    </div>
  );
}
