/**
 * Starting goalies for a day's NHL games.
 *
 * Confirmed, in order of preference:
 *   1. the boxscore `starter: true` flag (the NHL sets it once the game is final);
 *   2. during a live game, the only goalie the boxscore shows with ice time;
 *   3. if a goalie was pulled (both have ice time), the goalie in net for the first
 *      shot against his team in the play-by-play.
 * Not yet confirmed: we show the goalie with the most starts in the team's last 10
 * games, clearly labelled as usage-based. Nothing is inferred from news or rumours.
 */

const NHL_WEB = 'https://api-web.nhle.com/v1';
const NHL_STATS = 'https://api.nhle.com/stats/rest/en';
export const USAGE_WINDOW_GAMES = 10;
const USAGE_LOOKBACK_DAYS = 35;

export type GoalieAppearance = {
  gameId: number;
  gameDate: string;
  playerId: number;
  name: string;
  team: string;
  started: boolean;
};

export type BoxscoreGoalie = { playerId: number; name: string; starter?: boolean; toi?: string };

export type TeamStarter =
  | { status: 'confirmed'; playerId: number; name: string; source: string }
  | { status: 'likely'; playerId: number; name: string; starts: number; ofGames: number; source: string }
  | { status: 'unknown'; source: string };

export type GameStarters = {
  gameId: number;
  gameState: string;
  away: { team: string; starter: TeamStarter };
  home: { team: string; starter: TeamStarter };
};

export const CONFIRMED_SOURCE = 'NHL official game lineup';
export const IN_NET_SOURCE = 'NHL game data: in net since puck drop';
const STARTED_STATES = new Set(['LIVE', 'CRIT', 'OFF', 'FINAL']);

export function toiSeconds(toi: string | undefined): number {
  const match = /^(\d+):(\d{2})$/.exec(toi || '');
  return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
}

/** Once a game has started: the goalie who started, from ice time or the play-by-play. */
export function startedGoalie(goalies: BoxscoreGoalie[] | undefined, firstInNetId?: number): BoxscoreGoalie | null {
  const played = (goalies || []).filter(goalie => toiSeconds(goalie.toi) > 0);
  if (played.length === 1) return played[0];
  if (played.length > 1 && firstInNetId) return played.find(goalie => goalie.playerId === firstInNetId) || null;
  return null;
}
export const USAGE_SOURCE = `Not confirmed: most starts in the team's last ${USAGE_WINDOW_GAMES} games`;

/** Returns the single goalie the NHL marked as starter, or null if absent/ambiguous. */
export function confirmedStarter(goalies: BoxscoreGoalie[] | undefined): BoxscoreGoalie | null {
  const starters = (goalies || []).filter(goalie => goalie.starter === true);
  return starters.length === 1 ? starters[0] : null;
}

/** Start counts per goalie over the team's most recent `window` games before `beforeDate`. */
export function recentStartShares(
  appearances: GoalieAppearance[],
  team: string,
  beforeDate: string,
  window = USAGE_WINDOW_GAMES,
): { playerId: number; name: string; starts: number; ofGames: number }[] {
  const starts = appearances
    .filter(row => row.team === team && row.started && row.gameDate < beforeDate)
    .sort((a, b) => (b.gameDate.localeCompare(a.gameDate)) || b.gameId - a.gameId);
  const seen = new Set<number>();
  const recent: GoalieAppearance[] = [];
  for (const row of starts) {
    if (seen.has(row.gameId)) continue;
    seen.add(row.gameId);
    recent.push(row);
    if (recent.length === window) break;
  }
  const counts = new Map<number, { playerId: number; name: string; starts: number; lastDate: string }>();
  for (const row of recent) {
    const entry = counts.get(row.playerId) || { playerId: row.playerId, name: row.name, starts: 0, lastDate: row.gameDate };
    entry.starts += 1;
    counts.set(row.playerId, entry);
  }
  return [...counts.values()]
    .sort((a, b) => b.starts - a.starts || b.lastDate.localeCompare(a.lastDate))
    .map(({ playerId, name, starts: n }) => ({ playerId, name, starts: n, ofGames: recent.length }));
}

export function resolveTeamStarter(
  boxscoreGoalies: BoxscoreGoalie[] | undefined,
  appearances: GoalieAppearance[],
  team: string,
  gameDate: string,
  gameState?: string,
  firstInNetId?: number,
): TeamStarter {
  const confirmed = confirmedStarter(boxscoreGoalies);
  if (confirmed) return { status: 'confirmed', playerId: confirmed.playerId, name: confirmed.name, source: CONFIRMED_SOURCE };
  if (gameState && STARTED_STATES.has(gameState)) {
    const inNet = startedGoalie(boxscoreGoalies, firstInNetId);
    if (inNet) return { status: 'confirmed', playerId: inNet.playerId, name: inNet.name, source: IN_NET_SOURCE };
  }
  const [top] = recentStartShares(appearances, team, gameDate);
  if (top) return { status: 'likely', ...top, source: USAGE_SOURCE };
  return { status: 'unknown', source: 'No confirmed starter and no recent starts on record' };
}

// ------------------------------------------------------------------------------------
// Fetching (server-side only). At most one boxscore per game plus one bulk usage query.
// ------------------------------------------------------------------------------------

type ScheduledGame = {
  id: number;
  gameDate?: string;
  startTimeUTC: string;
  gameState: string;
  awayTeam: { abbrev: string };
  homeTeam: { abbrev: string };
};

type RawGoalie = { playerId: number; name?: { default?: string }; starter?: boolean; toi?: string };

type BoxscorePayload = {
  gameState?: string;
  awayTeam?: { id?: number };
  homeTeam?: { id?: number };
  playerByGameStats?: {
    awayTeam?: { goalies?: RawGoalie[] };
    homeTeam?: { goalies?: RawGoalie[] };
  };
};

type PlayByPlayPayload = { plays?: { details?: { goalieInNetId?: number; eventOwnerTeamId?: number } }[] };

const confirmedCache = new Map<number, GameStarters>();

function toBoxscoreGoalies(rows: RawGoalie[] | undefined): BoxscoreGoalie[] | undefined {
  return rows?.map(row => ({ playerId: row.playerId, name: row.name?.default || String(row.playerId), starter: row.starter, toi: row.toi }));
}

/** Goalie in net for the first shot each team faced, keyed by the defending team's id. */
export function firstGoaliesInNet(payload: PlayByPlayPayload | null, awayId?: number, homeId?: number): { away?: number; home?: number } {
  const result: { away?: number; home?: number } = {};
  for (const play of payload?.plays || []) {
    const goalie = play.details?.goalieInNetId;
    const shooter = play.details?.eventOwnerTeamId;
    if (!goalie || !shooter) continue;
    if (shooter === homeId && result.away === undefined) result.away = goalie;
    if (shooter === awayId && result.home === undefined) result.home = goalie;
    if (result.away !== undefined && result.home !== undefined) break;
  }
  return result;
}

async function fetchPlayByPlay(gameId: number): Promise<PlayByPlayPayload | null> {
  try {
    const response = await fetch(`${NHL_WEB}/gamecenter/${gameId}/play-by-play`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(8_000) });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

export async function fetchRecentGoalieAppearances(today: Date): Promise<GoalieAppearance[]> {
  const end = today.toISOString().slice(0, 10);
  const start = new Date(today.getTime() - USAGE_LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);
  const expression = encodeURIComponent(`gameDate>="${start}" and gameDate<"${end}" and gameTypeId=2`);
  const response = await fetch(`${NHL_STATS}/goalie/summary?isAggregate=false&isGame=true&limit=-1&cayenneExp=${expression}`, {
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`NHL goalie usage failed: ${response.status}`);
  const payload = await response.json();
  return (payload.data || []).map((row: { gameId: number; gameDate: string; playerId: number; goalieFullName: string; teamAbbrev: string; gamesStarted: number }) => ({
    gameId: row.gameId,
    gameDate: row.gameDate,
    playerId: row.playerId,
    name: row.goalieFullName,
    team: row.teamAbbrev,
    started: row.gamesStarted > 0,
  }));
}

async function fetchBoxscore(gameId: number): Promise<BoxscorePayload | null> {
  try {
    const response = await fetch(`${NHL_WEB}/gamecenter/${gameId}/boxscore`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(8_000) });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

export async function getStartingGoalies(games: ScheduledGame[], now = new Date()): Promise<GameStarters[]> {
  let appearances: GoalieAppearance[] = [];
  try { appearances = await fetchRecentGoalieAppearances(now); } catch (error) { console.error(error); }

  return Promise.all(games.map(async game => {
    const cached = confirmedCache.get(game.id);
    if (cached) return cached;
    const gameDate = game.gameDate || game.startTimeUTC.slice(0, 10);
    const boxscore = await fetchBoxscore(game.id);
    const gameState = boxscore?.gameState || game.gameState;
    const awayGoalies = toBoxscoreGoalies(boxscore?.playerByGameStats?.awayTeam?.goalies);
    const homeGoalies = toBoxscoreGoalies(boxscore?.playerByGameStats?.homeTeam?.goalies);
    // Only when a goalie was pulled (two with ice time) do we need the play-by-play.
    const pulled = [awayGoalies, homeGoalies].some(goalies => !confirmedStarter(goalies) && (goalies || []).filter(g => toiSeconds(g.toi) > 0).length > 1);
    const firstInNet = pulled && STARTED_STATES.has(gameState)
      ? firstGoaliesInNet(await fetchPlayByPlay(game.id), boxscore?.awayTeam?.id, boxscore?.homeTeam?.id)
      : {};
    const result: GameStarters = {
      gameId: game.id,
      gameState,
      away: { team: game.awayTeam.abbrev, starter: resolveTeamStarter(awayGoalies, appearances, game.awayTeam.abbrev, gameDate, gameState, firstInNet.away) },
      home: { team: game.homeTeam.abbrev, starter: resolveTeamStarter(homeGoalies, appearances, game.homeTeam.abbrev, gameDate, gameState, firstInNet.home) },
    };
    // Once both starters are confirmed they cannot change; skip refetching this game.
    if (result.away.starter.status === 'confirmed' && result.home.starter.status === 'confirmed') confirmedCache.set(game.id, result);
    return result;
  }));
}
