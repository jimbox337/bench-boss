'use client';

import Link from 'next/link';
import PlayerLeaders from '@/components/PlayerLeaders';
import NhlNewsCarousel from '@/components/NhlNewsCarousel';
import FeaturedGame from '@/components/gamecenter/FeaturedGame';

type NoTeamDashboardProps = {
  onAddTeam: () => void;
  onBrowsePlayers: () => void;
};

export default function NoTeamDashboard({ onAddTeam, onBrowsePlayers }: NoTeamDashboardProps) {
  return (
    <div className="bb-page bb-dashboard">
      <header className="bb-page-header">
        <div><h1>My dashboard</h1><p>Your fantasy hockey team and player research, in one place.</p></div>
      </header>
      <FeaturedGame />
      <div className="bb-dashboard-layout grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <section className="bb-panel bb-dashboard-setup overflow-hidden" aria-labelledby="connect-team-title">
            <div className="bb-dashboard-panel-heading flex items-center justify-between gap-3 border-b border-rule px-5 py-4"><h2 id="connect-team-title" className="text-lg">My fantasy team</h2><span className="text-xs text-muted">No team connected</span></div>
            <div className="px-5 py-6 sm:px-6">
              <h3 className="text-2xl leading-tight">Get your team in the game.</h3>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted">Browse players, compare trades, and build a guest roster—no account required. Sign in when you want to save a personal team.</p>
              <div className="mt-5 flex flex-wrap items-center gap-3"><button onClick={onAddTeam} className="bb-button">Build a roster</button><button onClick={onBrowsePlayers} className="bb-button-secondary">Browse player pool</button></div>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-rule bg-paper-3 px-5 py-3 text-xs text-muted">
              <span className="font-medium text-ink-2">League setup</span><Link href="/teams/espn" className="text-accent hover:underline">ESPN import</Link><Link href="/teams/yahoo" className="text-accent hover:underline">Yahoo connection</Link><Link href="/teams/test" className="text-accent hover:underline">Test mode</Link>
            </div>
          </section>

          <NhlNewsCarousel />
        </div>
        <aside className="min-w-0 space-y-6" aria-label="Player research"><PlayerLeaders /></aside>
      </div>
    </div>
  );
}
