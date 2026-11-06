/**
 * Runtime pre-game features, mirroring ml/benchboss_ml/features.py (skater features) and
 * ml/benchboss_ml/availability.py. Inputs are rows the server collects with a fixed, small
 * number of bulk NHL requests. tests/model parity fixtures (exported by Python) check that
 * these match the training features exactly.
 */

export const RATE_STATS = ['goals', 'assists', 'shots', 'ppPoints', 'hits', 'blocks', 'toi', 'ppToi'] as const;
export type RateStat = (typeof RATE_STATS)[number];
export type Position = 'C' | 'W' | 'D';

export type SkaterGameRow = {
  gameId: number; date: string; playerId: number; team: string; opp: string; home: number; position: Position;
} & Record<RateStat, number>;

export type TeamGameRow = { gameId: number; date: string; team: string; opp: string; home: number; gf: number; ga: number; sf: number; sa: number };
export type SeasonTotals = { gp: number } & Record<RateStat, number>;
export type TeamTotals = { gp: number; gf: number; ga: number; sf: number; sa: number };
export type ScheduledGame = { gameId: number; date: string; home: string; away: string };
/** One goalie appearance; `toi` in minutes, `started`/`win` 0 or 1. */
export type GoalieGameRow = {
  gameId: number; date: string; playerId: number; team: string; opp: string; home: number;
  started: number; win: number; saves: number; shotsAgainst: number; ga: number; toi: number;
};
/** Previous-season totals over starts only. */
export type GoalieSeasonTotals = { starts: number; saves: number; shotsAgainst: number };

export type FeatureInputs = {
  /** Current-season game rows for every skater (at least the last ~50 days). */
  skaterRows: SkaterGameRow[];
  /** Current-season team game rows (at least the last ~50 days). */
  teamRows: TeamGameRow[];
  /** Current-season totals per player and team (games before the target date). */
  seasonTotals: Map<number, SeasonTotals>;
  prevSeasonTotals: Map<number, SeasonTotals>;
  teamTotals: Map<string, TeamTotals>;
  /** Scheduled games from the target date for at least 7 days (and the target game itself). */
  schedule: ScheduledGame[];
  /** Every current-season goalie appearance before the target date (needed for goalie features). */
  goalieRows?: GoalieGameRow[];
  prevGoalieTotals?: Map<number, GoalieSeasonTotals>;
};

const DAY = 86_400_000;
const REST_CAP = 10;
const GAP_CAP = 30;
const AVAILABILITY_DAYS = 30;
const dayNumber = (date: string) => Math.round(new Date(`${date}T12:00:00Z`).getTime() / DAY);
const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN);

export type Indexes = {
  byPlayer: Map<number, SkaterGameRow[]>;
  byTeam: Map<string, TeamGameRow[]>;
  byGameTeam: Map<string, SkaterGameRow[]>;
};

export function buildIndexes(inputs: FeatureInputs): Indexes {
  const byPlayer = new Map<number, SkaterGameRow[]>();
  const byGameTeam = new Map<string, SkaterGameRow[]>();
  for (const row of inputs.skaterRows) {
    (byPlayer.get(row.playerId) ?? byPlayer.set(row.playerId, []).get(row.playerId)!).push(row);
    const key = `${row.gameId}:${row.team}`;
    (byGameTeam.get(key) ?? byGameTeam.set(key, []).get(key)!).push(row);
  }
  const byTeam = new Map<string, TeamGameRow[]>();
  for (const row of inputs.teamRows) (byTeam.get(row.team) ?? byTeam.set(row.team, []).get(row.team)!).push(row);
  const order = <T extends { date: string; gameId: number }>(a: T, b: T) => a.date.localeCompare(b.date) || a.gameId - b.gameId;
  byPlayer.forEach(rows => rows.sort(order));
  byTeam.forEach(rows => rows.sort(order));
  return { byPlayer, byTeam, byGameTeam };
}

/** Same-game deployment: PP-time share of the team's max and TOI rank within F or D. */
function deployment(row: SkaterGameRow, index: Indexes): { ppShare: number; toiRank: number } {
  const mates = index.byGameTeam.get(`${row.gameId}:${row.team}`) || [row];
  const teamPp = Math.max(...mates.map(m => m.ppToi));
  const group = (p: Position) => (p === 'D' ? 'D' : 'F');
  const rank = 1 + mates.filter(m => group(m.position) === group(row.position) && m.toi > row.toi).length;
  return { ppShare: teamPp > 0 ? row.ppToi / teamPp : 0, toiRank: rank };
}

/** Team context before `date`: season-to-date rates, last-10, rest and schedule volume. */
export function teamContext(team: string, date: string, inputs: FeatureInputs, index: Indexes) {
  const totals = inputs.teamTotals.get(team);
  const prior = (index.byTeam.get(team) || []).filter(r => r.date < date);
  const last10 = prior.slice(-10);
  const lastPlayed = prior.at(-1)?.date;
  const scheduledBefore = inputs.schedule.filter(g => (g.home === team || g.away === team) && g.date < date).map(g => g.date).sort().at(-1);
  const previous = [lastPlayed, scheduledBefore].filter(Boolean).sort().at(-1);
  const rest = previous ? Math.min(dayNumber(date) - dayNumber(previous), REST_CAP) : REST_CAP;
  const d = dayNumber(date);
  const next7 = inputs.schedule.filter(g => (g.home === team || g.away === team) && dayNumber(g.date) >= d && dayNumber(g.date) < d + 7).length;
  const games30 = (index.byTeam.get(team) || []).filter(r => dayNumber(r.date) >= d - AVAILABILITY_DAYS && r.date < date).length;
  const per = (v: number | undefined) => (totals && totals.gp > 0 && v !== undefined ? v / totals.gp : NaN);
  return {
    gf_pg: per(totals?.gf), ga_pg: per(totals?.ga), sf_pg: per(totals?.sf), sa_pg: per(totals?.sa),
    gf_l10: mean(last10.map(r => r.gf)), ga_l10: mean(last10.map(r => r.ga)),
    sv_pct: totals && totals.sa > 0 ? 1 - totals.ga / totals.sa : NaN,
    rest, b2b: rest === 1 ? 1 : 0, next7, games30,
  };
}

/** All skater features for `playerId` playing for `team` vs `opp` on `date`. */
export function skaterFeatures(
  playerId: number, position: Position, team: string, opp: string, home: number, date: string, inputs: FeatureInputs, index: Indexes,
): Record<string, number> {
  const out: Record<string, number> = {};
  const rows = (index.byPlayer.get(playerId) || []).filter(r => r.date < date);
  const season = inputs.seasonTotals.get(playerId);
  const prev = inputs.prevSeasonTotals.get(playerId);
  for (const stat of RATE_STATS) {
    out[`std_${stat}`] = season && season.gp > 0 ? season[stat] / season.gp : NaN;
    for (const w of [5, 10, 20]) out[`l${w}_${stat}`] = mean(rows.slice(-w).map(r => r[stat]));
    out[`prev_${stat}`] = prev && prev.gp > 0 ? prev[stat] / prev.gp : NaN;
  }
  out.std_gp = season?.gp ?? 0;
  out.prev_gp = prev?.gp ?? 0;
  out.home = home;
  out.pos_C = position === 'C' ? 1 : 0;
  out.pos_W = position === 'W' ? 1 : 0;
  out.pos_D = position === 'D' ? 1 : 0;
  const own = teamContext(team, date, inputs, index);
  const other = teamContext(opp, date, inputs, index);
  out.rest_days = own.rest;
  out.b2b = own.b2b;
  out.team_games_next7 = own.next7;
  const d = dayNumber(date);
  const player30 = rows.filter(r => dayNumber(r.date) >= d - AVAILABILITY_DAYS).length;
  out.availability_30d = own.games30 > 0 ? Math.min(player30 / own.games30, 1) : NaN;
  out.days_since_last_game = rows.length ? Math.min(d - dayNumber(rows.at(-1)!.date), GAP_CAP) : NaN;
  out.team_gf_pg = own.gf_pg;
  out.team_gf_l10 = own.gf_l10;
  out.team_sf_pg = own.sf_pg;
  out.opp_ga_pg = other.ga_pg;
  out.opp_ga_l10 = other.ga_l10;
  out.opp_sa_pg = other.sa_pg;
  out.opp_sv_pct = other.sv_pct;
  const dep = rows.map(r => deployment(r, index));
  out.l10_pp_share = mean(dep.slice(-10).map(x => x.ppShare));
  out.l5_toi_rank = mean(dep.slice(-5).map(x => x.toiRank));
  return out;
}

/**
 * Availability features (availability.py) for a player who appeared for `team` in its last
 * 10 games; returns null when he is not an active candidate.
 */
export function availabilityFeatures(playerId: number, position: Position, team: string, home: number, date: string, inputs: FeatureInputs, index: Indexes): Record<string, number> | null {
  const teamGames = (index.byTeam.get(team) || []).filter(r => r.date < date);
  if (!teamGames.length) return null;
  const played = teamGames.map(g => (index.byGameTeam.get(`${g.gameId}:${team}`) || []).some(r => r.playerId === playerId));
  const window10 = played.slice(-10);
  if (!window10.some(Boolean)) return null;
  const lastIndex = played.lastIndexOf(true);
  const first = played.indexOf(true);
  const tois = teamGames.flatMap(g => (index.byGameTeam.get(`${g.gameId}:${team}`) || []).filter(r => r.playerId === playerId).map(r => r.toi));
  const ctx = teamContext(team, date, inputs, index);
  return {
    played_share_l5: mean(played.slice(-5).map(Number)),
    played_share_l10: mean(window10.map(Number)),
    played_prev: played.at(-1) ? 1 : 0,
    miss_streak: Math.min(played.length - 1 - lastIndex, 10),
    games_on_team: played.length - first,
    last_toi: tois.at(-1) ?? NaN,
    avg_toi_l5: mean(tois.slice(-5)),
    pos_D: position === 'D' ? 1 : 0,
    rest_days: ctx.rest,
    b2b: ctx.b2b,
    home,
  };
}

const GOALIE_LOOKBACK = 20;

/**
 * Starting-goalie candidates and features (features.py goalie_candidates / goalie_features)
 * for `team`'s game vs `opp` on `date`: every goalie who appeared for the team in its
 * previous 20 games this season. `startedPrev` overrides "started the team's previous game"
 * with a probability when that game is itself still in the future.
 */
export function goalieFeatures(
  team: string, opp: string, home: number, date: string, inputs: FeatureInputs, index: Indexes, startedPrev?: Map<number, number>,
): { playerId: number; features: Record<string, number> }[] {
  const rows = (inputs.goalieRows || []).filter(r => r.date < date);
  const order = (a: GoalieGameRow, b: GoalieGameRow) => a.date.localeCompare(b.date) || a.gameId - b.gameId;
  const teamApps = rows.filter(r => r.team === team).sort(order);
  const gameIds: number[] = [];
  for (const r of teamApps) if (gameIds.at(-1) !== r.gameId && !gameIds.includes(r.gameId)) gameIds.push(r.gameId);
  const k = gameIds.length;
  if (k === 0) return [];
  const gameIndex = new Map(gameIds.map((id, i) => [id, i]));
  const starterAt: (number | undefined)[] = new Array(k).fill(undefined);
  const startLine = new Map<number, GoalieGameRow>();
  for (const r of teamApps) if (r.started) { starterAt[gameIndex.get(r.gameId)!] = r.playerId; startLine.set(gameIndex.get(r.gameId)!, r); }
  const recent = [...new Set(teamApps.filter(r => gameIndex.get(r.gameId)! >= k - GOALIE_LOOKBACK).map(r => r.playerId))];

  const own = teamContext(team, date, inputs, index);
  const other = teamContext(opp, date, inputs, index);
  const d = dayNumber(date);
  const out = recent.map(playerId => {
    const share = (w: number) => {
      const lo = Math.max(0, k - w);
      let n = 0;
      for (let i = lo; i < k; i++) if (starterAt[i] === playerId) n++;
      return n / (k - lo);
    };
    const priorStarts: number[] = [];
    for (let i = 0; i < k; i++) if (starterAt[i] === playerId) priorStarts.push(i);
    let consecutive = 0;
    while (k - 1 - consecutive >= 0 && starterAt[k - 1 - consecutive] === playerId) consecutive++;
    const last = priorStarts.length ? startLine.get(priorStarts.at(-1)!) : undefined;
    const recent5 = priorStarts.slice(-5).map(i => startLine.get(i)!);
    const sa5 = recent5.reduce((a, r) => a + r.shotsAgainst, 0);

    // Season-to-date over this goalie's starts for any team.
    const starts = rows.filter(r => r.playerId === playerId && r.started);
    const sum = (f: (r: GoalieGameRow) => number) => starts.reduce((a, r) => a + f(r), 0);
    const lastStartDate = starts.map(r => r.date).sort().at(-1);
    const prev = inputs.prevGoalieTotals?.get(playerId);
    const startedPrevGame = startedPrev?.get(playerId) ?? (starterAt[k - 1] === playerId ? 1 : 0);

    const f: Record<string, number> = {
      share_l5: share(5), share_l10: share(10), share_l20: share(20),
      started_prev_team_game: startedPrevGame,
      days_since_last_start: lastStartDate ? Math.min(d - dayNumber(lastStartDate), GAP_CAP) : NaN,
      std_starts: starts.length,
      std_sv_pct: starts.length ? sum(r => r.saves) / sum(r => r.shotsAgainst) : NaN,
      std_ga_per_start: starts.length ? sum(r => r.ga) / starts.length : NaN,
      std_win_rate: starts.length ? sum(r => r.win) / starts.length : NaN,
      prev_starts: prev?.starts ?? 0,
      prev_sv_pct: prev && prev.starts > 0 ? prev.saves / prev.shotsAgainst : NaN,
      home, rest_days: own.rest, b2b: own.b2b,
      team_ga_pg: own.ga_pg, team_sa_pg: own.sa_pg, team_gf_pg: own.gf_pg,
      opp_gf_pg: other.gf_pg, opp_sf_pg: other.sf_pg, opp_ga_pg: other.ga_pg,
      consecutive_starts: consecutive,
      b2b_started_prev: own.b2b * startedPrevGame,
      pulled_last_start: last !== undefined && last.toi < 45 ? 1 : 0,
      last_start_ga: last ? last.ga : NaN,
      l5_start_sv_pct: sa5 > 0 ? recent5.reduce((a, r) => a + r.saves, 0) / sa5 : NaN,
    };
    return { playerId, features: f };
  });
  // 1 = most starts in the team's last 20 games; ties share the rank.
  for (const c of out) c.features.share_rank = 1 + out.filter(o => o.features.share_l20 > c.features.share_l20).length;
  return out;
}
