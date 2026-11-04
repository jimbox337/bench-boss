'use client';

import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/AuthContext';
import { useData } from '@/lib/DataContext';
import { CheckCircle2, Plus, UserRound } from 'lucide-react';

export default function WelcomePage() {
  const router = useRouter();
  const { status } = useSession();
  const { myTeam, espnConfig } = useData();

  // Don't auto-redirect on welcome page
  // This page is intentionally for setting up teams, even if one exists

  return (
    <div className="bb-page">
      <div className="max-w-5xl w-full">
        {/* Header */}
        <div className="bb-page-header flex-col items-start mb-6">

          <h1 className="text-3xl font-semibold text-ink mb-4 leading-tight">
            Bench Boss
          </h1>
          <p className="text-base text-ink-2 max-w-2xl">
            Draft smarter, stream harder, and turn every matchup into a managed edge.
          </p>
          {(myTeam.length > 0 || espnConfig) && (
            <div className="mt-5 inline-flex items-center gap-2 border border-success/30 bg-success/10 px-4 py-2 text-sm font-medium text-success">
              <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
              Team connection detected
            </div>
          )}
        </div>

        {/* Step 1: Create Account or Login */}
        {status === 'unauthenticated' && (
          <div className="bb-panel p-6 mb-8">
            <div className="text-left">
              <div className="w-12 h-12 flex items-center justify-center mb-4">
                <UserRound className="h-6 w-6 text-ink" />
              </div>
              <h2 className="text-xl font-semibold text-ink mb-3">
                Step 1: Create Your Account
              </h2>
              <p className="text-ink-2 mb-6 max-w-2xl">
                Sign up to save your teams, track your players, and get personalized recommendations across all your devices.
              </p>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => router.push('/login?signup=true')}
                  className="px-8 py-3 bb-button text-accent-ink font-medium transition-colors"
                >
                  Create Account
                </button>
                <button
                  onClick={() => router.push('/login')}
                  className="px-8 py-3 bg-paper-2 text-accent font-medium hover:bg-paper-2 border border-rule transition-colors"
                >
                  Log In
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Sync League (only shown when logged in) */}
        {status === 'authenticated' && (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-ink mb-2">
                Step 2: Set Up Your Team
              </h2>
              <p className="text-muted">
                Choose how you want to get started
              </p>
            </div>

            {/* Options */}
            <div className="grid md:grid-cols-2 gap-6">
          {/* ESPN Option */}
          <div className="bb-panel p-6">
            <div className="flex flex-col h-full">
              <div className="mb-6">
                <div className="w-12 h-12 bg-paper-3 flex items-center justify-center mb-4 p-2">
                  <span className="text-sm font-medium text-ink">ESPN</span>
                </div>
                <h2 className="text-xl font-semibold text-ink mb-3">
                  Connect ESPN League
                </h2>
                <p className="text-ink-2 mb-4">
                  Automatically import your ESPN Fantasy Hockey league settings, scoring format, and roster.
                </p>
              </div>

              <div className="mt-auto space-y-3">
                <div className="flex items-start text-sm text-muted">
                  <CheckCircle2 className="w-5 h-5 text-success mr-2 flex-shrink-0 mt-0.5" />
                  Auto-sync league settings and scoring
                </div>
                <div className="flex items-start text-sm text-muted">
                  <CheckCircle2 className="w-5 h-5 text-success mr-2 flex-shrink-0 mt-0.5" />
                  Import your team roster instantly
                </div>
                <div className="flex items-start text-sm text-muted">
                  <CheckCircle2 className="w-5 h-5 text-success mr-2 flex-shrink-0 mt-0.5" />
                  Choose from all teams in your league
                </div>

                <button
                  onClick={() => router.push('/teams/espn')}
                  className="bb-button w-full mt-6 px-6 py-3 bg-accent text-accent-ink font-medium hover:bg-accent transition-colors"
                >
                  Connect ESPN
                </button>
              </div>
            </div>
          </div>

          {/* Custom Team Option */}
          <div className="bb-panel p-6">
            <div className="flex flex-col h-full">
              <div className="mb-6">
                <div className="w-12 h-12 flex items-center justify-center mb-4">
                  <Plus className="h-6 w-6 text-ink" />
                </div>
                <h2 className="text-xl font-semibold text-ink mb-3">
                  Build Custom Team
                </h2>
                <p className="text-ink-2 mb-4">
                  Manually select players and customize your league settings for maximum flexibility.
                </p>
              </div>

              <div className="mt-auto space-y-3">
                <div className="flex items-start text-sm text-muted">
                  <CheckCircle2 className="w-5 h-5 text-accent mr-2 flex-shrink-0 mt-0.5" />
                  Browse 800+ NHL players
                </div>
                <div className="flex items-start text-sm text-muted">
                  <CheckCircle2 className="w-5 h-5 text-accent mr-2 flex-shrink-0 mt-0.5" />
                  Customize league settings manually
                </div>
                <div className="flex items-start text-sm text-muted">
                  <CheckCircle2 className="w-5 h-5 text-accent mr-2 flex-shrink-0 mt-0.5" />
                  Perfect for Yahoo, custom leagues
                </div>

                <button
                  onClick={() => router.push('/players')}
                  className="w-full mt-6 px-6 py-3 bb-button text-accent-ink font-medium transition-colors"
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
                className="text-muted hover:text-accent text-sm font-medium transition-colors"
              >
                Skip for now, I&apos;ll set this up later
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
