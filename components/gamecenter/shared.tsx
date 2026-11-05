'use client';

import Link from 'next/link';
import { defaultLeagueSettings, type LeagueSettings } from '@/lib/calculator';
import type { TeamStarter } from '@/lib/goalieStarters';
import type { ScoreboardGame, TeamSide } from '@/lib/nhlGameCenter';
import { teamColor } from '@/lib/teamColors';
import { PlayerLink } from '@/components/player/PlayerCardProvider';

/** League scoring for fantasy points: the user's points league, else Bench Boss defaults. */
export function pointsScoring(settings: LeagueSettings): { settings: LeagueSettings; label: string } {
  const isDefault = settings === defaultLeagueSettings || JSON.stringify(settings.pointsPerStat) === JSON.stringify(defaultLeagueSettings.pointsPerStat);
  if (!isDefault && settings.scoringType === 'H2H_Points' && settings.pointsPerStat && Object.keys(settings.pointsPerStat).length) {
    return { settings, label: 'your league scoring' };
  }
  return { settings: defaultLeagueSettings, label: 'Bench Boss default scoring' };
}

export function TeamLogo({ team, size = 32 }: { team: Pick<TeamSide, 'abbrev' | 'logo'>; size?: number }) {
  const src = team.logo || `https://assets.nhle.com/logos/nhl/svg/${team.abbrev}_light.svg`;
  // eslint-disable-next-line @next/next/no-img-element -- remote NHL SVG logos, sized explicitly
  return <img src={src} alt="" width={size} height={size} className="shrink-0 object-contain" style={{ width: size, height: size }} />;
}

export function TeamLink({ abbrev, children, className = '' }: { abbrev: string; children: React.ReactNode; className?: string }) {
  return <Link href={`/nhl-teams/${abbrev}`} className={`hover:text-accent hover:underline ${className}`}>{children}</Link>;
}

export function gameStatusText(game: ScoreboardGame): string {
  if (game.isLive) {
    if (game.inIntermission) return `End ${periodName(game.period, game.periodType)}`;
    return `${periodName(game.period, game.periodType)} · ${game.clock || 'Live'}`;
  }
  if (game.isFinal) {
    const suffix = game.periodType === 'OT' ? '/OT' : game.periodType === 'SO' ? '/SO' : '';
    return `Final${suffix}`;
  }
  if (game.state === 'PPD') return 'Postponed';
  return new Date(game.startTimeUTC).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function periodName(number?: number, type?: string): string {
  if (type === 'SO') return 'Shootout';
  if (type === 'OT' || (number && number > 3)) return number && number > 4 ? `${number - 3}OT` : 'OT';
  return ['1st', '2nd', '3rd'][(number || 1) - 1] || `P${number}`;
}

export function StatusBadge({ game }: { game: ScoreboardGame }) {
  const tone = game.isLive ? 'bg-error text-on-brand' : game.isFinal ? 'bg-paper-3 text-ink-2' : 'bg-selection text-accent-2';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>
      {game.isLive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-on-brand motion-reduce:animate-none" aria-hidden />}
      {game.isLive ? 'LIVE · ' : ''}{gameStatusText(game)}
    </span>
  );
}

export function LineScore({ game, shots }: { game: ScoreboardGame; shots?: { periods: string[]; away: number[]; home: number[] } }) {
  const { periods, away, home } = game.lineScore;
  const started = game.isLive || game.isFinal;
  return (
    <table className="w-full text-sm tabular-nums" aria-label="Score by period">
      <thead>
        <tr className="text-xs text-muted">
          <th className="py-1 text-left font-medium">Team</th>
          {periods.map(p => <th key={p} className="w-9 py-1 text-center font-medium">{p}</th>)}
          <th className="w-10 py-1 text-center font-semibold text-ink">T</th>
          <th className="w-10 py-1 text-center font-medium">SOG</th>
        </tr>
      </thead>
      <tbody>
        {([['away', game.away, away], ['home', game.home, home]] as const).map(([side, team, values]) => (
          <tr key={side} className="border-t border-rule-2">
            <td className="py-1.5"><span className="flex items-center gap-2"><TeamLogo team={team} size={20} /><TeamLink abbrev={team.abbrev} className="font-medium">{team.abbrev}</TeamLink></span></td>
            {values.map((value, index) => <td key={periods[index]} className="text-center">{started ? value : '–'}</td>)}
            <td className="text-center font-semibold text-ink">{started ? team.score ?? 0 : '–'}</td>
            <td className="text-center text-muted">{shots ? shots[side].reduce((a, b) => a + b, 0) : started ? team.sog ?? '–' : '–'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function StarterLine({ starter }: { starter?: TeamStarter }) {
  if (!starter) return <span className="text-xs text-muted">Goalie loading…</span>;
  if (starter.status === 'unknown') return <span className="text-xs text-muted">Goalie not confirmed</span>;
  if (starter.status === 'confirmed') {
    return <span className="text-xs"><span className="text-muted">G </span><PlayerLink id={starter.playerId} className="bb-player-link font-medium">{starter.name}</PlayerLink> <span className="font-semibold text-success" title={starter.source}>✓ Confirmed</span></span>;
  }
  return <span className="text-xs text-muted" title={starter.source}>G <PlayerLink id={starter.playerId} className="bb-player-link">{starter.name}</PlayerLink> · <span className="italic">likely</span> ({starter.starts}/{starter.ofGames} starts)</span>;
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return <div className="mb-3 flex items-center justify-between gap-3 border-b border-rule pb-2"><h2 className="bb-section-title">{children}</h2>{action}</div>;
}

export function TeamColorBar({ away, home, className = 'h-1.5' }: { away: string; home: string; className?: string }) {
  return <div className={`flex gap-1 ${className}`} aria-hidden><span className="flex-1" style={{ background: teamColor(away) }} /><span className="flex-1" style={{ background: teamColor(home) }} /></div>;
}

export function shortStatus(game: ScoreboardGame): [string, string] {
  const p = game.periodType === 'SO' ? 'SO' : game.periodType === 'OT' ? 'OT' : ['1ST', '2ND', '3RD'][(game.period || 1) - 1] || `P${game.period}`;
  if (game.isLive) return game.inIntermission ? [`END ${p}`, 'Intermission'] : [p, game.clock || ''];
  if (game.isFinal) return ['FINAL', game.periodType && game.periodType !== 'REG' ? game.periodType : ''];
  if (game.state === 'PPD') return ['PPD', ''];
  const start = new Date(game.startTimeUTC);
  return [start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toUpperCase(), start.toLocaleDateString([], { month: 'short', day: 'numeric' })];
}

/** Large hero for one game: team-colour bar, logos, names, records, big scores, centre status. */
export function GameHero({ game, footer }: { game: ScoreboardGame; footer?: React.ReactNode }) {
  const started = game.isLive || game.isFinal;
  const [top, bottom] = shortStatus(game);
  const side = (s: 'away' | 'home') => (
    <div className={`flex items-center gap-3 md:gap-4 ${s === 'home' ? 'flex-row-reverse text-right' : ''}`}>
      <span className="flex flex-col items-center gap-1"><TeamLogo team={game[s]} size={56} /><span className="text-xs text-muted tabular-nums">{game[s].record}</span></span>
      <TeamLink abbrev={game[s].abbrev} className="hidden leading-tight sm:block">
        <span className="block text-lg text-ink-2">{game[s].city || game[s].abbrev}</span>
        <span className="bb-team-nick">{game[s].name}</span>
      </TeamLink>
    </div>
  );
  return (
    <div className="bb-game-hero overflow-hidden rounded-2xl border border-rule" style={{ '--away': teamColor(game.away.abbrev), '--home': teamColor(game.home.abbrev) } as React.CSSProperties}>
      <TeamColorBar away={game.away.abbrev} home={game.home.abbrev} />
      <div className="grid grid-cols-[1fr_auto_auto_auto_1fr] items-center gap-3 px-4 py-6 md:gap-6 md:px-6">
        {side('away')}
        <span className="bb-led-score">{started ? game.away.score ?? 0 : ''}</span>
        <span className="bb-faceoff" data-live={game.isLive || undefined}><strong>{top}</strong>{bottom && <span>{bottom}</span>}</span>
        <span className="bb-led-score">{started ? game.home.score ?? 0 : ''}</span>
        {side('home')}
      </div>
      {footer}
    </div>
  );
}
