/**
 * Starting goalies for a day's NHL games.
 *
 * Confirmed: the NHL marks `starter: true` in the game boxscore once the official
 * lineup is posted (typically around warmups) and keeps it after the game.
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

export type BoxscoreGoalie = { playerId: number; name: string; starter?: boolean };

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
): TeamStarter {
  const confirmed = confirmedStarter(boxscoreGoalies);
  if (confirmed) return { status: 'confirmed', playerId: confirmed.playerId, name: confirmed.name, source: CONFIRMED_SOURCE };
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

type BoxscorePayload = {
  gameState?: string;
  playerByGameStats?: {
    awayTeam?: { goalies?: { playerId: number; name?: { default?: string }; starter?: boolean }[] };
    homeTeam?: { goalies?: { playerId: number; name?: { default?: string }; starter?: boolean }[] };
  };
};

const confirmedCache = new Map<number, GameStarters>();

function toBoxscoreGoalies(rows: { playerId: number; name?: { default?: string }; starter?: boolean }[] | undefined): BoxscoreGoalie[] | undefined {
  return rows?.map(row => ({ playerId: row.playerId, name: row.name?.default || String(row.playerId), starter: row.starter }));
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
    const result: GameStarters = {
      gameId: game.id,
      gameState: boxscore?.gameState || game.gameState,
      away: { team: game.awayTeam.abbrev, starter: resolveTeamStarter(toBoxscoreGoalies(boxscore?.playerByGameStats?.awayTeam?.goalies), appearances, game.awayTeam.abbrev, gameDate) },
      home: { team: game.homeTeam.abbrev, starter: resolveTeamStarter(toBoxscoreGoalies(boxscore?.playerByGameStats?.homeTeam?.goalies), appearances, game.homeTeam.abbrev, gameDate) },
    };
    // Once both starters are confirmed they cannot change; skip refetching this game.
    if (result.away.starter.status === 'confirmed' && result.home.starter.status === 'confirmed') confirmedCache.set(game.id, result);
    return result;
  }));
}
