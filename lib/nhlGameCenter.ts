/**
 * NHL game center data: scoreboard, game detail, teams and standings.
 * All data comes from the public NHL web API. Normalizers are pure functions so they
 * can be unit tested; fetchers are thin and cached with Next's data cache.
 */
import type { LeagueSettings } from './calculator';
import { getStartingGoalies, type TeamStarter } from './goalieStarters';

const NHL_WEB = 'https://api-web.nhle.com/v1';

type Localized = { default?: string } | undefined;
const text = (value: Localized | string | undefined): string => (typeof value === 'string' ? value : value?.default || '');

export type PeriodKey = string; // '1', '2', '3', 'OT', 'SO'

export type TeamSide = {
  id?: number;
  abbrev: string;
  name: string;
  city?: string;
  logo?: string;
  score?: number;
  sog?: number;
  record?: string;
};

export type GoalEvent = {
  period: PeriodKey;
  time: string;
  team: string;
  scorerId: number;
  scorer: string;
  goalsToDate?: number;
  assists: { playerId: number; name: string }[];
  strength: 'ev' | 'pp' | 'sh' | string;
  modifier?: string;
  awayScore?: number;
  homeScore?: number;
};

export type ScoreboardGame = {
  id: number;
  gameDate: string;
  startTimeUTC: string;
  state: string;
  isLive: boolean;
  isFinal: boolean;
  period?: number;
  periodType?: string;
  clock?: string;
  inIntermission?: boolean;
  away: TeamSide;
  home: TeamSide;
  lineScore: { periods: PeriodKey[]; away: number[]; home: number[] };
  goals: GoalEvent[];
  broadcasts: string[];
  venue?: string;
};

export const LIVE_STATES = new Set(['LIVE', 'CRIT']);
export const FINAL_STATES = new Set(['FINAL', 'OFF']);

export function periodLabel(number?: number, type?: string): PeriodKey {
  if (type === 'SO') return 'SO';
  if (type === 'OT' || (number && number > 3)) return number && number > 4 ? `${number - 3}OT` : 'OT';
  return String(number || 1);
}

/** Period-by-period goals derived from the goal list; always shows periods 1-3. */
export function deriveLineScore(goals: GoalEvent[], awayAbbrev: string, homeAbbrev: string, currentPeriod?: PeriodKey) {
  const periods: PeriodKey[] = ['1', '2', '3'];
  for (const key of [...goals.map(goal => goal.period), currentPeriod].filter((p): p is PeriodKey => !!p)) {
    if (!periods.includes(key)) periods.push(key);
  }
  const away = periods.map(p => goals.filter(goal => goal.period === p && goal.team === awayAbbrev).length);
  const home = periods.map(p => goals.filter(goal => goal.period === p && goal.team === homeAbbrev).length);
  return { periods, away, home };
}

type RawGoal = {
  period?: number;
  periodDescriptor?: { number?: number; periodType?: string };
  timeInPeriod?: string;
  playerId: number;
  name?: Localized;
  firstName?: Localized;
  lastName?: Localized;
  teamAbbrev?: Localized | string;
  goalsToDate?: number;
  assists?: { playerId: number; name?: Localized; firstName?: Localized; lastName?: Localized }[];
  strength?: string;
  goalModifier?: string;
  awayScore?: number;
  homeScore?: number;
};

export function normalizeGoal(raw: RawGoal, periodOverride?: { number?: number; periodType?: string }): GoalEvent {
  const descriptor = periodOverride || raw.periodDescriptor || { number: raw.period };
  return {
    period: periodLabel(descriptor.number, descriptor.periodType),
    time: raw.timeInPeriod || '',
    team: text(raw.teamAbbrev),
    scorerId: raw.playerId,
    scorer: text(raw.name) || `${text(raw.firstName)} ${text(raw.lastName)}`.trim(),
    goalsToDate: raw.goalsToDate,
    assists: (raw.assists || []).map(a => ({ playerId: a.playerId, name: text(a.name) || `${text(a.firstName)} ${text(a.lastName)}`.trim() })),
    strength: raw.strength || 'ev',
    modifier: raw.goalModifier && raw.goalModifier !== 'none' ? raw.goalModifier : undefined,
    awayScore: raw.awayScore,
    homeScore: raw.homeScore,
  };
}

type RawTeam = { id?: number; abbrev: string; score?: number; sog?: number; logo?: string; name?: Localized; commonName?: Localized; placeName?: Localized; record?: string };

function normalizeTeam(raw: RawTeam): TeamSide {
  return { id: raw.id, abbrev: raw.abbrev, name: text(raw.commonName) || text(raw.name) || raw.abbrev, city: text(raw.placeName) || undefined, logo: raw.logo, score: raw.score, sog: raw.sog, record: raw.record };
}

export type RawScoreGame = {
  id: number;
  gameDate: string;
  startTimeUTC: string;
  gameState: string;
  period?: number;
  periodDescriptor?: { number?: number; periodType?: string };
  clock?: { timeRemaining?: string; inIntermission?: boolean };
  awayTeam: RawTeam;
  homeTeam: RawTeam;
  goals?: RawGoal[];
  tvBroadcasts?: { network?: string; countryCode?: string }[];
  venue?: Localized;
};

export function normalizeScoreGame(raw: RawScoreGame): ScoreboardGame {
  const goals = (raw.goals || []).map(goal => normalizeGoal(goal));
  const isLive = LIVE_STATES.has(raw.gameState);
  const isFinal = FINAL_STATES.has(raw.gameState);
  const current = isLive || isFinal ? periodLabel(raw.periodDescriptor?.number ?? raw.period, raw.periodDescriptor?.periodType) : undefined;
  return {
    id: raw.id,
    gameDate: raw.gameDate,
    startTimeUTC: raw.startTimeUTC,
    state: raw.gameState,
    isLive,
    isFinal,
    period: raw.periodDescriptor?.number ?? raw.period,
    periodType: raw.periodDescriptor?.periodType,
    clock: raw.clock?.timeRemaining,
    inIntermission: raw.clock?.inIntermission,
    away: normalizeTeam(raw.awayTeam),
    home: normalizeTeam(raw.homeTeam),
    lineScore: deriveLineScore(goals.filter(goal => goal.period !== 'SO'), raw.awayTeam.abbrev, raw.homeTeam.abbrev, current === 'SO' ? undefined : current),
    goals,
    broadcasts: [...new Set((raw.tvBroadcasts || []).filter(b => b.countryCode === 'US' || b.countryCode === 'CA').map(b => b.network || ''))].filter(Boolean),
    venue: text(raw.venue) || undefined,
  };
}

/** Most relevant game right now: live with your players, any live, next to start, latest final. */
export function pickFeatured(games: ScoreboardGame[], myTeams: Set<string>): { game: ScoreboardGame; reason: string } | null {
  const mine = (g: ScoreboardGame) => myTeams.has(g.away.abbrev) || myTeams.has(g.home.abbrev);
  const live = games.filter(g => g.isLive);
  const upcoming = games.filter(g => !g.isLive && !g.isFinal).sort((a, b) => a.startTimeUTC.localeCompare(b.startTimeUTC));
  const final = games.filter(g => g.isFinal);
  const choice =
    (live.find(mine) && { game: live.find(mine)!, reason: 'Live with your players' }) ||
    (live[0] && { game: live[0], reason: 'Live now' }) ||
    (upcoming.find(mine) && { game: upcoming.find(mine)!, reason: 'Your players next' }) ||
    (upcoming[0] && { game: upcoming[0], reason: 'Next up' }) ||
    (final.at(-1) && { game: final.at(-1)!, reason: 'Final' });
  return choice || null;
}

// ------------------------------------------------------------------------------------
// Box score + fantasy points
// ------------------------------------------------------------------------------------

export type SkaterLine = {
  playerId: number; team: string; name: string; number?: number; position: string;
  goals: number; assists: number; points: number; plusMinus: number; pim: number; hits: number;
  ppGoals: number; ppPoints: number; sog: number; blocks: number; toi: string;
};

export type GoalieLine = {
  playerId: number; team: string; name: string; number?: number;
  saves: number; shotsAgainst: number; goalsAgainst: number; savePct?: number; toi: string;
  decision?: 'W' | 'L' | 'O'; shutout: boolean;
};

/** Power-play points per player from the scoring summary (box scores only list PP goals). */
export function powerPlayPoints(goals: GoalEvent[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const goal of goals.filter(g => g.strength === 'pp')) {
    for (const id of [goal.scorerId, ...goal.assists.map(a => a.playerId)]) counts.set(id, (counts.get(id) || 0) + 1);
  }
  return counts;
}

export function skaterFantasyPoints(line: SkaterLine, settings: LeagueSettings): number | null {
  const weights = settings.pointsPerStat;
  if (settings.scoringType !== 'H2H_Points' || !weights) return null;
  const total = line.goals * (weights.G || 0) + line.assists * (weights.A || 0) + line.points * (weights.PTS || 0)
    + line.plusMinus * (weights.plusMinus || 0) + line.ppPoints * (weights.PPP || 0) + line.sog * (weights.SOG || 0)
    + line.hits * (weights.HIT || 0) + line.blocks * (weights.BLK || 0) + line.pim * (weights.PIM || 0);
  return Math.round(total * 10) / 10;
}

export function goalieFantasyPoints(line: GoalieLine, settings: LeagueSettings): number | null {
  const weights = settings.pointsPerStat;
  if (settings.scoringType !== 'H2H_Points' || !weights) return null;
  const total = (line.decision === 'W' ? weights.W || 0 : 0) + line.saves * (weights.SV || 0)
    + line.goalsAgainst * (weights.GA || 0) + (line.shutout ? weights.SO || 0 : 0);
  return Math.round(total * 10) / 10;
}

// ------------------------------------------------------------------------------------
// Play-by-play
// ------------------------------------------------------------------------------------

export type PlayKind = 'goal' | 'shot' | 'miss' | 'block' | 'hit' | 'penalty' | 'faceoff' | 'giveaway' | 'takeaway' | 'stoppage' | 'period';
export type ShotResult = 'goal' | 'shot' | 'miss' | 'block';
export type ShotStrength = 'EV' | 'PP' | 'SH' | 'EN';
/**
 * A shot attempt in a fixed orientation: the home team always attacks the right net (x > 0)
 * and the away team the left, whatever end they played that period. Feet, rink centre 0,0.
 */
export type ShotInfo = {
  result: ShotResult; team: string; shooterId?: number; shooter: string; goalie?: string; blocker?: string;
  shotType?: string; reason?: string; strength: ShotStrength; x: number; y: number;
};
export type PlayEvent = { id: number; period: PeriodKey; time: string; kind: PlayKind; team?: string; text: string; score?: string; x?: number; y?: number; shot?: ShotInfo };

export type PlayerShift = {
  playerId: number;
  team: string;
  period: number;
  start: string;
  end: string;
  firstName?: string;
  lastName?: string;
};

type RawShift = {
  playerId?: number;
  teamAbbrev?: string;
  period?: number;
  startTime?: string;
  endTime?: string;
  firstName?: string;
  lastName?: string;
};

export function normalizeShifts(rows: RawShift[]): PlayerShift[] {
  return rows.flatMap(row => row.playerId && row.teamAbbrev && row.period && row.startTime && row.endTime ? [{
    playerId: row.playerId,
    team: row.teamAbbrev,
    period: row.period,
    start: row.startTime,
    end: row.endTime,
    firstName: row.firstName,
    lastName: row.lastName,
  }] : []);
}

function elapsedSeconds(value: string): number {
  const [minutes = '0', seconds = '0'] = value.split(':');
  return Number(minutes) * 60 + Number(seconds);
}

/** Official shift-chart players whose shift contains this play timestamp. */
export function onIceAtPlay(shifts: PlayerShift[], play: Pick<PlayEvent, 'period' | 'time'>): PlayerShift[] {
  const period = Number(play.period);
  if (!Number.isFinite(period)) return [];
  const at = elapsedSeconds(play.time);
  return shifts.filter(shift => shift.period === period && elapsedSeconds(shift.start) <= at && elapsedSeconds(shift.end) >= at);
}

/** Strength for the shooting side from the NHL situation code (away goalie, away skaters, home skaters, home goalie). */
export function shotStrength(code: string | undefined, shooterIsHome: boolean): ShotStrength {
  if (!code || !/^\d{4}$/.test(code)) return 'EV';
  const [awayGoalie, awaySkaters, homeSkaters, homeGoalie] = code.split('').map(Number);
  const own = shooterIsHome ? homeSkaters : awaySkaters;
  const opp = shooterIsHome ? awaySkaters : homeSkaters;
  if ((shooterIsHome ? awayGoalie : homeGoalie) === 0) return 'EN';
  return own > opp ? 'PP' : own < opp ? 'SH' : 'EV';
}

/** Distance in feet from a normalized shot to the net it attacks (goal line at x = ±89). */
export function shotDistance(shot: Pick<ShotInfo, 'x' | 'y'>, attacksRight: boolean): number {
  return Math.hypot((attacksRight ? 89 : -89) - shot.x, shot.y);
}

type RawPlay = {
  eventId: number; sortOrder?: number; typeDescKey: string; timeInPeriod?: string; situationCode?: string; homeTeamDefendingSide?: string;
  periodDescriptor?: { number?: number; periodType?: string };
  details?: Record<string, string | number | undefined>;
};
type RawRosterSpot = { teamId: number; playerId: number; firstName?: Localized; lastName?: Localized };

const KIND: Record<string, PlayKind> = {
  goal: 'goal', 'shot-on-goal': 'shot', 'missed-shot': 'miss', 'blocked-shot': 'block', hit: 'hit', penalty: 'penalty',
  faceoff: 'faceoff', giveaway: 'giveaway', takeaway: 'takeaway', stoppage: 'stoppage', 'period-start': 'period', 'period-end': 'period',
};
const human = (value: unknown) => String(value || '').replace(/-/g, ' ');

/** Turn the NHL play-by-play into readable events (oldest first). Unknown event types are skipped. */
export function normalizePlayByPlay(payload: { plays?: RawPlay[]; rosterSpots?: RawRosterSpot[]; homeTeam?: { id?: number } } | null, teams: Record<number, string>, homeId?: number): PlayEvent[] {
  const home = homeId ?? payload?.homeTeam?.id;
  const otherTeam = (id: unknown) => Object.entries(teams).find(([key]) => Number(key) !== id)?.[1];
  const names = new Map((payload?.rosterSpots || []).map(spot => [spot.playerId, `${text(spot.firstName).charAt(0)}. ${text(spot.lastName)}`.trim()]));
  const who = (id: unknown) => (typeof id === 'number' ? names.get(id) || `#${id}` : 'Unknown');
  const events: PlayEvent[] = [];
  const plays = [...(payload?.plays || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  for (const play of plays) {
    const kind = KIND[play.typeDescKey];
    if (!kind) continue;
    const d = play.details || {};
    const period = periodLabel(play.periodDescriptor?.number, play.periodDescriptor?.periodType);
    const team = typeof d.eventOwnerTeamId === 'number' ? teams[d.eventOwnerTeamId] : undefined;
    const periodName = period === '1' ? '1st' : period === '2' ? '2nd' : period === '3' ? '3rd' : period;
    let line = '';
    let score: string | undefined;
    switch (kind) {
      case 'goal': {
        const assists = [d.assist1PlayerId, d.assist2PlayerId].filter(id => typeof id === 'number').map(who);
        line = `Goal: ${who(d.scoringPlayerId)}${d.scoringPlayerTotal ? ` (${d.scoringPlayerTotal})` : ''}${d.shotType ? `, ${human(d.shotType)}` : ''}. ${assists.length ? `Assists: ${assists.join(', ')}` : 'Unassisted'}`;
        score = `${d.awayScore ?? 0}–${d.homeScore ?? 0}`;
        break;
      }
      case 'shot': line = `${who(d.shootingPlayerId)} shot on goal${d.shotType ? ` (${human(d.shotType)})` : ''}, saved by ${who(d.goalieInNetId)}`; break;
      case 'miss': line = `${who(d.shootingPlayerId)} missed${d.reason ? `: ${human(d.reason)}` : ''}`; break;
      case 'block': line = `${who(d.blockingPlayerId)} blocked a shot by ${who(d.shootingPlayerId)}`; break;
      case 'hit': line = `${who(d.hittingPlayerId)} hit ${who(d.hitteePlayerId)}`; break;
      case 'penalty': line = `Penalty: ${typeof d.committedByPlayerId === 'number' ? who(d.committedByPlayerId) : 'bench'}, ${d.duration || 2} min for ${human(d.descKey)}${typeof d.drawnByPlayerId === 'number' ? `, drawn by ${who(d.drawnByPlayerId)}` : ''}`; break;
      case 'faceoff': line = `${who(d.winningPlayerId)} won the faceoff against ${who(d.losingPlayerId)}`; break;
      case 'giveaway': line = `Giveaway by ${who(d.playerId)}`; break;
      case 'takeaway': line = `Takeaway by ${who(d.playerId)}`; break;
      case 'stoppage': line = `Stoppage: ${human(d.reason) || 'play stopped'}`; break;
      case 'period': line = play.typeDescKey === 'period-start' ? `Start of ${periodName}` : `End of ${periodName}`; break;
    }
    const x = typeof d.xCoord === 'number' ? d.xCoord : undefined;
    const y = typeof d.yCoord === 'number' ? d.yCoord : undefined;
    let shot: ShotInfo | undefined;
    if ((kind === 'goal' || kind === 'shot' || kind === 'miss' || kind === 'block') && x !== undefined && y !== undefined && team) {
      // Blocks belong to the blocking team in the feed; the attempt belongs to the shooter's team.
      const shooterTeam = kind === 'block' ? otherTeam(d.eventOwnerTeamId) : team;
      const shooterIsHome = kind === 'block' ? d.eventOwnerTeamId !== home : d.eventOwnerTeamId === home;
      if (shooterTeam && home !== undefined) {
        let nx = x, ny = y;
        if (kind === 'block') {
          // Block coordinates sit at the blocker; mirror them into the shooter's attacking half.
          if ((shooterIsHome && nx < 0) || (!shooterIsHome && nx > 0)) { nx = -nx; ny = -ny; }
        } else if (play.homeTeamDefendingSide === 'right') { nx = -nx; ny = -ny; }
        const shooterId = (kind === 'goal' ? d.scoringPlayerId : d.shootingPlayerId) as number | undefined;
        shot = {
          result: kind, team: shooterTeam, shooterId: typeof shooterId === 'number' ? shooterId : undefined, shooter: who(shooterId),
          goalie: typeof d.goalieInNetId === 'number' ? who(d.goalieInNetId) : undefined,
          blocker: kind === 'block' ? who(d.blockingPlayerId) : undefined,
          shotType: d.shotType ? human(d.shotType) : undefined, reason: kind === 'miss' && d.reason ? human(d.reason) : undefined,
          strength: shotStrength(play.situationCode, shooterIsHome), x: nx, y: ny,
        };
      }
    }
    events.push({ id: play.eventId, period, time: play.timeInPeriod || '', kind, team, text: line, score, x, y, ...(shot ? { shot } : {}) });
  }
  return events;
}

// ------------------------------------------------------------------------------------
// Game detail
// ------------------------------------------------------------------------------------

export type GameDetail = {
  game: ScoreboardGame;
  scoring: GoalEvent[];
  penalties: { period: PeriodKey; time: string; team: string; player: string; type: string; minutes: number; drawnBy?: string }[];
  threeStars: { star: number; playerId: number; name: string; team: string; position?: string; number?: number; headshot?: string; line?: string }[];
  shotsByPeriod: { periods: PeriodKey[]; away: number[]; home: number[] };
  teamStats: { category: string; away: string | number; home: string | number }[];
  skaters: SkaterLine[];
  goalies: GoalieLine[];
  scratches: { away: string[]; home: string[] };
  coaches: { away?: string; home?: string };
  seasonSeries: { away: number; home: number };
  records: { away?: { overall: string; split: string }; home?: { overall: string; split: string } };
  plays: PlayEvent[];
  shifts: PlayerShift[];
  starters?: { away: TeamStarter; home: TeamStarter };
  schedules?: { away: TeamScheduleGame[]; home: TeamScheduleGame[] };
  updatedAt: string;
};

type RawBoxSkater = { playerId: number; sweaterNumber?: number; name?: Localized; position: string; goals?: number; assists?: number; points?: number; plusMinus?: number; pim?: number; hits?: number; powerPlayGoals?: number; sog?: number; blockedShots?: number; toi?: string };
type RawBoxGoalie = { playerId: number; sweaterNumber?: number; name?: Localized; saves?: number; shotsAgainst?: number; goalsAgainst?: number; savePctg?: number; toi?: string; decision?: string };

export function buildGameDetail(landing: Record<string, unknown>, rail: Record<string, unknown>, box: Record<string, unknown>): GameDetail {
  const l = landing as {
    id: number; gameDate: string; startTimeUTC: string; gameState: string; periodDescriptor?: { number?: number; periodType?: string };
    clock?: { timeRemaining?: string; inIntermission?: boolean }; awayTeam: RawTeam; homeTeam: RawTeam; tvBroadcasts?: { network?: string; countryCode?: string }[]; venue?: Localized;
    summary?: {
      scoring?: { periodDescriptor: { number?: number; periodType?: string }; goals: RawGoal[] }[];
      penalties?: { periodDescriptor: { number?: number; periodType?: string }; penalties: { timeInPeriod: string; type: string; duration: number; committedByPlayer?: { firstName?: Localized; lastName?: Localized } | string; teamAbbrev: Localized; descKey: string; drawnBy?: { firstName?: Localized; lastName?: Localized } }[] }[];
      threeStars?: { star: number; playerId: number; name?: Localized; teamAbbrev?: string; position?: string; sweaterNo?: number; headshot?: string; goals?: number; assists?: number; points?: number; savePctg?: number; goalsAgainstAverage?: number }[];
    };
  };
  const scoring = (l.summary?.scoring || []).flatMap(period => period.goals.map(goal => normalizeGoal(goal, period.periodDescriptor)));
  const game = normalizeScoreGame({ ...l, goals: [] });
  game.goals = scoring;
  const currentPeriod = game.isLive || game.isFinal ? periodLabel(game.period, game.periodType) : undefined;
  game.lineScore = deriveLineScore(scoring.filter(goal => goal.period !== 'SO'), game.away.abbrev, game.home.abbrev, currentPeriod === 'SO' ? undefined : currentPeriod);
  const person = (p: { firstName?: Localized; lastName?: Localized } | string | undefined) => (typeof p === 'string' ? p : `${text(p?.firstName)} ${text(p?.lastName)}`.trim());

  const r = rail as {
    shotsByPeriod?: { periodDescriptor: { number?: number; periodType?: string }; away: number; home: number }[];
    teamGameStats?: { category: string; awayValue: string | number; homeValue: string | number }[];
    gameInfo?: { awayTeam?: { headCoach?: Localized; scratches?: { firstName?: Localized; lastName?: Localized }[] }; homeTeam?: { headCoach?: Localized; scratches?: { firstName?: Localized; lastName?: Localized }[] } };
    seasonSeriesWins?: { awayTeamWins?: number; homeTeamWins?: number };
  };
  const shots = r.shotsByPeriod || [];

  const b = box as { playerByGameStats?: Record<'awayTeam' | 'homeTeam', { forwards?: RawBoxSkater[]; defense?: RawBoxSkater[]; goalies?: RawBoxGoalie[] }> };
  const ppp = powerPlayPoints(scoring);
  const skaters: SkaterLine[] = [];
  const goalies: GoalieLine[] = [];
  for (const [side, team] of [['awayTeam', game.away.abbrev], ['homeTeam', game.home.abbrev]] as const) {
    const group = b.playerByGameStats?.[side];
    for (const raw of [...(group?.forwards || []), ...(group?.defense || [])]) {
      skaters.push({
        playerId: raw.playerId, team, name: text(raw.name), number: raw.sweaterNumber, position: raw.position,
        goals: raw.goals || 0, assists: raw.assists || 0, points: raw.points || 0, plusMinus: raw.plusMinus || 0, pim: raw.pim || 0,
        hits: raw.hits || 0, ppGoals: raw.powerPlayGoals || 0, ppPoints: ppp.get(raw.playerId) || 0, sog: raw.sog || 0,
        blocks: raw.blockedShots || 0, toi: raw.toi || '00:00',
      });
    }
    const opponentScore = side === 'awayTeam' ? game.home.score || 0 : game.away.score || 0;
    for (const raw of group?.goalies || []) {
      const decision = raw.decision === 'W' || raw.decision === 'L' || raw.decision === 'O' ? raw.decision : undefined;
      goalies.push({
        playerId: raw.playerId, team, name: text(raw.name), number: raw.sweaterNumber, saves: raw.saves || 0,
        shotsAgainst: raw.shotsAgainst || 0, goalsAgainst: raw.goalsAgainst || 0, savePct: raw.savePctg, toi: raw.toi || '00:00',
        decision, shutout: game.isFinal && decision === 'W' && opponentScore === 0,
      });
    }
  }

  return {
    game,
    scoring,
    penalties: (l.summary?.penalties || []).flatMap(period => period.penalties.map(p => ({
      period: periodLabel(period.periodDescriptor.number, period.periodDescriptor.periodType), time: p.timeInPeriod, team: text(p.teamAbbrev),
      player: person(p.committedByPlayer) || 'Team', type: p.descKey.replace(/-/g, ' '), minutes: p.duration, drawnBy: person(p.drawnBy) || undefined,
    }))),
    threeStars: (l.summary?.threeStars || []).map(s => ({
      star: s.star, playerId: s.playerId, name: text(s.name), team: s.teamAbbrev || '', position: s.position, number: s.sweaterNo, headshot: s.headshot,
      line: s.savePctg !== undefined ? `${s.savePctg.toFixed(3).replace(/^0/, '')} SV%${s.goalsAgainstAverage !== undefined ? ` · ${s.goalsAgainstAverage.toFixed(2)} GAA` : ''}` : `${s.goals || 0} G · ${s.assists || 0} A · ${s.points ?? (s.goals || 0) + (s.assists || 0)} PTS`,
    })),
    shotsByPeriod: {
      periods: shots.map(s => periodLabel(s.periodDescriptor.number, s.periodDescriptor.periodType)),
      away: shots.map(s => s.away), home: shots.map(s => s.home),
    },
    teamStats: (r.teamGameStats || []).map(s => ({ category: s.category, away: s.awayValue, home: s.homeValue })),
    skaters,
    goalies,
    scratches: {
      away: (r.gameInfo?.awayTeam?.scratches || []).map(person),
      home: (r.gameInfo?.homeTeam?.scratches || []).map(person),
    },
    coaches: { away: text(r.gameInfo?.awayTeam?.headCoach) || undefined, home: text(r.gameInfo?.homeTeam?.headCoach) || undefined },
    seasonSeries: { away: r.seasonSeriesWins?.awayTeamWins || 0, home: r.seasonSeriesWins?.homeTeamWins || 0 },
    records: {},
    plays: [],
    shifts: [],
    updatedAt: new Date().toISOString(),
  };
}

// ------------------------------------------------------------------------------------
// Teams and standings
// ------------------------------------------------------------------------------------

export type StandingRow = {
  abbrev: string; name: string; city?: string; logo?: string; conference: string; division: string; divisionRank: number;
  gp: number; w: number; l: number; otl: number; pts: number; pointPct: number; gf: number; ga: number; diff: number; l10: string; streak: string;
  homeRecord: string; roadRecord: string;
};

type RawStanding = {
  teamAbbrev: Localized; teamCommonName?: Localized; teamName?: Localized; placeName?: Localized; teamLogo?: string; conferenceName: string; divisionName: string; divisionSequence: number;
  gamesPlayed: number; wins: number; losses: number; otLosses: number; points: number; pointPctg: number; goalFor: number; goalAgainst: number; goalDifferential: number;
  l10Wins: number; l10Losses: number; l10OtLosses: number; streakCode?: string; streakCount?: number;
  homeWins?: number; homeLosses?: number; homeOtLosses?: number; roadWins?: number; roadLosses?: number; roadOtLosses?: number;
};

export function normalizeStandings(rows: RawStanding[]): StandingRow[] {
  return rows.map(row => ({
    abbrev: text(row.teamAbbrev), name: text(row.teamCommonName) || text(row.teamName), city: text(row.placeName) || undefined, logo: row.teamLogo,
    conference: row.conferenceName, division: row.divisionName, divisionRank: row.divisionSequence,
    gp: row.gamesPlayed, w: row.wins, l: row.losses, otl: row.otLosses, pts: row.points, pointPct: row.pointPctg,
    gf: row.goalFor, ga: row.goalAgainst, diff: row.goalDifferential,
    l10: `${row.l10Wins}-${row.l10Losses}-${row.l10OtLosses}`, streak: row.streakCode ? `${row.streakCode}${row.streakCount || ''}` : '—',
    homeRecord: `${row.homeWins ?? 0}-${row.homeLosses ?? 0}-${row.homeOtLosses ?? 0}`,
    roadRecord: `${row.roadWins ?? 0}-${row.roadLosses ?? 0}-${row.roadOtLosses ?? 0}`,
  }));
}

export type TeamScheduleGame = { id: number; date: string; startTimeUTC: string; opponent: string; home: boolean; state: string; teamScore?: number; oppScore?: number; result?: 'W' | 'L' | 'OTL' };

type RawClubGame = { id: number; gameDate: string; startTimeUTC: string; gameType: number; gameState: string; awayTeam: { abbrev: string; score?: number }; homeTeam: { abbrev: string; score?: number }; gameOutcome?: { lastPeriodType?: string } };

export function normalizeTeamSchedule(games: RawClubGame[], team: string): TeamScheduleGame[] {
  return games.filter(g => g.gameType === 2).map(g => {
    const home = g.homeTeam.abbrev === team;
    const teamScore = home ? g.homeTeam.score : g.awayTeam.score;
    const oppScore = home ? g.awayTeam.score : g.homeTeam.score;
    let result: TeamScheduleGame['result'];
    if (FINAL_STATES.has(g.gameState) && teamScore !== undefined && oppScore !== undefined) {
      result = teamScore > oppScore ? 'W' : g.gameOutcome?.lastPeriodType && g.gameOutcome.lastPeriodType !== 'REG' ? 'OTL' : 'L';
    }
    return { id: g.id, date: g.gameDate, startTimeUTC: g.startTimeUTC, opponent: home ? g.awayTeam.abbrev : g.homeTeam.abbrev, home, state: g.gameState, teamScore, oppScore, result };
  });
}

/** Games in the next `days` days (inclusive of today), plus back-to-backs, for fantasy volume. */
export function scheduleVolume(schedule: TeamScheduleGame[], today: string, days = 7) {
  const end = new Date(`${today}T12:00:00Z`).getTime() + (days - 1) * 86_400_000;
  const upcoming = schedule.filter(g => g.date >= today && new Date(`${g.date}T12:00:00Z`).getTime() <= end);
  const dates = upcoming.map(g => g.date).sort();
  const backToBacks = dates.slice(1).filter((d, i) => (new Date(`${d}T12:00:00Z`).getTime() - new Date(`${dates[i]}T12:00:00Z`).getTime()) === 86_400_000).length;
  return { games: upcoming.length, home: upcoming.filter(g => g.home).length, away: upcoming.filter(g => !g.home).length, backToBacks, upcoming };
}

export type TeamSkaterSeason = { playerId: number; name: string; position: string; headshot?: string; gp: number; goals: number; assists: number; points: number; plusMinus: number; pim: number; ppGoals: number; shots: number; toi: number };
export type TeamGoalieSeason = { playerId: number; name: string; headshot?: string; gp: number; gs: number; wins: number; losses: number; otLosses: number; gaa: number; savePct: number; shutouts: number; saves: number; goalsAgainst: number };

type RawClubSkater = { playerId: number; firstName: Localized; lastName: Localized; positionCode: string; headshot?: string; gamesPlayed: number; goals: number; assists: number; points: number; plusMinus: number; penaltyMinutes: number; powerPlayGoals: number; shots: number; avgTimeOnIcePerGame: number };
type RawClubGoalie = { playerId: number; firstName: Localized; lastName: Localized; headshot?: string; gamesPlayed: number; gamesStarted: number; wins: number; losses: number; overtimeLosses: number; goalsAgainstAverage: number; savePercentage: number; shutouts: number; saves: number; goalsAgainst: number };

export function normalizeClubStats(payload: { skaters?: RawClubSkater[]; goalies?: RawClubGoalie[] }) {
  return {
    skaters: (payload.skaters || []).map((s): TeamSkaterSeason => ({
      playerId: s.playerId, name: `${text(s.firstName)} ${text(s.lastName)}`, position: s.positionCode, headshot: s.headshot,
      gp: s.gamesPlayed, goals: s.goals, assists: s.assists, points: s.points, plusMinus: s.plusMinus, pim: s.penaltyMinutes,
      ppGoals: s.powerPlayGoals, shots: s.shots, toi: s.avgTimeOnIcePerGame,
    })),
    goalies: (payload.goalies || []).map((g): TeamGoalieSeason => ({
      playerId: g.playerId, name: `${text(g.firstName)} ${text(g.lastName)}`, headshot: g.headshot, gp: g.gamesPlayed, gs: g.gamesStarted,
      wins: g.wins, losses: g.losses, otLosses: g.overtimeLosses, gaa: g.goalsAgainstAverage, savePct: g.savePercentage,
      shutouts: g.shutouts, saves: g.saves, goalsAgainst: g.goalsAgainst,
    })),
  };
}

// ------------------------------------------------------------------------------------
// Fetchers (server-side)
// ------------------------------------------------------------------------------------

async function nhl<T>(path: string, revalidate: number): Promise<T> {
  const response = await fetch(`${NHL_WEB}${path}`, { next: { revalidate }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`NHL ${path} failed: ${response.status}`);
  return response.json() as Promise<T>;
}

async function fetchShifts(gameId: number): Promise<PlayerShift[]> {
  const url = `https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=${gameId}&limit=-1`;
  const response = await fetch(url, { next: { revalidate: 15 }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`NHL shift chart failed: ${response.status}`);
  const payload = await response.json() as { data?: RawShift[] };
  return normalizeShifts(payload.data || []);
}

export const isIsoDate = (value: string | null | undefined): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** Attach "W-L-OTL" records from standings (one cached request) to each scoreboard team. */
export function attachRecords(games: ScoreboardGame[], standings: StandingRow[]): ScoreboardGame[] {
  const rows = new Map(standings.map(row => [row.abbrev, row]));
  const enrich = (team: TeamSide): TeamSide => {
    const row = rows.get(team.abbrev);
    return { ...team, record: team.record || (row ? `${row.w}-${row.l}-${row.otl}` : undefined), city: team.city || row?.city };
  };
  return games.map(game => ({ ...game, away: enrich(game.away), home: enrich(game.home) }));
}

/**
 * The slate the site shows by default: today's games from 10:00 Pacific, otherwise
 * yesterday's (so last night's finals stay up through the morning).
 */
export function slateDate(now: Date = new Date()): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(part => [part.type, part.value]));
  const day = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  if (Number(parts.hour) < 10) day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

export async function fetchScoreboard(date?: string) {
  const day = isIsoDate(date) ? date : slateDate();
  const [payload, standings] = await Promise.all([
    nhl<{ currentDate?: string; prevDate?: string; nextDate?: string; games?: RawScoreGame[] }>(`/score/${day}`, 20),
    fetchStandings().catch(() => [] as StandingRow[]),
  ]);
  return {
    date: payload.currentDate || day,
    prevDate: payload.prevDate,
    nextDate: payload.nextDate,
    games: attachRecords((payload.games || []).map(normalizeScoreGame), standings),
  };
}

export async function fetchGameDetail(gameId: number): Promise<GameDetail> {
  const [landing, rail, box, pbp, standings, shifts] = await Promise.all([
    nhl<Record<string, unknown>>(`/gamecenter/${gameId}/landing`, 15),
    nhl<Record<string, unknown>>(`/gamecenter/${gameId}/right-rail`, 15),
    nhl<Record<string, unknown>>(`/gamecenter/${gameId}/boxscore`, 15),
    nhl<{ plays?: RawPlay[]; rosterSpots?: RawRosterSpot[] }>(`/gamecenter/${gameId}/play-by-play`, 15).catch(() => null),
    fetchStandings().catch(() => [] as StandingRow[]),
    fetchShifts(gameId).catch(() => [] as PlayerShift[]),
  ]);
  const detail = buildGameDetail(landing, rail, box);
  const { game } = detail;
  // The score feed reports intermissions and the clock consistently with the score strip.
  if (game.isLive) {
    const board = await fetchScoreboard(game.gameDate).catch(() => null);
    const live = board?.games.find(g => g.id === game.id);
    if (live) Object.assign(game, { state: live.state, isLive: live.isLive, isFinal: live.isFinal, period: live.period, periodType: live.periodType, clock: live.clock, inIntermission: live.inIntermission });
  }
  const teamIds: Record<number, string> = {};
  if (game.away.id) teamIds[game.away.id] = game.away.abbrev;
  if (game.home.id) teamIds[game.home.id] = game.home.abbrev;
  detail.plays = normalizePlayByPlay(pbp, teamIds, game.home.id);
  detail.shifts = shifts;
  const row = (abbrev: string) => standings.find(s => s.abbrev === abbrev);
  const away = row(game.away.abbrev);
  const home = row(game.home.abbrev);
  detail.records = {
    away: away ? { overall: `${away.w}-${away.l}-${away.otl}`, split: `${away.roadRecord} away` } : undefined,
    home: home ? { overall: `${home.w}-${home.l}-${home.otl}`, split: `${home.homeRecord} home` } : undefined,
  };
  const nextGames = async (abbrev: string) => {
    const payload = await nhl<{ games?: RawClubGame[] }>(`/club-schedule-season/${abbrev}/now`, 900).catch(() => ({ games: [] as RawClubGame[] }));
    return normalizeTeamSchedule(payload.games || [], abbrev).filter(g => g.date > game.gameDate).slice(0, 3);
  };
  const [awayNext, homeNext] = await Promise.all([nextGames(game.away.abbrev), nextGames(game.home.abbrev)]);
  detail.schedules = { away: awayNext, home: homeNext };
  try {
    const [starters] = await getStartingGoalies([{ id: game.id, gameDate: game.gameDate, startTimeUTC: game.startTimeUTC, gameState: game.state, awayTeam: { abbrev: game.away.abbrev }, homeTeam: { abbrev: game.home.abbrev } }]);
    detail.starters = { away: starters.away.starter, home: starters.home.starter };
  } catch { /* Starters are optional on this page. */ }
  return detail;
}

export async function fetchStandings(): Promise<StandingRow[]> {
  const payload = await nhl<{ standings?: RawStanding[] }>('/standings/now', 600);
  return normalizeStandings(payload.standings || []);
}

export async function fetchTeam(abbrev: string) {
  const team = abbrev.toUpperCase();
  const [stats, schedule, standings] = await Promise.all([
    nhl<{ skaters?: RawClubSkater[]; goalies?: RawClubGoalie[] }>(`/club-stats/${team}/now`, 1800),
    nhl<{ games?: RawClubGame[] }>(`/club-schedule-season/${team}/now`, 900),
    fetchStandings(),
  ]);
  return {
    abbrev: team,
    standing: standings.find(row => row.abbrev === team) || null,
    ...normalizeClubStats(stats),
    schedule: normalizeTeamSchedule(schedule.games || [], team),
  };
}
