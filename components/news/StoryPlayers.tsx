'use client';

import { useMemo } from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';
import { useData } from '@/lib/DataContext';
import { calculateFantasyRange, calculateFantasyPoints, type Player, type Projection, type LeagueSettings } from '@/lib/calculator';
import { usePlayerCard } from '@/components/player/PlayerCardProvider';
import { playersInText } from '@/lib/newsPlayers';

function weekLine(player: Player, projection: Projection | undefined, settings: LeagueSettings): string | null {
  if (!projection) return null;
  if (settings.scoringType === 'H2H_Points' && settings.pointsPerStat) {
    try {
      const range = calculateFantasyRange(projection, settings);
      const mean = range?.mean ?? calculateFantasyPoints(projection, settings);
      const spread = range ? ` (${range.low.toFixed(1)}–${range.high.toFixed(1)})` : '';
      return `${mean.toFixed(1)} fantasy pts next 7 days${spread}`;
    } catch {
      return null;
    }
  }
  const s = projection.skaterStats;
  if (!s || player.isGoalie) return null;
  return `Next 7 days: ${s.G.toFixed(1)} G, ${s.A.toFixed(1)} A, ${s.SOG.toFixed(1)} SOG`;
}

export default function StoryPlayers({ text }: { text: string }) {
  const { players, projections, leagueSettings, isLoading } = useData();
  const { openPlayer } = usePlayerCard();
  const mentioned = useMemo(() => playersInText(text, players), [text, players]);
  const weekly = useMemo(() => new Map(projections.filter((p) => p.timeframe === 'next_7').map((p) => [p.playerId, p])), [projections]);

  if (isLoading && players.length === 0) return null;

  return (
    <section className="bb-story-players" aria-labelledby="story-players-title">
      <h2 id="story-players-title" className="flex items-center gap-2 text-lg"><Sparkles size={17} className="text-accent" aria-hidden="true" /> Fantasy angle</h2>
      {mentioned.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No NHL players are named in this headline. Open the player explorer to research anyone in the story.</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted">Players named in this story, with Bench Boss stats and model projections.</p>
          <ul className="bb-story-player-list">
            {mentioned.map((player) => {
              const line = weekLine(player, weekly.get(player.id), leagueSettings);
              const stats = player.seasonStats;
              return (
                <li key={player.id}>
                  <button type="button" onClick={() => openPlayer(player.id)} className="bb-story-player">
                    <span className="bb-story-avatar">
                      {player.headshotUrl ? <img src={player.headshotUrl} alt="" /> : player.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-accent">{player.name}</span>
                      <span className="block text-xs text-muted">
                        {player.nhlTeam} / {player.positions?.join('/') || (player.isGoalie ? 'G' : 'Skater')}
                        {stats && !player.isGoalie && ` · ${stats.G} G, ${stats.A} A, ${stats.PTS} PTS in ${player.gamesPlayed ?? '?'} GP`}
                        {player.injuryStatus && player.injuryStatus !== 'Healthy' && <span className="bb-story-injury"> · {player.injuryStatus}</span>}
                      </span>
                      {line && <span className="mt-0.5 block text-xs text-ink-2">{line}</span>}
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-muted" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
