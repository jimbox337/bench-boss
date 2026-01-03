'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function CustomSetup() {
  const router = useRouter();
  const [teamName, setTeamName] = useState('');
  const [leagueName, setLeagueName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!teamName.trim() || !leagueName.trim()) {
      setError('Please fill in all fields');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'custom',
          teamName,
          leagueName,
        }),
      });

      const data = await response.json();

      if (data.success) {
        router.push('/myteam');
      } else {
        setError(data.error || 'Failed to create custom league');
      }
    } catch (err) {
      setError('An error occurred while creating your league');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-slate-100 mb-3">Custom League Setup</h1>
          <p className="text-slate-400 text-lg">Create your custom fantasy hockey league</p>
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
                Team Name
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none"
                placeholder="Ice Breakers"
                required
              />
              <p className="text-xs text-slate-400 mt-2">
                What's your fantasy team called?
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                League Name
              </label>
              <input
                type="text"
                value={leagueName}
                onChange={(e) => setLeagueName(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none"
                placeholder="Monday Night Hockey"
                required
              />
              <p className="text-xs text-slate-400 mt-2">
                What league is this team in?
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
                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Creating...' : 'Create League'}
              </button>
            </div>
          </form>

          <div className="mt-8 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Next steps:</h3>
            <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
              <li>Add players to your roster manually</li>
              <li>Configure your league's scoring settings</li>
              <li>Set up position requirements</li>
              <li>Start using Bench Boss tools for analysis</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
