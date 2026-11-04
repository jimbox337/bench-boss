'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, ChevronRight, Settings2, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';

const platformOptions = [
  {
    id: 'espn',
    title: 'ESPN Fantasy',
    label: 'Recommended',
    description: 'Connect your ESPN Fantasy Hockey league and sync roster, league settings, and scoring rules.',
    action: 'Connect ESPN',
    path: '/teams/espn',
    badgeClass: 'bg-paper-2 text-muted border-rule',
    iconClass: 'bg-paper-3 text-ink',
    features: ['Auto-sync roster and stats', 'Import scoring settings', 'Private league support'],
    mark: 'ESPN',
  },
  {
    id: 'yahoo',
    title: 'Yahoo Fantasy',
    label: 'League import',
    description: 'Bring in your Yahoo Fantasy Hockey league once your Yahoo connection is ready.',
    action: 'Connect Yahoo',
    path: '/teams/yahoo',
    badgeClass: 'bg-paper-2 text-accent border-rule',
    iconClass: 'bg-paper-3 text-ink',
    features: ['Roster setup flow', 'League settings support', 'Yahoo-ready structure'],
    mark: 'Y!',
  },
];

function NewTeamInner() {
  const router = useRouter();

  return (
    <div className="bb-page">
      <div className="mx-auto max-w-6xl">
        <button
          onClick={() => router.back()}
          className="mb-6 inline-flex items-center gap-2 border border-rule bg-paper-2 px-4 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <section className="bb-page-header mb-6">

          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
            <div>
              <h1 className="text-3xl font-semibold leading-tight text-ink">
                Add your fantasy team.
              </h1>

              <p className="mt-3 max-w-2xl text-base leading-6 text-ink-2">
                Start with an import when your league platform is available, or build a custom roster manually.
              </p>
            </div>

            <div className="border-l border-rule pl-6 py-2">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center bg-paper-2 text-accent">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">Best first move</p>
                  <p className="text-xs text-muted">Connect ESPN if you already play there.</p>
                </div>
              </div>
              <div className="rink-divider my-5" />
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="py-2">
                  <p className="text-2xl font-medium text-accent">3</p>
                  <p className="text-xs font-medium text-muted">Setup paths</p>
                </div>
                <div className="py-2">
                  <p className="text-2xl font-medium text-success">Live</p>
                  <p className="text-xs font-medium text-muted">NHL data</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          {platformOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => router.push(option.path)}
              className="bb-panel group flex flex-col gap-4 p-6 text-left hover:border-accent"
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`flex h-14 w-14 items-center justify-center  text-sm font-medium ${option.iconClass}`}>
                    {option.mark}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-ink">{option.title}</h2>
                    <span className={`mt-2 inline-flex  border px-3 py-1 text-xs font-medium ${option.badgeClass}`}>
                      {option.label}
                    </span>
                  </div>
                </div>
                <ChevronRight className="mt-2 h-5 w-5 text-muted transition-colors group-hover:text-accent" />
              </div>

              <p className="leading-7 text-muted">{option.description}</p>

              <div className="space-y-3">
                {option.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm font-medium text-muted">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    {feature}
                  </div>
                ))}
              </div>

              <div className="inline-flex items-center gap-2 text-sm font-medium text-accent mt-auto pt-2">
                {option.action}
                <ChevronRight className="h-4 w-4" />
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={() => router.push('/teams/custom')}
          className="bb-panel group mt-5 w-full p-6 text-left hover:border-accent"
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center bg-paper-2 text-accent">
                <Settings2 className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-ink">Custom League</h2>
                <p className="mt-1 text-sm text-muted">Manual roster setup for any league format.</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm font-medium text-accent">
              Build Manually
              <ChevronRight className="h-4 w-4 transition-colors" />
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              [Zap, 'Pick players manually'],
              [ShieldCheck, 'Control scoring assumptions'],
              [Sparkles, 'Use every Bench Boss tool'],
            ].map(([Icon, text]) => (
              <div key={text as string} className="flex items-center gap-2 bg-paper-2 px-3 py-3 text-sm font-medium text-muted">
                <Icon className="h-4 w-4 text-accent" />
                {text as string}
              </div>
            ))}
          </div>
        </button>
      </div>
    </div>
  );
}

export default function NewTeam() {
  return (
    <ProtectedRoute>
      <NewTeamInner />
    </ProtectedRoute>
  );
}
