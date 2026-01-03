'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function YahooSetup() {
  const router = useRouter();
  const [leagueId, setLeagueId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleOpenYahoo = () => {
    window.open('https://hockey.fantasysports.yahoo.com/', '_blank');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!leagueId.trim()) {
      setError('Please enter your Yahoo League ID');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/yahoo/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        router.push('/myteam');
      } else {
        setError(data.error || 'Failed to connect Yahoo league');
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
          <div className="w-20 h-20 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
              <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize="10" fontWeight="bold">
                Y!
              </text>
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-slate-100 mb-3">Connect Yahoo Fantasy</h1>
          <p className="text-slate-400 text-lg">Sync your Yahoo league automatically</p>
        </div>

        <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700">
          {/* Quick Access Button */}
          <div className="mb-6 p-4 bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg">
            <h3 className="text-white font-bold mb-2">Step 1: Open Your Yahoo League</h3>
            <p className="text-purple-100 text-sm mb-3">
              Click below to open Yahoo Fantasy in a new tab, then come back here to complete setup
            </p>
            <button
              type="button"
              onClick={handleOpenYahoo}
              className="w-full px-6 py-3 bg-white text-purple-600 rounded-lg font-bold hover:bg-purple-50 transition-colors flex items-center justify-center gap-2"
            >
              <span>Open Yahoo Fantasy Hockey</span>
              <span>→</span>
            </button>
          </div>

          {error && (
            <div className="mb-6 bg-red-900/30 border border-red-600 text-red-200 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="p-4 bg-blue-900/20 border border-blue-600 rounded-lg">
              <h3 className="text-blue-400 font-bold mb-2">Step 2: Get Your League Information</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Yahoo League ID *
              </label>
              <input
                type="text"
                value={leagueId}
                onChange={(e) => setLeagueId(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 py-3 focus:border-purple-500 focus:outline-none"
                placeholder="12345"
                required
              />
              <p className="text-xs text-slate-400 mt-2">
                Look at your Yahoo league URL and find the number in the URL
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
                className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Connecting...' : 'Connect League'}
              </button>
            </div>
          </form>

          <div className="mt-6 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Quick Guide:</h3>
            <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
              <li>Click "Open Yahoo Fantasy Hockey" above</li>
              <li>Navigate to your league in the new tab</li>
              <li>Copy the League ID from the URL (usually a 5-6 digit number)</li>
              <li>Return here and paste it in the form</li>
              <li>Click "Connect League" to sync your team</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
