'use client';

import { BarChart3, Crosshair, Repeat2, Shirt } from 'lucide-react';

type NoTeamDashboardProps = {
  onAddTeam: () => void;
  onBrowsePlayers: () => void;
};

export default function NoTeamDashboard({ onAddTeam, onBrowsePlayers }: NoTeamDashboardProps) {
  const tools = [
    [BarChart3, 'Projections', 'Compare player output and schedule context without leaving the roster view.'],
    [Crosshair, 'Waivers', 'Scan the player pool for players worth a closer look.'],
    [Repeat2, 'Trades', 'Evaluate deals from the roster data you already use.'],
  ] as const;

  return (
    <div className="min-h-full px-5 py-8 md:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 border-b border-white/10 pb-6">
          <p className="fantasy-kicker mb-3 text-xs font-black">Bench Boss / 2026 season</p>
          <h1 className="max-w-3xl text-4xl font-black tracking-tight text-white md:text-6xl">
            Start with the roster, then make the calls.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400 md:text-lg">
            Connect a league or build one manually. Bench Boss keeps your roster, player pool, and lineup tools in the same place.
          </p>
        </header>

        <section className="grid border border-white/10 bg-[#171a22] lg:grid-cols-[1.25fr_0.75fr]">
          <div className="p-6 md:p-8">
            <div className="mb-12 flex h-11 w-11 items-center justify-center rounded-lg border border-violet-300/30 bg-violet-400/10 text-violet-200">
              <Shirt className="h-5 w-5" />
            </div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">No active team</p>
            <h2 className="text-3xl font-black text-white">Create your workspace.</h2>
            <p className="mt-3 max-w-xl leading-7 text-slate-400">Import an existing ESPN league or create a roster from the NHL player pool. Your team is private to your account and can be edited later.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button onClick={onAddTeam} className="fantasy-button rounded-lg px-5 py-3 text-sm font-black text-white">Add your team</button>
              <button onClick={onBrowsePlayers} className="rounded-lg border border-white/10 px-5 py-3 text-sm font-bold text-slate-200 transition-colors hover:bg-white/5">Browse player pool</button>
            </div>
          </div>
          <div className="border-t border-white/10 bg-black/15 p-6 md:p-8 lg:border-l lg:border-t-0">
            <p className="mb-6 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Setup sequence</p>
            <ol className="space-y-6">
              {[
                ['01', 'Choose a league source', 'Connect ESPN or start with a custom team.'],
                ['02', 'Confirm your roster', 'Review the players Bench Boss should track.'],
                ['03', 'Use the player tools', 'Compare projections, matchups, and availability.'],
              ].map(([step, title, detail]) => (
                <li key={step} className="flex gap-4">
                  <span className="font-mono text-xs font-bold text-violet-300">{step}</span>
                  <span><strong className="block text-sm text-slate-100">{title}</strong><span className="mt-1 block text-sm leading-6 text-slate-500">{detail}</span></span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mt-10 grid gap-px border border-white/10 bg-white/10 md:grid-cols-3">
          {tools.map(([Icon, title, copy]) => (
            <div key={title} className="bg-[#13161d] p-6">
              <Icon className="mb-8 h-5 w-5 text-violet-300" />
              <h3 className="font-black text-white">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{copy}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
