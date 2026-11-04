import { Player, Projection, SkaterStats } from './calculator';

const NHL_API = 'https://api-web.nhle.com/v1';
const NHL_STATS_API = 'https://api.nhle.com/stats/rest/en';
const STAT_KEYS: (keyof SkaterStats)[] = ['G', 'A', 'PTS', 'plusMinus', 'PPP', 'SOG', 'HIT', 'BLK', 'PIM'];

type ScheduledGame = {
  gameDate: string;
  homeTeam?: { abbrev?: string };
  awayTeam?: { abbrev?: string };
};

type TeamWeek = {
  opponents: string[];
  homeGames: number;
  awayGames: number;
  backToBacks: number;
};

function emptyStats(): SkaterStats {
  return { G: 0, A: 0, PTS: 0, plusMinus: 0, PPP: 0, SOG: 0, HIT: 0, BLK: 0, PIM: 0 };
}

function perGame(stats: SkaterStats, games: number): SkaterStats {
  const result = emptyStats();
  if (!games) return result;
  for (const key of STAT_KEYS) result[key] = (stats[key] || 0) / games;
  return result;
}

function weightedStats(season: SkaterStats, recent20: SkaterStats | null, recent10: SkaterStats | null, recent5: SkaterStats | null): SkaterStats {
  if (!recent20 && !recent10 && !recent5) return season;
  const result = emptyStats();
  for (const key of STAT_KEYS) {
    const samples = [
      { value: season[key], weight: 0.45 },
      { value: recent20?.[key], weight: 0.25 },
      { value: recent10?.[key], weight: 0.20 },
      { value: recent5?.[key], weight: 0.10 },
    ].filter(sample => typeof sample.value === 'number') as { value: number; weight: number }[];
    const totalWeight = samples.reduce((sum, sample) => sum + sample.weight, 0);
    result[key] = samples.reduce((sum, sample) => sum + sample.value * sample.weight, 0) / totalWeight;
  }
  return result;
}

function countBackToBacks(dates: string[]) {
  const sorted = [...new Set(dates)].sort();
  return sorted.slice(1).filter((date, index) => {
    const prior = new Date(`${sorted[index]}T12:00:00Z`).getTime();
    const current = new Date(`${date}T12:00:00Z`).getTime();
    return Math.round((current - prior) / 86_400_000) === 1;
  }).length;
}

export async function fetchSevenDaySchedule(): Promise<Map<string, TeamWeek>> {
  const response = await fetch(`${NHL_API}/schedule/now`, { next: { revalidate: 900 } });
  if (!response.ok) throw new Error(`NHL schedule failed: ${response.status}`);
  const payload = await response.json();
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(now.getTime() + 7 * 86_400_000);
  const games: ScheduledGame[] = (payload.gameWeek || [])
    .flatMap((day: { games?: ScheduledGame[] }) => day.games || [])
    .filter((game: ScheduledGame) => {
      const date = new Date(`${game.gameDate}T12:00:00Z`);
      return date >= now && date < end;
    });

  const gameMap = new Map<string, { opponents: string[]; home: number; away: number; dates: string[] }>();
  for (const game of games) {
    const home = game.homeTeam?.abbrev;
    const away = game.awayTeam?.abbrev;
    if (!home || !away) continue;
    const homeRow = gameMap.get(home) || { opponents: [], home: 0, away: 0, dates: [] };
    homeRow.opponents.push(away); homeRow.home++; homeRow.dates.push(game.gameDate); gameMap.set(home, homeRow);
    const awayRow = gameMap.get(away) || { opponents: [], home: 0, away: 0, dates: [] };
    awayRow.opponents.push(home); awayRow.away++; awayRow.dates.push(game.gameDate); gameMap.set(away, awayRow);
  }

  return new Map([...gameMap].map(([team, row]) => [team, {
    opponents: row.opponents,
    homeGames: row.home,
    awayGames: row.away,
    backToBacks: countBackToBacks(row.dates),
  }]));
}

async function fetchRecentRateMap(days: number): Promise<Map<string, SkaterStats>> {
  const map = new Map<string, SkaterStats>();
  try {
    const start = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
    const end = new Date().toISOString().slice(0, 10);
    const expression = encodeURIComponent(`gameDate>="${start}" and gameDate<="${end}" and gameTypeId=2`);
    const response = await fetch(`${NHL_STATS_API}/skater/summary?cayenneExp=${expression}&limit=-1`, { next: { revalidate: 1800 } });
    if (!response.ok) return map;
    const data = await response.json();
    for (const row of data.data || []) {
      if (!row.playerId || !row.gamesPlayed) continue;
      map.set(String(row.playerId), perGame({
        G: row.goals || 0,
        A: row.assists || 0,
        PTS: row.points || 0,
        plusMinus: row.plusMinus || 0,
        PPP: row.ppPoints || 0,
        SOG: row.shots || 0,
        HIT: row.hits || 0,
        BLK: row.blockedShots || 0,
        PIM: row.penaltyMinutes || 0,
      }, row.gamesPlayed));
    }
  } catch {
    return map;
  }
  return map;
}

export async function generateScheduleAwareProjections(players: Player[]): Promise<Projection[]> {
  let schedule = new Map<string, TeamWeek>();
  try { schedule = await fetchSevenDaySchedule(); } catch (error) { console.error(error); }

  const [recent20, recent10, recent5] = await Promise.all([
    fetchRecentRateMap(40),
    fetchRecentRateMap(20),
    fetchRecentRateMap(10),
  ]);

  return players.flatMap(player => {
    if (player.isGoalie || !player.seasonStats || !player.gamesPlayed) return [];
    const teamWeek = schedule.get(player.nhlTeam) || { opponents: [], homeGames: 0, awayGames: 3, backToBacks: 0 };
    const games = teamWeek.homeGames + teamWeek.awayGames || 3;
    const seasonRates = perGame(player.seasonStats, player.gamesPlayed);
    const hasRecent = recent20.has(player.id) || recent10.has(player.id) || recent5.has(player.id);
    const rates = weightedStats(seasonRates, recent20.get(player.id) || null, recent10.get(player.id) || null, recent5.get(player.id) || null);
    const projected = emptyStats();
    for (const key of STAT_KEYS) projected[key] = rates[key] * games;
    const confidence = Math.min(95, Math.round(45 + Math.min(player.gamesPlayed, 40) + (hasRecent ? 10 : 0)));
    return [{
      playerId: player.id,
      timeframe: 'next_7' as const,
      gamesPlayed: games,
      skaterStats: projected,
      confidence,
      modelVersion: 'bench-boss-schedule-v1',
      context: {
        opponents: teamWeek.opponents,
        homeGames: teamWeek.homeGames,
        awayGames: teamWeek.awayGames,
        backToBacks: teamWeek.backToBacks,
        seasonWeight: hasRecent ? 0.45 : 1,
        recentWeight: hasRecent ? 0.55 : 0,
        notes: [
          `${games} games in the next seven days`,
          hasRecent ? 'Blends season baseline with recent 20, 10 and 5-game form' : 'Season baseline; recent form unavailable',
          teamWeek.backToBacks ? `${teamWeek.backToBacks} back-to-back set${teamWeek.backToBacks > 1 ? 's' : ''}` : 'No back-to-back penalty',
        ],
      },
    }];
  });
}
