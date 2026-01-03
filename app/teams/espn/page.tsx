'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function ESPNSetup() {
  const router = useRouter();
  const [leagueId, setLeagueId] = useState('');
  const [seasonId, setSeasonId] = useState('2024');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!leagueId.trim()) {
      setError('Please enter your ESPN League ID');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'espn',
          leagueId,
          seasonId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        router.push('/myteam');
      } else {
        setError(data.error || 'Failed to connect ESPN league');
      }
    } catch (err) {
      setError('An error occurred while connecting your league');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
              <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize="10" fontWeight="bold">
                ESPN
              </text>
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-slate-100 mb-3">Connect ESPN Fantasy</h1>
          <p className="text-slate-400 text-lg">Enter your league details to get started</p>
        </div>

        <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700">
          {error && (
            <div className="mb-6 bg-red-900/30 border border-red-600 text-red-200 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                ESPN League ID
              </label>
              <input
                type="text"
                value={leagueId}
                onChange={(e) => setLeagueId(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 py-3 focus:border-red-500 focus:outline-none"
                placeholder="12345678"
                required
              />
              <p className="text-xs text-slate-400 mt-2">
                Find your League ID in your ESPN Fantasy Hockey league URL
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Season Year
              </label>
              <input
                type="text"
                value={seasonId}
                onChange={(e) => setSeasonId(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 py-3 focus:border-red-500 focus:outline-none"
                placeholder="2024"
                required
              />
              <p className="text-xs text-slate-400 mt-2">
                Current fantasy season year
              </p>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 px-6 py-3 border border-slate-600 text-slate-300 rounded-lg font-medium hover:bg-slate-700 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Connecting...' : 'Connect League'}
              </button>
            </div>
          </form>

          <div className="mt-8 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300 mb-2">How to find your League ID:</h3>
            <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
              <li>Go to your ESPN Fantasy Hockey league</li>
              <li>Look at the URL in your browser</li>
              <li>Find the number after "leagueId=" in the URL</li>
              <li>Copy that number and paste it above</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
