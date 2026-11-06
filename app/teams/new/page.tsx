'use client';

import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ChevronRight, FlaskConical } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';

const options = [
  {
    id: 'espn', title: 'ESPN Fantasy', tag: 'Most popular', path: '/teams/espn', action: 'Connect ESPN', mark: 'ESPN', color: '#C8102E',
    description: 'Sync your ESPN Fantasy Hockey roster, league settings and scoring rules.',
    features: ['Roster and stats sync', 'Your league’s scoring', 'Private leagues supported'],
  },
  {
    id: 'yahoo', title: 'Yahoo Fantasy', tag: 'Secure sign-in', path: '/teams/yahoo', action: 'Connect Yahoo', mark: 'Y!', color: '#6001D2',
    description: 'Sign in with Yahoo to import your NHL league’s roster and scoring settings.',
    features: ['Sign in on Yahoo, no password shared', 'Points and category leagues', 'Disconnect any time'],
  },
];

function NewTeamInner() {
  return (
    <div className="bb-page mx-auto max-w-5xl space-y-8">
      <Link href="/" className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"><ArrowLeft className="h-4 w-4" /> Home</Link>
      <header>
        <h1 className="font-display text-4xl font-bold uppercase tracking-wide">Add your team</h1>
        <p className="mt-1 text-ink-2">Connect the league you play in, or try Bench Boss first with a sample roster.</p>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        {options.map(option => (
          <Link key={option.id} href={option.path} className="group flex flex-col overflow-hidden rounded-2xl border border-rule bg-paper-2 transition-colors hover:border-field-border">
            <span className="h-1.5" style={{ background: option.color }} aria-hidden />
            <span className="flex flex-1 flex-col gap-4 p-6">
              <span className="flex items-center gap-4">
                <span className="grid h-12 w-12 place-items-center rounded-xl font-display text-lg font-bold text-white" style={{ background: option.color }}>{option.mark}</span>
                <span>
                  <span className="block font-display text-2xl font-bold uppercase tracking-wide">{option.title}</span>
                  <span className="text-xs font-semibold text-muted">{option.tag}</span>
                </span>
              </span>
              <span className="text-ink-2">{option.description}</span>
              <span className="space-y-2">{option.features.map(feature => (
                <span key={feature} className="flex items-center gap-2 text-sm text-ink-2"><CheckCircle2 className="h-4 w-4 text-success" />{feature}</span>
              ))}</span>
              <span className="mt-auto inline-flex w-fit items-center gap-1 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink group-hover:bg-accent-2">{option.action}<ChevronRight className="h-4 w-4" /></span>
            </span>
          </Link>
        ))}
      </div>

      <Link href="/teams/test" className="group flex flex-wrap items-center gap-5 rounded-2xl border border-dashed border-field-border bg-paper-2 p-6 transition-colors hover:border-ink">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-paper-3 text-ink"><FlaskConical className="h-6 w-6" aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-2xl font-bold uppercase tracking-wide">Test it out</span>
          <span className="text-sm text-ink-2">No league needed. Get a sample roster of real NHL players and explore every tool. Connect your real league any time.</span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-ink px-5 py-2.5 text-sm font-semibold group-hover:bg-ink group-hover:text-on-brand">Start test mode<ChevronRight className="h-4 w-4" /></span>
      </Link>
    </div>
  );
}

export default function NewTeam() {
  return <ProtectedRoute><NewTeamInner /></ProtectedRoute>;
}
