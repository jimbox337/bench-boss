/**
 * Player card data: bio, season-by-season NHL totals, a season's game log and the team's
 * upcoming games, from the public NHL web API. Shared by /api/player-card and its tests.
 */
import { fetchStandings, type StandingRow } from './nhlGameCenter';

const NHL_WEB = 'https://api-web.nhle.com/v1';

type Localized = { default?: string } | undefined;
const text = (value: Localized | string | undefined) => (typeof value === 'string' ? value : value?.default) || '';

export type CardGame = {
  gameId: number; date: string; opponent: string; home: boolean;
  goals: number; assists: number; points: number; plusMinus: number; ppp: number; shots: number; pim: number; toi: string | null; shifts?: number;
  decision?: string; shotsAgainst?: number; goalsAgainst?: number; savePct?: number; shutouts?: number; started?: boolean;
};
export type CardUpcoming = { gameId: number; date: string; startTimeUTC: string; opponent: string; home: boolean };
export type CardSeason = {
  season: number; label: string; team: string; gp: number; goals: number; assists: number; points: number; plusMinus: number; ppp: number; shots: number; pim: number; avgToi?: string;
  wins?: number; losses?: number; gaa?: number; savePct?: number; shutouts?: number;
};
export type CardTeam = { abbrev: string; name: string; city?: string; gaPerGame: number; gaRank: number };

export type PlayerCardData = {
  id: string; firstName: string; lastName: string; team: string; teamName: string; position: string; isGoalie: boolean;
  number?: number; headshot?: string; age?: number; height?: string; weight?: number; shoots?: string; birthplace?: string;
  injury: { status: string | null; description: string | null };
  season: number; seasonOptions: number[];
  seasons: CardSeason[];
  gameLog: CardGame[];
  upcoming: CardUpcoming[];
  teams: Record<string, CardTeam>;
};

export const seasonLabel = (season: number) => `${String(season).slice(0, 4)}-${String(season).slice(6)}`;

export function ageOn(birthDate: string | undefined, today = new Date()): number | undefined {
  if (!birthDate) return undefined;
  const born = new Date(`${birthDate}T12:00:00Z`);
  let age = today.getUTCFullYear() - born.getUTCFullYear();
  const beforeBirthday = today.getUTCMonth() < born.getUTCMonth() || (today.getUTCMonth() === born.getUTCMonth() && today.getUTCDate() < born.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** Goals-against per game for each team, ranked 1 (stingiest) to 32. */
export function defenseTable(standings: StandingRow[]): Record<string, CardTeam> {
  const rows = standings.filter(row => row.gp > 0).map(row => ({ abbrev: row.abbrev, name: row.name, city: row.city, gaPerGame: row.ga / row.gp }));
  rows.sort((a, b) => a.gaPerGame - b.gaPerGame);
  return Object.fromEntries(rows.map((row, index) => [row.abbrev, { ...row, gaPerGame: Math.round(row.gaPerGame * 100) / 100, gaRank: index + 1 }]));
}

type RawLogGame = Record<string, unknown> & { gameId: number; gameDate: string; opponentAbbrev: string; homeRoadFlag: string };
export function normalizeGameLog(raw: RawLogGame[]): CardGame[] {
  const n = (value: unknown) => (typeof value === 'number' ? value : 0);
  return raw.map(game => ({
    gameId: game.gameId, date: game.gameDate, opponent: game.opponentAbbrev, home: game.homeRoadFlag === 'H',
    goals: n(game.goals), assists: n(game.assists), points: n(game.points ?? n(game.goals) + n(game.assists)), plusMinus: n(game.plusMinus),
    ppp: n(game.powerPlayPoints), shots: n(game.shots), pim: n(game.pim), toi: (game.toi as string) ?? null, shifts: game.shifts as number | undefined,
    decision: game.decision as string | undefined, shotsAgainst: game.shotsAgainst as number | undefined, goalsAgainst: game.goalsAgainst as number | undefined,
    savePct: game.savePctg as number | undefined, shutouts: game.shutouts as number | undefined, started: game.gamesStarted === undefined ? undefined : game.gamesStarted === 1,
  })).sort((a, b) => a.date.localeCompare(b.date));
}

type RawSeason = Record<string, unknown> & { season: number; gameTypeId: number; leagueAbbrev: string };
export function normalizeSeasons(raw: RawSeason[]): CardSeason[] {
  const n = (value: unknown) => (typeof value === 'number' ? value : 0);
  return raw.filter(row => row.leagueAbbrev === 'NHL' && row.gameTypeId === 2).map(row => ({
    season: row.season, label: seasonLabel(row.season), team: text(row.teamName as Localized), gp: n(row.gamesPlayed),
    goals: n(row.goals), assists: n(row.assists), points: n(row.points), plusMinus: n(row.plusMinus), ppp: n(row.powerPlayPoints), shots: n(row.shots), pim: n(row.pim),
    avgToi: row.avgToi as string | undefined, wins: row.wins as number | undefined, losses: row.losses as number | undefined,
    gaa: row.goalsAgainstAvg as number | undefined, savePct: row.savePctg as number | undefined, shutouts: row.shutouts as number | undefined,
  })).sort((a, b) => b.season - a.season);
}

async function get<T>(path: string, revalidate: number): Promise<T | null> {
  try {
    const response = await fetch(`${NHL_WEB}${path}`, { next: { revalidate }, signal: AbortSignal.timeout(10_000) });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

export async function fetchPlayerCard(id: string, requestedSeason?: number): Promise<PlayerCardData> {
  const landing = await get<Record<string, unknown>>(`/player/${id}/landing`, 900);
  if (!landing) throw new Error('Player not found');
  const team = (landing.currentTeamAbbrev as string) || '';
  const seasons = normalizeSeasons((landing.seasonTotals as RawSeason[]) || []);
  const seasonOptions = [...new Set(seasons.map(row => row.season))];
  const season = requestedSeason && seasonOptions.includes(requestedSeason) ? requestedSeason : seasonOptions[0];
  const [log, schedule, standings] = await Promise.all([
    season ? get<{ gameLog?: RawLogGame[] }>(`/player/${id}/game-log/${season}/2`, 900) : null,
    team && season === seasonOptions[0] ? get<{ games?: { id: number; gameDate: string; startTimeUTC: string; gameState: string; gameType: number; homeTeam: { abbrev: string }; awayTeam: { abbrev: string } }[] }>(`/club-schedule-season/${team}/now`, 1800) : null,
    fetchStandings().catch(() => [] as StandingRow[]),
  ]);
  const upcoming = (schedule?.games || [])
    .filter(game => game.gameType === 2 && (game.gameState === 'FUT' || game.gameState === 'PRE'))
    .map(game => ({ gameId: game.id, date: game.gameDate, startTimeUTC: game.startTimeUTC, home: game.homeTeam.abbrev === team, opponent: game.homeTeam.abbrev === team ? game.awayTeam.abbrev : game.homeTeam.abbrev }));
  const roster = landing.currentTeamRoster as { injuryStatus?: string; injuryDescription?: string } | undefined;
  const inches = landing.heightInInches as number | undefined;
  return {
    id, firstName: text(landing.firstName as Localized), lastName: text(landing.lastName as Localized), team, teamName: text(landing.fullTeamName as Localized),
    position: (landing.position as string) || '', isGoalie: landing.position === 'G', number: landing.sweaterNumber as number | undefined,
    headshot: landing.headshot as string | undefined, age: ageOn(landing.birthDate as string | undefined),
    height: inches ? `${Math.floor(inches / 12)}'${inches % 12}"` : undefined, weight: landing.weightInPounds as number | undefined,
    shoots: landing.shootsCatches as string | undefined,
    birthplace: [text(landing.birthCity as Localized), text(landing.birthStateProvince as Localized) || (landing.birthCountry as string)].filter(Boolean).join(', ') || undefined,
    injury: { status: roster?.injuryStatus ?? null, description: roster?.injuryDescription ?? null },
    season: season || 0, seasonOptions, seasons,
    gameLog: normalizeGameLog(log?.gameLog || []),
    upcoming,
    teams: defenseTable(standings),
  };
}
