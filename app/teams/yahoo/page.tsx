'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, ExternalLink } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';

function YahooSetupInner() {
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
    } catch {
      setError('An error occurred while connecting your league');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bb-page">
      <div className="mx-auto max-w-5xl">
        <button
          onClick={() => router.back()}
          className="mb-6 inline-flex items-center gap-2 border border-rule bg-paper-2 px-4 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <section className="bb-page-header mb-6">

          <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
            <div>
              <div className="mb-4 inline-flex border border-rule bg-paper-2 px-3 py-1 text-xs font-medium text-accent">
                Yahoo Fantasy
              </div>
              <h1 className="text-3xl font-semibold leading-tight text-ink">
                Connect your Yahoo team.
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-6 text-ink-2">
                Enter your Yahoo league ID to prepare your fantasy hockey roster for Bench Boss.
              </p>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center bg-paper-3 text-sm font-medium text-ink">
                  Y!
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">Login required</p>
                  <p className="text-xs text-muted">Teams are saved to your account.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
          <aside className="bb-panel p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center bg-paper-2 text-accent">
                <ExternalLink className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-ink">Open Yahoo first</h2>
                <p className="text-sm text-muted">Find the league ID in your URL.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleOpenYahoo}
              className="flex w-full items-center justify-center gap-2 bg-paper-2 px-5 py-3 font-medium text-accent transition-colors hover:bg-paper-2"
            >
              Open Yahoo Fantasy Hockey
              <ExternalLink className="h-4 w-4" />
            </button>
          </aside>

          <section className="bb-panel p-6 md:p-7">
            {error && (
              <div className="mb-5 flex items-start gap-3 border border-error/30 bg-error/10 px-4 py-3 text-error">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold text-ink">Enter your Yahoo league.</h2>
                <p className="text-muted mb-2 text-xs font-medium">League Details</p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-ink-2">Yahoo League ID</label>
                <input
                  type="text"
                  value={leagueId}
                  onChange={(e) => setLeagueId(e.target.value)}
                  className="bb-field w-full border border-rule bg-paper px-4 py-3 text-ink outline-none transition-colors placeholder:text-muted focus:border-rule"
                  placeholder="12345"
                  required
                />
                <p className="mt-2 text-xs text-muted">
                  Look at your Yahoo league URL and copy the numeric league ID.
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="flex-1 border border-rule bg-paper-2 px-6 py-3 font-medium text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="bb-button flex-1 bg-accent px-6 py-3 font-medium text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? 'Connecting...' : 'Connect League'}
                </button>
              </div>
            </form>

            <div className="mt-6 border-t border-rule pt-6">
              <h3 className="mb-3 text-sm font-semibold text-ink">Quick guide</h3>
              <div className="space-y-2 text-sm text-muted">
                {[
                  'Open Yahoo Fantasy Hockey.',
                  'Navigate to your hockey league.',
                  'Copy the numeric league ID from the URL.',
                  'Paste it here and connect.',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function YahooSetup() {
  return (
    <ProtectedRoute>
      <YahooSetupInner />
    </ProtectedRoute>
  );
}
