'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import type { LeagueSettings } from '@/lib/calculator';
import { skaterFantasyPoints, type GameDetail, type PlayEvent, type SkaterLine } from '@/lib/nhlGameCenter';
import { teamColor } from '@/lib/teamColors';
import { PlayerLink } from '@/components/player/PlayerCardProvider';
import { TeamLogo } from './shared';
import './live-ice-gamecast.css';

type Side = 'away' | 'home';

function seconds(toi: string) {
  const [minutes = '0', remaining = '0'] = toi.split(':');
  return Number(minutes) * 60 + Number(remaining);
}

function iceLeaders(rows: SkaterLine[], team: string) {
  return rows.filter(row => row.team === team).sort((a, b) => seconds(b.toi) - seconds(a.toi)).slice(0, 5);
}

function PlayerRail({ rows, team, settings }: { rows: SkaterLine[]; team: GameDetail['game'][Side]; settings: LeagueSettings }) {
  const players = iceLeaders(rows, team.abbrev);
  return (
    <section className="icecast-roster" aria-label={`${team.name} ice-time leaders`}>
      <header>
        <TeamLogo team={team} size={34} />
        <span><strong>{team.name}</strong><small>Ice-time leaders</small></span>
      </header>
      {players.length ? <ol>{players.map(player => (
        <li key={player.playerId}>
          <span className="icecast-number" style={{ '--club': teamColor(team.abbrev) } as React.CSSProperties}>{player.number ?? player.position}</span>
          <span className="icecast-name"><PlayerLink id={player.playerId}>{player.name}</PlayerLink><small>{player.position} · {player.toi}</small></span>
          <span className="icecast-fp">{(skaterFantasyPoints(player, settings) ?? 0).toFixed(1)}<small>FP</small></span>
        </li>
      ))}</ol> : <p className="icecast-empty">Shift data appears after puck drop.</p>}
    </section>
  );
}

function IceSurface({ play, replay, away, home }: { play?: PlayEvent; replay: number; away: string; home: string }) {
  const x = Math.max(6, Math.min(94, ((play?.x ?? 0) + 100) / 2));
  const y = Math.max(9, Math.min(91, ((play?.y ?? 0) + 42.5) / 0.85));
  const dots = [
    [19, 31, away], [31, 65, away], [43, 39, away],
    [57, 61, home], [69, 35, home], [81, 69, home],
  ] as const;
  return (
    <div className="icecast-rink" aria-label={play ? `Rink location for ${play.text}` : 'Hockey rink waiting for play data'}>
      <span className="icecast-line icecast-line--center" aria-hidden />
      <span className="icecast-line icecast-line--left" aria-hidden />
      <span className="icecast-line icecast-line--right" aria-hidden />
      <span className="icecast-circle icecast-circle--center" aria-hidden />
      <span className="icecast-circle icecast-circle--one" aria-hidden />
      <span className="icecast-circle icecast-circle--two" aria-hidden />
      <span className="icecast-circle icecast-circle--three" aria-hidden />
      <span className="icecast-circle icecast-circle--four" aria-hidden />
      <span className="icecast-crease icecast-crease--left" aria-hidden />
      <span className="icecast-crease icecast-crease--right" aria-hidden />
      {dots.map(([left, top, club], index) => <span key={`${replay}-${left}`} className="icecast-skater" style={{ left: `${left}%`, top: `${top}%`, '--club': teamColor(club), '--delay': `${index * 45}ms` } as React.CSSProperties} aria-hidden />)}
      <span key={`puck-${replay}`} className="icecast-puck" style={{ left: `${x}%`, top: `${y}%` } as React.CSSProperties} aria-hidden />
      {play && <span key={`signal-${replay}`} className="icecast-signal" style={{ left: `${x}%`, top: `${y}%`, '--club': teamColor(play.team || away) } as React.CSSProperties} aria-hidden />}
    </div>
  );
}

export default function LiveIceGamecast({ detail, settings }: { detail: GameDetail; settings: LeagueSettings }) {
  const events = useMemo(() => detail.plays.filter(play => play.kind !== 'period' && play.kind !== 'stoppage').slice(-12), [detail.plays]);
  const [offset, setOffset] = useState(0);
  const [replay, setReplay] = useState(0);
  const index = Math.max(0, events.length - 1 - offset);
  const play = events[index];
  const game = detail.game;

  return (
    <section className="icecast" aria-labelledby="icecast-title">
      <header className="icecast-bar">
        <span className="icecast-title"><h2 id="icecast-title">Live ice</h2><small>{game.isLive ? 'Gamecast tracking' : game.isFinal ? 'Game replay' : 'Pregame view'}</small></span>
        <span className="icecast-status" data-live={game.isLive || undefined}>{game.isLive ? `${game.clock || ''} · ${game.periodType === 'OT' ? 'OT' : `Period ${game.period || 1}`}` : game.isFinal ? 'Final' : 'Not started'}</span>
      </header>

      <div className="icecast-layout">
        <PlayerRail rows={detail.skaters} team={game.away} settings={settings} />
        <div className="icecast-stage">
          <div className="icecast-call" style={{ '--club': teamColor(play?.team || game.away.abbrev) } as React.CSSProperties}>
            <span>{play?.kind || 'Pregame'}</span>
            <strong>{play?.text || 'The rink activates when play begins.'}</strong>
            <small>{play ? `${play.time} · ${play.period === 'SO' ? 'Shootout' : `Period ${play.period}`}` : 'Waiting for NHL play data'}</small>
          </div>
          <IceSurface play={play} replay={replay} away={game.away.abbrev} home={game.home.abbrev} />
          <div className="icecast-controls">
            <button type="button" onClick={() => setOffset(value => Math.min(events.length - 1, value + 1))} disabled={!events.length || offset >= events.length - 1} aria-label="Previous play"><ChevronLeft aria-hidden /></button>
            <button type="button" onClick={() => setReplay(value => value + 1)} disabled={!play}><RotateCcw aria-hidden />Replay play</button>
            <button type="button" onClick={() => setOffset(value => Math.max(0, value - 1))} disabled={!events.length || offset === 0} aria-label="Next play"><ChevronRight aria-hidden /></button>
            <span aria-live="polite">{events.length ? `${index + 1} of ${events.length}${offset === 0 ? ' · Latest' : ''}` : 'No plays yet'}</span>
          </div>
        </div>
        <PlayerRail rows={detail.skaters} team={game.home} settings={settings} />
      </div>
    </section>
  );
}
