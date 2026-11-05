/**
 * Server-side loader for model features: a fixed set of cached bulk NHL requests, never one
 * per player. Current-season totals come from season aggregates; recent windows (last 5/10/20
 * games, deployment, availability) from game-level rows of the last ~50 days.
 */
import type { FeatureInputs, Position, SeasonTotals, SkaterGameRow, TeamGameRow, TeamTotals, ScheduledGame } from './features';

const STATS = 'https://api.nhle.com/stats/rest/en';
const WEB = 'https://api-web.nhle.com/v1';
const WINDOW_DAYS = 50;
const POSITION: Record<string, Position> = { C: 'C', L: 'W', R: 'W', D: 'D' };

type Row = Record<string, unknown> & { playerId?: number; gameId?: number };

async function get<T>(url: string, revalidate: number): Promise<T> {
  const response = await fetch(url, { next: { revalidate }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`NHL request failed ${response.status}: ${url}`);
  return response.json() as Promise<T>;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
/** NHL game dates are local; use Eastern time for "today". */
export const nhlToday = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

async function report(path: string, expression: string, revalidate: number, isGame: boolean): Promise<Row[]> {
  const url = `${STATS}/${path}?isAggregate=false&isGame=${isGame}&limit=-1&cayenneExp=${encodeURIComponent(expression)}`;
  const payload = await get<{ data?: Row[]; total?: number }>(url, revalidate);
  const rows = payload.data || [];
  if ((payload.total ?? rows.length) > rows.length) throw new Error(`NHL report truncated: ${path}`);
  return rows;
}

function windows(today: Date): [string, string][] {
  const start = new Date(today.getTime() - WINDOW_DAYS * 86_400_000);
  const mid = new Date(today.getTime() - (WINDOW_DAYS / 2) * 86_400_000);
  const yesterday = new Date(today.getTime() - 86_400_000);
  return [[iso(start), iso(mid)], [iso(new Date(mid.getTime() + 86_400_000)), iso(yesterday)]];
}

function totalsFrom(summary: Row[], realtime: Row[], toi: Row[]): Map<number, SeasonTotals> {
  const rt = new Map(realtime.map(r => [r.playerId as number, r]));
  const ti = new Map(toi.map(r => [r.playerId as number, r]));
  const out = new Map<number, SeasonTotals>();
  for (const s of summary) {
    const id = s.playerId as number;
    const gp = num(s.gamesPlayed);
    const t = ti.get(id);
    out.set(id, {
      gp, goals: num(s.goals), assists: num(s.assists), shots: num(s.shots), ppPoints: num(s.ppPoints),
      hits: num(rt.get(id)?.hits), blocks: num(rt.get(id)?.blockedShots),
      toi: (num(s.timeOnIcePerGame) * gp) / 60,
      ppToi: (num(t?.ppTimeOnIcePerGame) * gp) / 60,
    });
  }
  return out;
}

export type RuntimeData = FeatureInputs & { season: string; today: string; names: Map<number, string> };

export async function loadRuntimeData(season: string, now = new Date()): Promise<RuntimeData> {
  const prevSeason = `${Number(season.slice(0, 4)) - 1}${season.slice(0, 4)}`;
  const seasonExp = (s: string) => `seasonId=${s} and gameTypeId=2`;
  const wins = windows(now);
  const winExp = ([a, b]: [string, string]) => `seasonId=${season} and gameTypeId=2 and gameDate>="${a}" and gameDate<="${b}"`;

  const [curSum, curRt, curToi, prevSum, prevRt, prevToi, teamAgg, ...rest] = await Promise.all([
    report('skater/summary', seasonExp(season), 1800, false),
    report('skater/realtime', seasonExp(season), 1800, false),
    report('skater/timeonice', seasonExp(season), 1800, false),
    report('skater/summary', seasonExp(prevSeason), 86_400, false),
    report('skater/realtime', seasonExp(prevSeason), 86_400, false),
    report('skater/timeonice', seasonExp(prevSeason), 86_400, false),
    report('team/summary', seasonExp(season), 1800, false),
    ...wins.flatMap(w => [
      report('skater/summary', winExp(w), 1800, true),
      report('skater/realtime', winExp(w), 1800, true),
      report('skater/timeonice', winExp(w), 1800, true),
      report('team/summary', winExp(w), 1800, true),
    ]),
    get<{ gameWeek?: { date: string; games?: { id: number; gameType: number; homeTeam: { abbrev: string }; awayTeam: { abbrev: string } }[] }[] }>(`${WEB}/schedule/${nhlToday(now)}`, 900),
    get<{ gameWeek?: { date: string; games?: { id: number; gameType: number; homeTeam: { abbrev: string }; awayTeam: { abbrev: string } }[] }[] }>(`${WEB}/schedule/${iso(new Date(now.getTime() + 7 * 86_400_000))}`, 900),
  ]);
  const windowReports = rest.slice(0, wins.length * 4) as Row[][];
  const schedules = rest.slice(wins.length * 4) as { gameWeek?: { date: string; games?: { id: number; gameType: number; homeTeam: { abbrev: string }; awayTeam: { abbrev: string } }[] }[] }[];

  const gameSum: Row[] = [], gameRt: Row[] = [], gameToi: Row[] = [], gameTeam: Row[] = [];
  for (let i = 0; i < wins.length; i++) {
    gameSum.push(...windowReports[i * 4]); gameRt.push(...windowReports[i * 4 + 1]);
    gameToi.push(...windowReports[i * 4 + 2]); gameTeam.push(...windowReports[i * 4 + 3]);
  }
  const key = (r: Row) => `${r.gameId}:${r.playerId}`;
  const rtByKey = new Map(gameRt.map(r => [key(r), r]));
  const toiByKey = new Map(gameToi.map(r => [key(r), r]));
  const names = new Map<number, string>();
  const skaterRows: SkaterGameRow[] = gameSum.map(s => {
    const rt = rtByKey.get(key(s));
    const ti = toiByKey.get(key(s));
    names.set(s.playerId as number, String(s.skaterFullName || ''));
    return {
      gameId: s.gameId as number, date: String(s.gameDate), playerId: s.playerId as number,
      team: String(s.teamAbbrev), opp: String(s.opponentTeamAbbrev), home: s.homeRoad === 'H' ? 1 : 0,
      position: POSITION[String(s.positionCode)] ?? 'W',
      goals: num(s.goals), assists: num(s.assists), shots: num(s.shots), ppPoints: num(s.ppPoints),
      hits: num(rt?.hits), blocks: num(rt?.blockedShots),
      toi: num(ti?.timeOnIce ?? s.timeOnIcePerGame) / 60, ppToi: num(ti?.ppTimeOnIce) / 60,
    };
  });

  // Team report has no abbreviation: map (gameId, home/road) from skater rows, and full
  // names to abbreviations for the season aggregate.
  const side = new Map<string, string>();
  for (const r of skaterRows) side.set(`${r.gameId}:${r.home}`, r.team);
  const fullName = new Map<string, string>();
  const teamRows: TeamGameRow[] = [];
  for (const t of gameTeam) {
    const home = t.homeRoad === 'H' ? 1 : 0;
    const team = side.get(`${t.gameId}:${home}`);
    if (!team) continue;
    fullName.set(String(t.teamFullName), team);
    teamRows.push({ gameId: t.gameId as number, date: String(t.gameDate), team, opp: String(t.opponentTeamAbbrev), home,
      gf: num(t.goalsFor), ga: num(t.goalsAgainst), sf: num(t.shotsForPerGame), sa: num(t.shotsAgainstPerGame) });
  }
  const teamTotals = new Map<string, TeamTotals>();
  for (const t of teamAgg) {
    const team = fullName.get(String(t.teamFullName));
    const gp = num(t.gamesPlayed);
    if (team) teamTotals.set(team, { gp, gf: num(t.goalsForPerGame) * gp, ga: num(t.goalsAgainstPerGame) * gp, sf: num(t.shotsForPerGame) * gp, sa: num(t.shotsAgainstPerGame) * gp });
  }

  const schedule: ScheduledGame[] = [];
  const seen = new Set<number>();
  for (const payload of schedules) for (const day of payload.gameWeek || []) for (const g of day.games || []) {
    if (g.gameType !== 2 || seen.has(g.id)) continue;
    seen.add(g.id);
    schedule.push({ gameId: g.id, date: day.date, home: g.homeTeam.abbrev, away: g.awayTeam.abbrev });
  }

  return {
    season, today: nhlToday(now), names, skaterRows, teamRows, schedule, teamTotals,
    seasonTotals: totalsFrom(curSum, curRt, curToi),
    prevSeasonTotals: totalsFrom(prevSum, prevRt, prevToi),
  };
}
