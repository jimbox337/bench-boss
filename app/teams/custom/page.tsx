'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useData } from '@/lib/DataContext';
import ProtectedRoute from '@/components/ProtectedRoute';

function CustomSetupInner() {
  const router = useRouter();
  const { refreshTeam } = useData();
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
          platform: 'Custom',
          name: teamName.trim(),
          leagueSettings: {
            leagueName: leagueName.trim(),
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        await refreshTeam();
        router.push('/myteam');
      } else {
        setError(data.error || 'Failed to create custom league');
      }
    } catch {
      setError('An error occurred while creating your league');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bb-page flex min-h-full items-start justify-center py-12">
      <div className="max-w-2xl w-full">
        <div className="bb-page-header flex-col items-start mb-8">
          <div className="w-12 h-12 bg-paper-3 flex items-center justify-center mb-4">
            <svg aria-hidden="true" className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          <h1 className="text-3xl font-semibold text-ink mb-3">Custom League Setup</h1>
          <p className="text-muted text-base">Create your custom fantasy hockey league</p>
        </div>

        <div className="bb-panel p-6 sm:p-8">
          {error && (
            <div className="mb-6 bg-error/10 border border-error/30 text-error px-4 py-3">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-2">
                Team Name
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="bb-field w-full bg-paper-3 border border-rule text-ink px-4 py-3 focus:border-rule focus:outline-none"
                placeholder="Ice Breakers"
                required
              />
              <p className="text-xs text-muted mt-2">
                What&apos;s your fantasy team called?
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-2 mb-2">
                League Name
              </label>
              <input
                type="text"
                value={leagueName}
                onChange={(e) => setLeagueName(e.target.value)}
                className="bb-field w-full bg-paper-3 border border-rule text-ink px-4 py-3 focus:border-rule focus:outline-none"
                placeholder="Monday Night Hockey"
                required
              />
              <p className="text-xs text-muted mt-2">
                What league is this team in?
              </p>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 px-6 py-3 border border-rule text-ink-2 font-medium hover:bg-paper-3 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="bb-button flex-1 px-6 py-3 bg-accent hover:bg-accent text-accent-ink font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Creating...' : 'Create League'}
              </button>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-rule">
            <h3 className="text-sm font-semibold text-ink-2 mb-2">Next steps:</h3>
            <ul className="text-xs text-muted space-y-1 list-disc list-inside">
              <li>Add players to your roster manually</li>
              <li>Configure your league&apos;s scoring settings</li>
              <li>Set up position requirements</li>
              <li>Start using Bench Boss tools for analysis</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomSetup() {
  return (
    <ProtectedRoute>
      <CustomSetupInner />
    </ProtectedRoute>
  );
}
