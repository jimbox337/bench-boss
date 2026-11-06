'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import type { LeagueSettings } from '@/lib/calculator';
import { goalieFantasyPoints, onIceAtPlay, skaterFantasyPoints, type GameDetail, type PlayEvent, type PlayerShift, type SkaterLine } from '@/lib/nhlGameCenter';
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

function PlayerRail({ detail, team, settings, onIce, play }: { detail: GameDetail; team: GameDetail['game'][Side]; settings: LeagueSettings; onIce: PlayerShift[]; play?: PlayEvent }) {
  const exact = onIce.length > 0;
  const skaters = exact ? onIce.flatMap(shift => {
    const player = detail.skaters.find(row => row.playerId === shift.playerId);
    return player ? [{ id: player.playerId, name: player.name, position: player.position, toi: player.toi, fp: skaterFantasyPoints(player, settings) ?? 0 }] : [];
  }) : iceLeaders(detail.skaters, team.abbrev).map(player => ({ id: player.playerId, name: player.name, position: player.position, toi: player.toi, fp: skaterFantasyPoints(player, settings) ?? 0 }));
  const goalies = exact ? onIce.flatMap(shift => {
    const goalie = detail.goalies.find(row => row.playerId === shift.playerId);
    return goalie ? [{ id: goalie.playerId, name: goalie.name, position: 'G', toi: goalie.toi, fp: goalieFantasyPoints(goalie, settings) ?? 0 }] : [];
  }) : [];
  const players = [...skaters, ...goalies].slice(0, 6);
  return (
    <section className="icecast-roster" aria-label={`${team.name} ${exact ? 'players on ice' : 'ice-time leaders'}`}>
      <header>
        <TeamLogo team={team} size={34} />
        <span><strong>{team.name}</strong><small>{exact ? `On ice · ${play?.time}` : 'Ice-time leaders'}</small></span>
      </header>
      {players.length ? <ol>{players.map(player => (
        <li key={player.id}>
          <span className="icecast-number" style={{ '--club': teamColor(team.abbrev) } as React.CSSProperties}>{player.position}</span>
          <span className="icecast-name"><PlayerLink id={player.id}>{player.name}</PlayerLink><small>{player.position} · {player.toi}</small></span>
          <span className="icecast-fp">{player.fp.toFixed(1)}<small>FP</small></span>
        </li>
      ))}</ol> : <p className="icecast-empty">Shift data appears after puck drop.</p>}
    </section>
  );
}

function IceSurface({ play, replay, away, home }: { play?: PlayEvent; replay: number; away: string; home: string }) {
  const rinkRef = useRef<HTMLDivElement>(null);
  const puckRef = useRef<HTMLSpanElement>(null);
  const previous = useRef({ x: 50, y: 50 });
  const x = Math.max(6, Math.min(94, ((play?.x ?? 0) + 100) / 2));
  const y = Math.max(9, Math.min(91, ((play?.y ?? 0) + 42.5) / 0.85));
  const dots = [
    [19, 31, away], [31, 65, away], [43, 39, away],
    [57, 61, home], [69, 35, home], [81, 69, home],
  ] as const;

  useEffect(() => {
    const rink = rinkRef.current;
    const puck = puckRef.current;
    if (!rink || !puck || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      previous.current = { x, y };
      return;
    }
    const dx = ((previous.current.x - x) / 100) * rink.clientWidth;
    const dy = ((previous.current.y - y) / 100) * rink.clientHeight;
    puck.animate([
      { transform: `translate(-50%, -50%) translate3d(${dx}px, ${dy}px, 0) scale(.72)`, opacity: .45 },
      { transform: 'translate(-50%, -50%) translate3d(0, 0, 0) scale(1)', opacity: 1 },
    ], { duration: 720, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' });
    rink.querySelectorAll<HTMLElement>('.icecast-skater').forEach((skater, index) => {
      const drift = (index % 2 ? 1 : -1) * Math.min(18, Math.abs(dx) * .08 + 5);
      skater.animate([
        { transform: `translate(-50%, -50%) translate3d(${drift}px, ${-drift * .35}px, 0)`, opacity: .65 },
        { transform: 'translate(-50%, -50%) translate3d(0, 0, 0)', opacity: 1 },
      ], { duration: 520 + index * 35, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' });
    });
    previous.current = { x, y };
  }, [play?.id, replay, x, y]);

  return (
    <div ref={rinkRef} className="icecast-rink" aria-label={play ? `Rink location for ${play.text}` : 'Hockey rink waiting for play data'}>
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
      <span ref={puckRef} className="icecast-puck" style={{ left: `${x}%`, top: `${y}%` } as React.CSSProperties} aria-hidden />
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
  const officialOnIce = play ? onIceAtPlay(detail.shifts || [], play) : [];
  const awayOnIce = officialOnIce.filter(shift => shift.team === game.away.abbrev);
  const homeOnIce = officialOnIce.filter(shift => shift.team === game.home.abbrev);

  return (
    <section className="icecast" aria-labelledby="icecast-title">
      <header className="icecast-bar">
        <span className="icecast-title"><h2 id="icecast-title">Live ice</h2><small>{game.isLive ? 'Gamecast tracking' : game.isFinal ? 'Game replay' : 'Pregame view'}</small></span>
        <span className="icecast-status" data-live={game.isLive || undefined}>{game.isLive ? `${game.clock || ''} · ${game.periodType === 'OT' ? 'OT' : `Period ${game.period || 1}`}` : game.isFinal ? 'Final' : 'Not started'}</span>
      </header>

      <div className="icecast-layout">
        <PlayerRail detail={detail} team={game.away} settings={settings} onIce={awayOnIce} play={play} />
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
        <PlayerRail detail={detail} team={game.home} settings={settings} onIce={homeOnIce} play={play} />
      </div>
    </section>
  );
}
