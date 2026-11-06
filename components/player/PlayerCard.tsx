'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeftRight, ChevronDown, Sparkles, X } from 'lucide-react';
import { useData } from '@/lib/DataContext';
import type { Player, PlayerOutlook } from '@/lib/calculator';
import type { CardGame, PlayerCardData } from '@/lib/playerCard';
import { seasonLabel } from '@/lib/playerCard';
import {
  average, goalieGamePoints, heat, matchupStars, seasonRank, skaterGamePoints, summarizeProjection, toiMinutes, writeRead, type Heat,
} from '@/lib/playerCardMetrics';
import { teamColor } from '@/lib/teamColors';
import { pointsScoring, TeamLogo } from '@/components/gamecenter/shared';
import { formatPacific, pacificTime, calendarDay } from '@/lib/time';

const SECTIONS = [
  { id: 'read', label: 'Overview' },
  { id: 'log', label: 'Game log' },
  { id: 'seasons', label: 'Season stats' },
  { id: 'outlook', label: 'Outlook' },
] as const;
type SectionId = (typeof SECTIONS)[number]['id'];

const POSITION_NAMES: Record<string, string> = { L: 'LW', R: 'RW' };
const ordinal = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 >> 3 ^ 1) && n % 10] || 'th'}`;

function Stars({ count }: { count: number }) {
  return (
    <span className="pc-stars" aria-label={`${count} of 5 stars`}>
      {[1, 2, 3, 4, 5].map(i => <span key={i} data-on={i <= count || undefined}>★</span>)}
    </span>
  );
}

function Cell({ value, tone, muted }: { value: React.ReactNode; tone?: Heat; muted?: boolean }) {
  return <td><span className="pc-cell" data-tone={tone} data-muted={muted || undefined}>{value}</span></td>;
}

export default function PlayerCard({ playerId, onClose }: { playerId: string; onClose: () => void }) {
  const { players, projections, myTeam, leagueSettings } = useData();
  const [card, setCard] = useState<PlayerCardData | null>(null);
  const [error, setError] = useState('');
  const [season, setSeason] = useState<number | null>(null);
  const [logLoading, setLogLoading] = useState(false);
  const [active, setActive] = useState<SectionId>('read');
  const [compact, setCompact] = useState(false);
  const [allSeasons, setAllSeasons] = useState(false);
  const [outlook, setOutlook] = useState<PlayerOutlook | null>(null);
  const [outlookState, setOutlookState] = useState<'idle' | 'loading' | 'error'>('idle');
  const scrollRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Partial<Record<SectionId, HTMLElement | null>>>({});

  useEffect(() => {
    let live = true;
    const query = season ? `&season=${season}` : '';
    fetch(`/api/player-card?id=${playerId}${query}`).then(r => r.json()).then(data => {
      if (!live) return;
      if (data.success) { setCard(data.card); setError(''); } else setError(data.error || 'Player unavailable');
    }).catch(() => live && setError('Player unavailable')).finally(() => live && setLogLoading(false));
    return () => { live = false; };
  }, [playerId, season]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);

  const { settings, label: scoringLabel } = pointsScoring(leagueSettings);
  const dataPlayer = players.find(p => p.id === playerId);
  const player: Player | null = useMemo(() => dataPlayer || (card ? {
    id: card.id, name: `${card.firstName} ${card.lastName}`, nhlTeam: card.team, positions: [POSITION_NAMES[card.position] || card.position], isGoalie: card.isGoalie, headshotUrl: card.headshot,
  } : null), [dataPlayer, card]);

  const summary = useMemo(() => (player ? summarizeProjection(player, players, projections, settings) : null), [player, players, projections, settings]);
  const rankSeason = useMemo(() => (player ? seasonRank(player, players, settings) : null), [player, players, settings]);
  const projection = projections.find(p => p.playerId === playerId);
  const onMyTeam = myTeam.some(p => p.id === playerId);

  const games = card?.gameLog || [];
  const isGoalie = card?.isGoalie ?? player?.isGoalie ?? false;
  const fpts = (game: CardGame) => (isGoalie ? goalieGamePoints(game, settings) : skaterGamePoints(game, settings));
  const means = useMemo(() => ({
    fp: average(games.map(fpts)), toi: average(games.map(g => toiMinutes(g.toi))), shots: average(games.map(g => g.shots)),
    points: average(games.map(g => g.points)), goals: average(games.map(g => g.goals)), assists: average(games.map(g => g.assists)), ppp: average(games.map(g => g.ppp)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [games, settings, isGoalie]);

  const next = card?.upcoming[0];
  const opponent = next ? card?.teams[next.opponent] : undefined;
  const stars = matchupStars(opponent, 32, isGoalie);
  const current = card?.seasons[0];
  const viewingCurrent = !card || card.season === card.seasonOptions[0];
  const seasonPpg = current && current.gp ? current.points / current.gp : undefined;
  const read = card && player ? writeRead({
    name: player.name, isGoalie, games: viewingCurrent ? games : [], seasonPpg, projection: summary, next, opponent,
    injury: card.injury.status, backToBacks: projection?.context?.backToBacks,
  }) : '';

  const color = teamColor(card?.team || player?.nhlTeam);
  const position = card ? (POSITION_NAMES[card.position] || card.position) : player?.positions[0];
  const posLabel = player?.positions[0] || position;
  const nextLabel = next ? `${next.home ? 'vs' : '@'} ${next.opponent}` : 'No game';
  const usesHitsOrBlocks = !isGoalie && !!(settings.pointsPerStat?.HIT || settings.pointsPerStat?.BLK);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCompact(el.scrollTop > 150);
    const offset = el.scrollTop + 140;
    let current: SectionId = 'read';
    for (const section of SECTIONS) {
      const node = sectionRefs.current[section.id];
      if (node && node.offsetTop <= offset) current = section.id;
    }
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) current = 'outlook';
    setActive(current);
  };

  const jump = (id: SectionId) => {
    const node = sectionRefs.current[id];
    if (node && scrollRef.current) scrollRef.current.scrollTo({ top: node.offsetTop - 110, behavior: 'smooth' });
  };

  const loadOutlook = async () => {
    if (!dataPlayer) return;
    setOutlookState('loading');
    try {
      const data = await fetch('/api/player-outlook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ player: dataPlayer }) }).then(r => r.json());
      if (data.success) { setOutlook(data.outlook); setOutlookState('idle'); } else setOutlookState('error');
    } catch { setOutlookState('error'); }
  };

  const name = card ? `${card.firstName} ${card.lastName}` : player?.name || 'Player';
  const seasonsShown = allSeasons ? card?.seasons || [] : (card?.seasons || []).slice(0, 4);

  return (
    <div className="pc-backdrop" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        className="pc-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`${name} player card`}
        tabIndex={-1}
        style={{ '--team': color } as React.CSSProperties}
        onMouseDown={e => e.stopPropagation()}
        onKeyDown={event => {
          if (event.key === 'Escape') onClose();
          if (event.key === 'Tab') {
            const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], select');
            if (!controls?.length) return;
            const first = controls[0], last = controls[controls.length - 1];
            if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
          }
        }}
      >
        <button type="button" className="pc-close" onClick={onClose} aria-label="Close player card"><X className="h-5 w-5" /></button>
        <div ref={scrollRef} className="pc-scroll" onScroll={onScroll}>
          {/* Hero */}
          <header className="pc-hero">
            {card?.number !== undefined && <span className="pc-hero-number" aria-hidden>{card.number}</span>}
            <div className="pc-hero-photo">
              {(card?.headshot || player?.headshotUrl) && <img src={card?.headshot || player?.headshotUrl} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
            </div>
            <div className="pc-hero-body">
              <div className="pc-chips">
                {onMyTeam && <span className="pc-chip">On your team</span>}
                {card?.injury.status && <span className="pc-chip pc-chip-alert">{card.injury.status}</span>}
                {projection?.source === 'model' && <span className="pc-chip pc-chip-quiet">Model estimate</span>}
              </div>
              <h2 className="pc-name">{name}</h2>
              <p className="pc-meta">
                <span>{position}{card?.team ? ` - ${card.team}` : ''}</span>
                {card?.number !== undefined && <span>#{card.number}</span>}
                {card?.age !== undefined && <span>Age {card.age}</span>}
                {card?.height && <span>{card.height}{card.weight ? `, ${card.weight} lb` : ''}</span>}
                {card?.shoots && <span>{isGoalie ? 'Catches' : 'Shoots'} {card.shoots}</span>}
              </p>
            </div>
            <Link href="/trades" className="pc-trade" onClick={onClose}><ArrowLeftRight className="h-4 w-4" aria-hidden />Trade</Link>
          </header>
          {/* Arena scoreboard: the four numbers that matter this week */}
          <dl className="bb-board pc-board">
            <div><dt>Proj rank</dt><dd>{summary ? `${posLabel}${summary.rank}` : '–'}</dd></div>
            <div><dt>Next 7 days</dt><dd>{summary ? summary.fp.toFixed(1) : '–'}{summary && <small>FP</small>}</dd></div>
            <div><dt>{nextLabel}{opponent ? ` · ${ordinal(opponent.gaRank)} GA` : ''}</dt><dd>{opponent ? <Stars count={stars} /> : '–'}</dd></div>
            <div><dt>Season rank</dt><dd>{rankSeason ? `${posLabel}${rankSeason}` : '–'}</dd></div>
            <div><dt>Last 5 avg</dt><dd>{viewingCurrent && games.length ? average(games.slice(-5).map(fpts)).toFixed(1) : '–'}{viewingCurrent && games.length > 0 && <small>FP</small>}</dd></div>
          </dl>

          {/* Sticky compact header + tabs */}
          <div className="pc-sticky" data-compact={compact || undefined}>
            <div className="pc-compact" aria-hidden={!compact}>
              {(card?.headshot || player?.headshotUrl) && <img src={card?.headshot || player?.headshotUrl} alt="" />}
              <span className="pc-compact-name">{name}</span>
              <span className="pc-compact-meta">{position} · {card?.team}</span>
            </div>
            <nav className="pc-tabs" aria-label="Player card sections">
              {SECTIONS.map(section => (
                <button key={section.id} type="button" aria-current={active === section.id || undefined} onClick={() => jump(section.id)}>{section.label}</button>
              ))}
            </nav>
          </div>

          {error && <p className="pc-section text-sm text-error">{error}</p>}

          {/* Overview */}
          <section ref={el => { sectionRefs.current.read = el; }} className="pc-section">
            <div className="pc-section-head">
              <h3><Sparkles className="h-5 w-5 text-accent" aria-hidden />Bench Boss read</h3>
              <span className="pc-note">From projections, game logs and standings</span>
            </div>
            {summary ? (
              <div className="pc-meters">
                {summary.meters.map(m => (
                  <div key={m.label} className="pc-meter" data-kind={m.label === 'Bust risk' ? 'risk' : undefined}>
                    <div className="pc-meter-top"><span>{m.label}</span><strong>{m.value}</strong></div>
                    {/* Rink-line gauge: the puck sits at the player's percentile within his position. */}
                    <div className="pc-gauge" aria-hidden><span className="pc-gauge-puck" style={{ left: `${m.share * 100}%` }} /></div>
                    <div className="pc-gauge-scale" aria-hidden><span>Low</span><span>High</span></div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="pc-note">{card ? 'No Bench Boss projection for this player this week.' : 'Loading…'}</p>
            )}
            {read && <p className="pc-read">{read}</p>}
            {viewingCurrent && games.length > 0 && (
              <div className="pc-last5">
                <span>Last {Math.min(5, games.length)}</span>
                {games.slice(-5).map(game => (
                  <span key={game.gameId} className="pc-last5-game" data-tone={heat(fpts(game), means.fp)} title={`${game.date} ${game.home ? 'vs' : '@'} ${game.opponent}`}>
                    <strong>{fpts(game).toFixed(1)}</strong><small>{game.home ? '' : '@'}{game.opponent}</small>
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Game log */}
          <section ref={el => { sectionRefs.current.log = el; }} className="pc-section">
            <div className="pc-section-head">
              <h3>Game log</h3>
              {card && card.seasonOptions.length > 0 && (
                <label className="pc-select">
                  <span className="sr-only">Season</span>
                  <select value={card.season} onChange={e => { setLogLoading(true); setSeason(Number(e.target.value)); }}>
                    {card.seasonOptions.map(s => <option key={s} value={s}>{seasonLabel(s)}</option>)}
                  </select>
                  <ChevronDown className="h-4 w-4" aria-hidden />
                </label>
              )}
            </div>
            <div className="pc-table-wrap" data-loading={logLoading || undefined}>
              {!card ? <div className="pc-skeleton" /> : games.length === 0 ? <p className="pc-note">No NHL games this season.</p> : (
                <table className="pc-table">
                  <thead>
                    <tr className="pc-groups"><th colSpan={3} /><th colSpan={isGoalie ? 2 : 3}>Fantasy</th><th colSpan={isGoalie ? 4 : 7}>{isGoalie ? 'Goaltending' : 'Scoring'}</th></tr>
                    <tr>
                      <th>GM</th><th>Date</th><th>Opp</th>
                      <th>FPTS</th><th>TOI</th>{!isGoalie && <th>SH</th>}
                      {isGoalie ? <><th>DEC</th><th>SA</th><th>GA</th><th>SV%</th></> : <><th>G</th><th>A</th><th>PTS</th><th>+/-</th><th>PPP</th><th>SOG</th><th>PIM</th></>}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Newest game first; GM keeps the season game number. */}
                    {[...games].reverse().map((game, index) => {
                      const fp = fpts(game);
                      return (
                        <tr key={game.gameId}>
                          <td className="pc-dim">{games.length - index}</td>
                          <td className="pc-dim">{calendarDay(game.date, { month: 'short', day: 'numeric' })}</td>
                          <td className="pc-opp"><span><TeamLogo team={{ abbrev: game.opponent }} size={18} />{game.home ? '' : '@'}{game.opponent}</span></td>
                          <Cell value={fp.toFixed(1)} tone={heat(fp, means.fp)} />
                          <Cell value={game.toi ?? '–'} tone={heat(toiMinutes(game.toi), means.toi)} />
                          {!isGoalie && <Cell value={game.shifts ?? '–'} muted />}
                          {isGoalie ? <>
                            <Cell value={game.decision ?? '–'} tone={game.decision === 'W' ? 'good' : game.decision ? 'bad' : undefined} />
                            <Cell value={game.shotsAgainst ?? '–'} muted />
                            <Cell value={game.goalsAgainst ?? '–'} tone={game.goalsAgainst === undefined ? undefined : game.goalsAgainst <= 1 ? 'good' : game.goalsAgainst >= 4 ? 'bad' : undefined} />
                            <Cell value={game.savePct !== undefined ? game.savePct.toFixed(3).replace(/^0/, '') : '–'} tone={game.savePct === undefined ? undefined : game.savePct >= 0.93 ? 'good' : game.savePct < 0.88 ? 'bad' : undefined} />
                          </> : <>
                            <Cell value={game.goals} tone={heat(game.goals, means.goals, 'count')} />
                            <Cell value={game.assists} tone={heat(game.assists, means.assists, 'count')} />
                            <Cell value={game.points} tone={heat(game.points, means.points)} />
                            <Cell value={game.plusMinus > 0 ? `+${game.plusMinus}` : game.plusMinus} tone={heat(game.plusMinus, 0, 'signed')} />
                            <Cell value={game.ppp} tone={heat(game.ppp, means.ppp, 'count')} />
                            <Cell value={game.shots} tone={heat(game.shots, means.shots)} />
                            <Cell value={game.pim} muted />
                          </>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <p className="pc-note mt-3">FPTS uses {scoringLabel}{usesHitsOrBlocks ? '; NHL game logs have no hits or blocks, so per-game FPTS leaves them out' : ''}. Cells are coloured against his own per-game average.</p>
          </section>

          {/* Season stats */}
          <section ref={el => { sectionRefs.current.seasons = el; }} className="pc-section">
            <div className="pc-section-head"><h3>Season stats</h3><span className="pc-note">NHL regular season</span></div>
            <div className="pc-table-wrap">
              {!card ? <div className="pc-skeleton" /> : (
                <table className="pc-table">
                  <thead>
                    <tr>
                      <th>Year</th><th>Team</th><th>GP</th>
                      {isGoalie ? <><th>W</th><th>L</th><th>GAA</th><th>SV%</th><th>SO</th></> : <><th>G</th><th>A</th><th>PTS</th><th>+/-</th><th>PPP</th><th>SOG</th><th>PIM</th><th>TOI</th></>}
                    </tr>
                  </thead>
                  <tbody>
                    {seasonsShown.map(row => (
                      <tr key={`${row.season}${row.team}`}>
                        <Cell value={`'${String(row.season).slice(6)}`} />
                        <Cell value={<span className="inline-flex items-center gap-1.5">{row.team === card.teamName && <TeamLogo team={{ abbrev: card.team }} size={16} />}{row.team.split(' ').slice(-1)[0]}</span>} />
                        <Cell value={row.gp} />
                        {isGoalie ? <>
                          <Cell value={row.wins ?? '–'} /><Cell value={row.losses ?? '–'} /><Cell value={row.gaa?.toFixed(2) ?? '–'} />
                          <Cell value={row.savePct?.toFixed(3).replace(/^0/, '') ?? '–'} /><Cell value={row.shutouts ?? '–'} />
                        </> : <>
                          <Cell value={row.goals} /><Cell value={row.assists} /><Cell value={row.points} />
                          <Cell value={row.plusMinus > 0 ? `+${row.plusMinus}` : row.plusMinus} /><Cell value={row.ppp} /><Cell value={row.shots} /><Cell value={row.pim} /><Cell value={row.avgToi ?? '–'} />
                        </>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {card && card.seasons.length > 4 && (
              <button type="button" className="pc-more" onClick={() => setAllSeasons(v => !v)}>{allSeasons ? 'Show fewer seasons' : `View all ${card.seasons.length} seasons`}</button>
            )}
          </section>

          {/* Outlook */}
          <section ref={el => { sectionRefs.current.outlook = el; }} className="pc-section">
            <div className="pc-section-head">
              <h3>Outlook</h3>
              <Link href="/lineup" className="pc-outline-button" onClick={onClose}>Optimize your lineup</Link>
            </div>
            {next && card ? (
              <div className="pc-matchup">
                {(() => {
                  const away = next.home ? next.opponent : card.team;
                  const home = next.home ? card.team : next.opponent;
                  const side = (abbrev: string, label: string) => (
                    <div className="pc-faceoff-team" style={{ '--side': teamColor(abbrev) } as React.CSSProperties}>
                      <TeamLogo team={{ abbrev }} size={64} />
                      <strong>{card.teams[abbrev]?.name || abbrev}</strong>
                      <small>{label}{abbrev !== card.team && card.teams[abbrev] ? ` · ${card.teams[abbrev].gaPerGame.toFixed(2)} GA/gm` : ''}</small>
                    </div>
                  );
                  return (
                    <div className="pc-faceoff">
                      {side(away, 'Away')}
                      <div className="pc-faceoff-dot" aria-label={`Puck drop ${formatPacific(next.startTimeUTC, { dateStyle: 'medium', timeStyle: 'short' })} PT`}>
                        <span>{formatPacific(next.startTimeUTC, { weekday: 'short' })}</span>
                        <strong>{pacificTime(next.startTimeUTC)}</strong>
                        <span>{formatPacific(next.startTimeUTC, { month: 'short', day: 'numeric' })}</span>
                      </div>
                      {side(home, 'Home')}
                    </div>
                  );
                })()}
                <dl className="pc-matchup-stats">
                  <div><dd>{summary ? `${posLabel}${summary.rank}` : '–'}</dd><dt>Proj rank</dt></div>
                  <div><dd>{summary ? summary.perGame.toFixed(1) : '–'}</dd><dt>Proj FP / game</dt></div>
                  <div><dd><Stars count={stars} /></dd><dt>Matchup</dt></div>
                  <div><dd className="text-success">{opponent ? opponent.gaPerGame.toFixed(2) : '–'}</dd><dt>Opp GA / game</dt></div>
                </dl>
                {card.upcoming.length > 1 && (
                  <ul className="pc-upcoming">
                    {card.upcoming.slice(1, 7).map(game => {
                      const opp = card.teams[game.opponent];
                      return (
                        <li key={game.gameId}>
                          <span className="pc-dim">{calendarDay(game.date, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                          <span className="inline-flex items-center gap-2 font-semibold"><TeamLogo team={{ abbrev: game.opponent }} size={20} />{game.home ? 'vs' : '@'} {game.opponent}</span>
                          <Stars count={matchupStars(opp, 32, isGoalie)} />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : <p className="pc-note">{card ? 'No upcoming games on the schedule.' : 'Loading…'}</p>}

            <div className="pc-outlook">
              <div className="pc-section-head"><h4>Player outlook</h4>{dataPlayer && !outlook && <button type="button" className="pc-outline-button" onClick={loadOutlook} disabled={outlookState === 'loading'}>{outlookState === 'loading' ? 'Writing…' : 'Generate'}</button>}</div>
              {!dataPlayer && <p className="pc-note">Player outlooks are available for players in the Bench Boss player pool.</p>}
              {outlookState === 'error' && <p className="text-sm text-error">Couldn’t write an outlook right now. Try again.</p>}
              {outlook && (
                <div className="space-y-3 text-sm leading-relaxed text-ink-2">
                  <p className="flex flex-wrap gap-2"><span className="pc-chip pc-chip-quiet">{outlook.fantasyValue}</span><span className="pc-chip pc-chip-quiet">{outlook.trend}</span><span className="pc-chip pc-chip-quiet">Injury risk: {outlook.injuryRisk}</span></p>
                  <p>{outlook.summary}</p>
                  <p>{outlook.restOfSeasonProjection}</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
