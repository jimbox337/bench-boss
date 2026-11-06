'use client';

import Link from 'next/link';
import { BarChart3, CheckCircle2, Crosshair, Repeat2, ShieldCheck, Shirt, Swords, Zap } from 'lucide-react';
import PlayerLeaders from '@/components/PlayerLeaders';
import NhlNewsTicker from '@/components/NhlNewsTicker';
import FeaturedGame from '@/components/gamecenter/FeaturedGame';

type NoTeamDashboardProps = {
  onAddTeam: () => void;
  onBrowsePlayers: () => void;
};

export default function NoTeamDashboard({ onAddTeam, onBrowsePlayers }: NoTeamDashboardProps) {
  const tools = [
    [Zap, 'Lineup optimizer', 'Review your best projected lineup.', '/lineup'],
    [Swords, 'Start / sit', 'Compare two players before puck drop.', '/startsit'],
    [Crosshair, 'Waiver targets', 'Find available players for your roster.', '/waivers'],
    [Repeat2, 'Trade analyzer', 'Compare both sides of a proposed deal.', '/trades'],
    [BarChart3, 'Player explorer', 'Research NHL season stats.', '/players'],
    [Shirt, 'My team', 'Manage your roster by position.', '/myteam'],
  ] as const;

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

          <section className="bb-panel bb-dashboard-tools overflow-hidden" aria-labelledby="dashboard-tools-title">
            <div className="bb-dashboard-panel-heading border-b border-rule px-5 py-4"><h2 id="dashboard-tools-title" className="text-lg">Fantasy hockey tools</h2></div>
            <div className="grid grid-cols-1 sm:grid-cols-2">
              {tools.map(([Icon, title, copy, href]) => (
                <Link key={title} href={href} className="flex min-w-0 items-start gap-3 border-b border-rule px-5 py-5 hover:bg-paper-3">
                  <Icon size={22} className="mt-0.5 shrink-0 text-accent" strokeWidth={1.7} aria-hidden="true" />
                  <div className="min-w-0"><h3 className="text-sm font-semibold text-accent">{title}</h3><p className="mt-1 text-xs leading-5 text-muted">{copy}</p></div>
                </Link>
              ))}
            </div>
          </section>

          <section className="bb-panel bb-dashboard-guide px-5 py-5" aria-labelledby="setup-guide-title">
            <h2 id="setup-guide-title" className="text-lg">Set up once. Manage all season.</h2>
            <ol className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-3">
              {[
                ['1', 'Choose your league', 'Connect ESPN or start a custom team.'],
                ['2', 'Confirm your roster', 'Review the players you want to track.'],
                ['3', 'Make your next move', 'Compare projections and availability.'],
              ].map(([step, title, detail]) => (
                <li key={step} className="flex items-start gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-paper-3 text-xs font-semibold text-muted">{step}</span><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs leading-5 text-muted">{detail}</p></div></li>
              ))}
            </ol>
            <div className="mt-5 flex items-center gap-2 border-t border-rule pt-4 text-xs text-muted"><ShieldCheck size={15} className="shrink-0" aria-hidden="true" /><span>Your team is private to your account. Edit your roster any time.</span><CheckCircle2 size={15} className="ml-auto shrink-0 text-success" aria-hidden="true" /></div>
          </section>
        </div>
        <aside className="min-w-0 space-y-6" aria-label="Player research"><PlayerLeaders /><NhlNewsTicker /></aside>
      </div>
    </div>
  );
}
