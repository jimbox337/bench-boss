'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function NewTeam() {
  const router = useRouter();
  const [selectedPlatform, setSelectedPlatform] = useState<'espn' | 'custom' | null>(null);

  const handlePlatformSelect = (platform: 'espn' | 'custom') => {
    setSelectedPlatform(platform);

    if (platform === 'espn') {
      router.push('/teams/espn');
    } else if (platform === 'custom') {
      router.push('/teams/custom');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-100 mb-3">Add Your Fantasy Team</h1>
          <p className="text-slate-400 text-lg">Choose how you want to set up your team</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ESPN Option */}
          <button
            onClick={() => handlePlatformSelect('espn')}
            className="group bg-gradient-to-br from-red-900/30 to-slate-800 hover:from-red-900/50 hover:to-slate-700 border-2 border-red-700/50 hover:border-red-600 rounded-2xl p-8 transition-all duration-300 text-left"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-red-600 rounded-xl flex items-center justify-center">
                <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize="12" fontWeight="bold">
                    ESPN
                  </text>
                </svg>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-100 group-hover:text-red-400 transition-colors">
                  ESPN Fantasy
                </h3>
                <p className="text-slate-400 text-sm">Recommended</p>
              </div>
            </div>

            <p className="text-slate-300 mb-4">
              Connect your ESPN Fantasy Hockey league to automatically sync your team, roster, and league settings.
            </p>

            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Auto-sync roster and stats
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Import league scoring settings
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Real-time updates
              </li>
            </ul>

            <div className="mt-6 flex items-center justify-between">
              <span className="text-red-400 font-semibold group-hover:text-red-300 transition-colors">
                Connect ESPN →
              </span>
            </div>
          </button>

          {/* Custom Option */}
          <button
            onClick={() => handlePlatformSelect('custom')}
            className="group bg-slate-800 hover:bg-slate-750 border-2 border-slate-700 hover:border-blue-600 rounded-2xl p-8 transition-all duration-300 text-left"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-100 group-hover:text-blue-400 transition-colors">
                  Custom League
                </h3>
                <p className="text-slate-400 text-sm">Manual setup</p>
              </div>
            </div>

            <p className="text-slate-300 mb-4">
              Manually build your team and configure your league's scoring settings. Perfect for custom leagues or offline tracking.
            </p>

            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Manually add players
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Customize scoring rules
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Full control
              </li>
            </ul>

            <div className="mt-6 flex items-center justify-between">
              <span className="text-blue-400 font-semibold group-hover:text-blue-300 transition-colors">
                Setup Custom →
              </span>
            </div>
          </button>
        </div>

        {/* Yahoo Coming Soon */}
        <div className="mt-6 bg-slate-800/50 border border-slate-700 rounded-xl p-6 opacity-60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-600/30 rounded-lg flex items-center justify-center">
                <svg className="w-8 h-8 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                  <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize="10" fontWeight="bold">
                    Y!
                  </text>
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-300">Yahoo Fantasy</h3>
                <p className="text-slate-500 text-sm">Coming Soon</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-purple-600/20 text-purple-400 text-xs font-medium rounded-lg">
              In Development
            </span>
          </div>
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => router.back()}
            className="text-slate-400 hover:text-slate-300 transition-colors"
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
}
