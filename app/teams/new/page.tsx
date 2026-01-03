'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Image from 'next/image';

export default function NewTeam() {
  const router = useRouter();
  const [selectedPlatform, setSelectedPlatform] = useState<'espn' | 'yahoo' | 'custom' | null>(null);

  const handlePlatformSelect = (platform: 'espn' | 'yahoo' | 'custom') => {
    setSelectedPlatform(platform);

    if (platform === 'espn') {
      router.push('/teams/espn');
    } else if (platform === 'yahoo') {
      router.push('/teams/yahoo');
    } else if (platform === 'custom') {
      router.push('/teams/custom');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">Add Your Fantasy Team</h1>
          <p className="text-slate-600 text-lg">Choose how you want to set up your team</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* ESPN Option */}
          <button
            onClick={() => handlePlatformSelect('espn')}
            className="group bg-white hover:bg-gray-50 border-2 border-gray-200 hover:border-red-500 rounded-2xl p-8 transition-all duration-300 text-left shadow-sm hover:shadow-lg"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center border border-gray-200">
                <img
                  src="https://a.espncdn.com/redesign/assets/img/icons/ESPN-icon-football.png"
                  alt="ESPN"
                  className="w-12 h-12 object-contain"
                />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900 group-hover:text-red-600 transition-colors">
                  ESPN Fantasy
                </h3>
                <p className="text-slate-500 text-sm">Recommended</p>
              </div>
            </div>

            <p className="text-slate-700 mb-4">
              Connect your ESPN Fantasy Hockey league to automatically sync your team, roster, and league settings.
            </p>

            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Auto-sync roster and stats
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Import league scoring settings
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Real-time updates
              </li>
            </ul>

            <div className="mt-6 flex items-center justify-between">
              <span className="text-red-600 font-semibold group-hover:text-red-700 transition-colors">
                Connect ESPN →
              </span>
            </div>
          </button>

          {/* Yahoo Option */}
          <button
            onClick={() => handlePlatformSelect('yahoo')}
            className="group bg-white hover:bg-gray-50 border-2 border-gray-200 hover:border-purple-500 rounded-2xl p-8 transition-all duration-300 text-left shadow-sm hover:shadow-lg"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center border border-gray-200">
                <img
                  src="https://s.yimg.com/cv/apiv2/default/20190916/yahoo_news_en-US_s_f_a_2x.png"
                  alt="Yahoo"
                  className="w-12 h-12 object-contain"
                />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
                  Yahoo Fantasy
                </h3>
                <p className="text-slate-500 text-sm">Popular choice</p>
              </div>
            </div>

            <p className="text-slate-700 mb-4">
              Connect your Yahoo Fantasy Hockey league to automatically sync your team and league settings.
            </p>

            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Auto-sync roster and stats
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Import league scoring settings
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Real-time updates
              </li>
            </ul>

            <div className="mt-6 flex items-center justify-between">
              <span className="text-purple-600 font-semibold group-hover:text-purple-700 transition-colors">
                Connect Yahoo →
              </span>
            </div>
          </button>
        </div>

        {/* Custom Option */}
        <div className="mb-6">
          <button
            onClick={() => handlePlatformSelect('custom')}
            className="group w-full bg-white hover:bg-gray-50 border-2 border-gray-200 hover:border-blue-500 rounded-2xl p-6 transition-all duration-300 text-left shadow-sm hover:shadow-lg"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">Custom League</h3>
                  <p className="text-slate-500 text-sm">Manual setup - Build your own team</p>
                </div>
              </div>
              <span className="text-blue-600 font-semibold group-hover:text-blue-700 transition-colors">
                Setup Custom →
              </span>
            </div>
          </button>
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => router.back()}
            className="text-slate-600 hover:text-slate-900 transition-colors font-medium"
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
}
