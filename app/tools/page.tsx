'use client';

import Link from 'next/link';
import { ArrowLeftRight, BarChart3, Crosshair, Swords, Zap } from 'lucide-react';
import { ToolHeader, PlayerChip, useToolData } from '@/components/tools/toolkit';
import { usePlayerCard } from '@/components/player/PlayerCardProvider';

const TILES = [
  { href: '/trades', key: 'trade', icon: ArrowLeftRight, title: 'Trade', blurb: 'Is it fair? Find out before you send it.' },
  { href: '/startsit', key: 'startsit', icon: Swords, title: 'Start / Sit', blurb: 'Two players, one spot. Get the call.' },
  { href: '/waivers', key: 'waivers', icon: Crosshair, title: 'Waivers', blurb: 'The best free agents, with who to drop.' },
  { href: '/lineup', key: 'lineup', icon: Zap, title: 'Lineup', blurb: 'Your strongest lineup for the week.' },
  { href: '/players', key: 'players', icon: BarChart3, title: 'Players', blurb: 'Search, sort and compare everyone.' },
] as const;

export default function ToolsPage() {
  const { byId, myTeam, scoring } = useToolData();
  const { openPlayer } = usePlayerCard();
  const hottest = [...byId.values()]
    .filter((row) => row.fpts !== null && !myTeam.some((p) => p.id === row.player.id))
    .sort((a, b) => (b.fpts ?? 0) - (a.fpts ?? 0))
    .slice(0, 4);

  return (
    <div className="bb-page">
      <ToolHeader accent="tools" eyebrow="Fantasy toolbox" title="Make the call" blurb="Trades, start/sit, waivers and lineups, all powered by the Bench Boss projection model and your league's scoring." />

      <nav className="tk-tiles" aria-label="Fantasy tools">
        {TILES.map(({ href, key, icon: Icon, title, blurb }) => (
          <Link key={key} href={href} className={`tk-tile tk-tile-${key}`}>
            <Icon size={24} className="tk-tile-icon" aria-hidden="true" />
            <Icon size={130} strokeWidth={1.2} className="tk-tile-art" aria-hidden="true" />
            <strong>{title}</strong>
            <span>{blurb}</span>
          </Link>
        ))}
      </nav>

      {hottest.length > 0 && (
        <section className="tk-card mt-6" aria-labelledby="hot-adds-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="hot-adds-title">Best available this week</h2>
            <Link href="/waivers" className="text-sm font-semibold text-accent hover:underline">See all waiver targets</Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {hottest.map((row) => <PlayerChip key={row.player.id} row={row} onOpen={() => openPlayer(row.player.id)} />)}
          </div>
          <p className="tk-note">Projected fantasy points for the next 7 days, {scoring.label}. Players on your team are left out.</p>
        </section>
      )}
    </div>
  );
}
