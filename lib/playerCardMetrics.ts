/**
 * Derived numbers for the player card: ranks, the three "read" meters, matchup stars,
 * game-log heat cells and a plain-language summary. Every input is real data (season stats,
 * NHL game logs, Bench Boss projections and standings); nothing here is invented news.
 */
import { calculateFantasyPoints, calculateFantasyRange, type LeagueSettings, type Player, type Projection, type SkaterStats } from './calculator';
import type { CardGame, CardTeam, CardUpcoming } from './playerCard';

export const positionGroup = (player: Pick<Player, 'positions' | 'isGoalie'>) => (player.isGoalie ? 'G' : player.positions[0] || 'F');

export function skaterGamePoints(game: CardGame, settings: LeagueSettings): number {
  const skaterStats: SkaterStats = { G: game.goals, A: game.assists, PTS: game.points, plusMinus: game.plusMinus, PPP: game.ppp, SOG: game.shots, HIT: 0, BLK: 0, PIM: game.pim };
  return calculateFantasyPoints({ playerId: '', timeframe: 'per_game', gamesPlayed: 1, skaterStats }, settings);
}

export function goalieGamePoints(game: CardGame, settings: LeagueSettings): number {
  const ga = game.goalsAgainst ?? 0;
  const goalieStats = { W: game.decision === 'W' ? 1 : 0, SV: Math.max(0, (game.shotsAgainst ?? 0) - ga), GA: ga, GAA: 0, SV_PCT: game.savePct ?? 0, SO: game.shutouts ?? 0 };
  return calculateFantasyPoints({ playerId: '', timeframe: 'per_game', gamesPlayed: 1, goalieStats }, settings);
}

/** 1-based rank of `value` among `values` (higher is better). */
export function rankOf(value: number, values: number[]): number {
  return values.filter(other => other > value).length + 1;
}

/** Share of `values` strictly below `value`, 0..1. */
export function percentile(value: number, values: number[]): number {
  if (values.length < 2) return 0.5;
  return values.filter(other => other < value).length / (values.length - 1);
}

export type Meter = { label: string; bars: number; value: string; share: number };
const levels = ['Very low', 'Low', 'Moderate', 'High', 'Very high'];
export function meter(label: string, share: number): Meter {
  const bars = Math.min(5, Math.max(1, Math.ceil(share * 5)));
  return { label, bars, value: levels[bars - 1], share: Math.min(1, Math.max(0, share)) };
}

export type ProjectionSummary = { fp: number; low: number; high: number; games: number; perGame: number; rank: number; poolSize: number };

/** Projected fantasy points for each player in the same position group, for ranks and meters. */
export function projectionPool(player: Player, players: Player[], projections: Projection[], settings: LeagueSettings) {
  const group = positionGroup(player);
  const byId = new Map(projections.map(p => [p.playerId, p]));
  const pool = players.filter(other => positionGroup(other) === group && byId.has(other.id)).map(other => {
    const projection = byId.get(other.id)!;
    const fp = calculateFantasyPoints(projection, settings);
    const range = calculateFantasyRange(projection, settings);
    return { id: other.id, fp, low: range?.low ?? fp, high: range?.high ?? fp, games: projection.gamesPlayed };
  });
  return pool;
}

export function summarizeProjection(player: Player, players: Player[], projections: Projection[], settings: LeagueSettings): (ProjectionSummary & { meters: Meter[] }) | null {
  const pool = projectionPool(player, players, projections, settings);
  const me = pool.find(row => row.id === player.id);
  if (!me) return null;
  const fps = pool.map(row => row.fp);
  const highs = pool.map(row => row.high);
  // Bust risk: a wide downside relative to the mean, or fewer expected games than the team plays.
  const downside = pool.map(row => (row.fp > 0 ? 1 - row.low / row.fp : 1));
  const myDownside = me.fp > 0 ? 1 - me.low / me.fp : 1;
  return {
    fp: me.fp, low: me.low, high: me.high, games: me.games, perGame: me.games ? me.fp / me.games : 0,
    rank: rankOf(me.fp, fps), poolSize: pool.length,
    meters: [meter('Overall', percentile(me.fp, fps)), meter('Upside', percentile(me.high, highs)), meter('Bust risk', percentile(myDownside, downside))],
  };
}

/** Rank by season fantasy points in the same position group. */
export function seasonRank(player: Player, players: Player[], settings: LeagueSettings): number | null {
  if (!player.seasonStats || player.isGoalie) return null;
  const group = positionGroup(player);
  const points = (p: Player) => calculateFantasyPoints({ playerId: p.id, timeframe: 'per_game', gamesPlayed: 1, skaterStats: p.seasonStats }, settings);
  const values = players.filter(other => positionGroup(other) === group && other.seasonStats).map(points);
  return rankOf(points(player), values);
}

/** 1-5 stars: more goals allowed by the opponent means a better matchup for a skater. */
export function matchupStars(opponent: CardTeam | undefined, teamCount = 32, forGoalie = false): number {
  if (!opponent) return 0;
  const softness = opponent.gaRank / teamCount; // 1/32 stingiest .. 1 leakiest
  return Math.min(5, Math.max(1, Math.ceil((forGoalie ? 1 - softness + 1 / teamCount : softness) * 5)));
}

export type Heat = 'good' | 'bad' | undefined;
/** Colour a game-log cell against the player's own per-game average for that stat. */
export function heat(value: number, mean: number, kind: 'count' | 'rate' | 'signed' = 'rate'): Heat {
  if (kind === 'signed') return value > 0 ? 'good' : value < 0 ? 'bad' : undefined;
  if (kind === 'count') return value > 0 && value >= Math.max(1, mean * 1.4) ? 'good' : undefined;
  if (mean <= 0) return value > 0 ? 'good' : undefined;
  if (value >= mean * 1.35) return 'good';
  if (value <= mean * 0.6) return 'bad';
  return undefined;
}

export const toiMinutes = (toi: string | null | undefined) => {
  if (!toi) return 0;
  const [m, s] = toi.split(':').map(Number);
  return (m || 0) + (s || 0) / 60;
};

export function average(values: number[]) {
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
}

/** "Anaheim Ducks" from standings place and common names, without doubling "NY Rangers Rangers". */
export function teamFullName(team: Pick<CardTeam, 'name' | 'city'>): string {
  const { name, city } = team;
  if (!city) return name;
  if (city.includes(name)) return city;
  if (name.includes(city)) return name;
  return `${city} ${name}`;
}

/** A few factual sentences from the numbers on the card. */
export function writeRead(input: {
  name: string; isGoalie: boolean; games: CardGame[]; seasonPpg?: number; projection: ProjectionSummary | null; next?: CardUpcoming; opponent?: CardTeam;
  injury?: string | null; backToBacks?: number;
}): string {
  const last = input.name.split(' ').slice(-1)[0];
  const sentences: string[] = [];
  if (input.injury) sentences.push(`${last} is listed as ${input.injury.toLowerCase()} on the NHL roster report.`);
  if (input.projection) {
    sentences.push(`Bench Boss projects ${input.projection.fp.toFixed(1)} fantasy points over ${input.projection.games.toFixed(1)} expected games in the next 7 days (80% range ${input.projection.low.toFixed(1)}–${input.projection.high.toFixed(1)}), #${input.projection.rank} of ${input.projection.poolSize} at the position.`);
  }
  const recent = input.games.slice(-5);
  if (!input.isGoalie && recent.length >= 3 && input.seasonPpg !== undefined) {
    const recentPpg = average(recent.map(g => g.points));
    const shots = average(recent.map(g => g.shots));
    const trend = recentPpg > 0 && recentPpg >= input.seasonPpg * 1.25 ? 'running hot' : input.seasonPpg > 0 && recentPpg <= input.seasonPpg * 0.7 ? 'cooling off' : 'steady';
    sentences.push(`He's ${trend}: ${recent.reduce((s, g) => s + g.points, 0)} points and ${shots.toFixed(1)} shots a game over his last ${recent.length}, against ${input.seasonPpg.toFixed(2)} points a game on the season.`);
  }
  if (input.isGoalie && recent.length >= 2) {
    const sa = recent.reduce((s, g) => s + (g.shotsAgainst ?? 0), 0);
    const ga = recent.reduce((s, g) => s + (g.goalsAgainst ?? 0), 0);
    if (sa) sentences.push(`Over his last ${recent.length} appearances he has a ${(1 - ga / sa).toFixed(3).replace(/^0/, '')} save percentage on ${sa} shots.`);
  }
  if (input.next && input.opponent) {
    const soft = input.opponent.gaRank >= 22 ? 'one of the leakier defences' : input.opponent.gaRank <= 10 ? 'one of the stingier defences' : 'a middle-of-the-pack defence';
    sentences.push(`Next up is ${input.next.home ? 'a home game against' : 'a road game at'} ${teamFullName(input.opponent)}, ${soft} at ${input.opponent.gaPerGame.toFixed(2)} goals against a game (#${input.opponent.gaRank} of 32).`);
  }
  if (input.backToBacks) sentences.push(`The week includes ${input.backToBacks} back-to-back${input.backToBacks > 1 ? 's' : ''}, so watch for a rest night.`);
  return sentences.join(' ');
}
