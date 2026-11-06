/**
 * Bench Boss model projections for the next 7 days, from the exported artifact
 * (lib/model/artifacts/bench-boss-model.json) and runtime features. Labelled as model
 * estimates; callers fall back to the schedule-aware engine on any failure.
 */
import type { Player, Projection, SkaterStats } from '../calculator';
import { productionBaseline, shrunkBaseline, type ShrinkParams } from './baselines';
import { availabilityFeatures, buildIndexes, goalieFeatures, skaterFeatures, type Indexes, type ScheduledGame } from './features';
import { predict, rawScore, toVector, type CompactBooster } from './gbdt';
import { neuralForward, type NeuralArtifact } from './neural';
import type { RuntimeData } from './runtimeData';

export const SKATER_TARGETS = ['goals', 'assists', 'shots', 'ppPoints', 'hits', 'blocks'] as const;
type Target = (typeof SKATER_TARGETS)[number];

export type BoosterComponent = { features: string[]; initScore?: string | null; booster: CompactBooster };

export type TargetArtifact = {
  selected: 'baseline' | 'shrunk' | 'direct' | 'residual' | 'residualShrunk' | 'stack' | string;
  dispersion: number;
  shrinkage: ShrinkParams;
  features?: string[];
  initScore?: string | null;
  booster?: CompactBooster;
  /** For `stack`: non-negative weight per projection (baseline, shrunk or a booster component). */
  stack?: Record<string, number>;
  components?: Record<string, BoosterComponent>;
};

export type ModelArtifact = {
  modelVersion: string;
  trainedAt: string;
  dataThrough: string;
  promotion: { eligible: boolean };
  skater: {
    targets: Record<Target, TargetArtifact>;
    positionFallback: Record<Target, Record<string, number>>;
    intervalScale: number;
    blendWithProductionBaseline?: number;
    /** Bench Boss Neural (experimental network); served only when promoted and the feature flag is on. */
    neural?: NeuralArtifact;
  };
  availability?: { features: string[]; booster: CompactBooster } | null;
  /** Start probability, and per-start saves, goals against, win and shutout. */
  goalie?: { features: string[]; targets: Record<GoalieTarget, { booster: CompactBooster }> };
};

export const GOALIE_TARGETS = ['started', 'saves', 'ga', 'win', 'shutout'] as const;
type GoalieTarget = (typeof GOALIE_TARGETS)[number];

/** Probability of dressing for a player who has not appeared in the team's last 10 games. */
export const INACTIVE_PLAY_PROBABILITY = 0.3;

export type ProjectOptions = { neural?: boolean };

/** Whether Bench Boss Neural is served: it must have passed its gate and be flagged on. */
export const neuralActive = (artifact: ModelArtifact, options?: ProjectOptions) => Boolean(options?.neural && artifact.skater.neural?.promoted);

const neuralCache = new WeakMap<Record<string, number>, number[]>();

/** All six neural outputs for one feature record (computed once per record). */
function neuralOutputs(artifact: ModelArtifact, f: Record<string, number>, position: string): number[] {
  const cached = neuralCache.get(f);
  if (cached) return cached;
  const net = artifact.skater.neural!;
  const shr = Object.fromEntries(SKATER_TARGETS.map(t => [t, shrunkBaseline(f, t, position, artifact.skater.targets[t].shrinkage)]));
  const record: Record<string, number> = { ...f };
  for (const t of SKATER_TARGETS) record[`lshr_${t}`] = Math.log(Math.max(shr[t], 1e-3));
  const out = neuralForward(net, toVector(net.preprocess.features, record), net.targets.map(t => shr[t]));
  neuralCache.set(f, out);
  return out;
}

/** Per-game expectation for one stat under the artifact's selected method. */
export function perGameStat(artifact: ModelArtifact, stat: Target, f: Record<string, number>, position: string, options?: ProjectOptions): number {
  const t = artifact.skater.targets[stat];
  const base = productionBaseline(f, stat, position, artifact.skater.positionFallback[stat] || {});
  const shrunk = () => shrunkBaseline(f, stat, position, t.shrinkage);
  const boosted = (c: BoosterComponent) => {
    const x = toVector(c.features, f);
    if (c.initScore === 'log(shrunkBaseline)') return Math.max(shrunk(), 1e-3) * Math.exp(rawScore(c.booster, x));
    if (c.initScore === 'log(productionBaseline)') return Math.max(base, 1e-3) * Math.exp(rawScore(c.booster, x));
    return predict(c.booster, x);
  };
  const single = (name: string, c?: BoosterComponent) =>
    name === 'baseline' ? base : name === 'shrunk' ? shrunk() : c ? boosted(c) : base;
  if (neuralActive(artifact, options)) {
    const net = artifact.skater.neural!;
    const component = (name: string) => (name === 'neural' ? neuralOutputs(artifact, f, position)[net.targets.indexOf(stat)] : single(name, t.components?.[name]));
    const ensemble = Object.entries(net.stack[stat]).reduce((sum, [name, w]) => sum + w * component(name), 0);
    return (1 - net.blendWithProductionBaseline) * ensemble + net.blendWithProductionBaseline * base;
  }
  let model: number;
  if (t.selected === 'stack' && t.stack) {
    model = Object.entries(t.stack).reduce((sum, [name, w]) => sum + w * single(name, t.components?.[name]), 0);
  } else {
    model = single(t.selected, t.booster && t.features ? { features: t.features, initScore: t.initScore, booster: t.booster } : undefined);
  }
  const baselineWeight = artifact.skater.blendWithProductionBaseline ?? 0;
  return (1 - baselineWeight) * model + baselineWeight * base;
}

const KEY: Record<Target, keyof SkaterStats> = { goals: 'G', assists: 'A', shots: 'SOG', ppPoints: 'PPP', hits: 'HIT', blocks: 'BLK' };

export function projectPlayer(player: Player, artifact: ModelArtifact, data: RuntimeData, index: Indexes, options?: ProjectOptions): Projection | null {
  const id = Number(player.id);
  const latest = (index.byPlayer.get(id) || []).at(-1);
  const team = latest?.team || player.nhlTeam;
  const position = latest?.position || (player.positions[0] === 'D' ? 'D' : player.positions[0] === 'C' ? 'C' : 'W');
  const end = new Date(`${data.today}T12:00:00Z`).getTime() + 7 * 86_400_000;
  const games = data.schedule
    .filter(g => (g.home === team || g.away === team) && g.date >= data.today && new Date(`${g.date}T12:00:00Z`).getTime() < end)
    .sort((a, b) => a.date.localeCompare(b.date));
  const totals: Record<keyof SkaterStats, number> = { G: 0, A: 0, PTS: 0, plusMinus: 0, PPP: 0, SOG: 0, HIT: 0, BLK: 0, PIM: 0 };
  const variance: Partial<SkaterStats> = {};
  let expectedGames = 0;
  const playProbabilities: number[] = [];
  for (const game of games) {
    const home = game.home === team ? 1 : 0;
    const opp = home ? game.away : game.home;
    const f = skaterFeatures(id, position, team, opp, home, game.date, data, index);
    const avail = artifact.availability ? availabilityFeatures(id, position, team, home, game.date, data, index) : null;
    // Without an availability model every scheduled game counts; with one, inactive players
    // (no game in the team's last 10) get a low probability instead of a model estimate.
    const p = !artifact.availability ? 1 : avail ? predict(artifact.availability.booster, toVector(artifact.availability.features, avail)) : INACTIVE_PLAY_PROBABILITY;
    playProbabilities.push(p);
    expectedGames += p;
    for (const stat of SKATER_TARGETS) {
      const mu = perGameStat(artifact, stat, f, position, options);
      const alpha = artifact.skater.targets[stat].dispersion || 0;
      totals[KEY[stat]] += p * mu;
      // Variance of a game that happens with probability p: p·Var + p(1-p)·mu².
      variance[KEY[stat]] = (variance[KEY[stat]] || 0) + p * (mu + alpha * mu * mu) + p * (1 - p) * mu * mu;
    }
  }
  if (!games.length) return null;
  totals.PTS = totals.G + totals.A;
  const season = data.seasonTotals.get(id);
  if (player.seasonStats && player.gamesPlayed) {
    totals.plusMinus = (player.seasonStats.plusMinus / player.gamesPlayed) * expectedGames;
    totals.PIM = (player.seasonStats.PIM / player.gamesPlayed) * expectedGames;
  }
  const minP = Math.min(...playProbabilities);
  const opponents = games.map(g => (g.home === team ? g.away : `@${g.home}`));
  const b2b = games.slice(1).filter((g, i) => new Date(`${g.date}T12:00:00Z`).getTime() - new Date(`${games[i].date}T12:00:00Z`).getTime() === 86_400_000).length;
  const sample = season?.gp ?? 0;
  return {
    playerId: player.id,
    timeframe: 'next_7',
    gamesPlayed: Math.round(expectedGames * 100) / 100,
    skaterStats: totals,
    variance,
    intervalScale: artifact.skater.intervalScale,
    confidence: Math.round(Math.min(90, 40 + Math.min(sample, 30) + (minP > 0.8 ? 15 : minP > 0.5 ? 5 : 0))),
    modelVersion: neuralActive(artifact, options) ? `${artifact.modelVersion}+benchboss-neural` : artifact.modelVersion,
    source: 'model',
    context: {
      opponents,
      homeGames: games.filter(g => g.home === team).length,
      awayGames: games.filter(g => g.home !== team).length,
      backToBacks: b2b,
      seasonWeight: artifact.skater.targets.goals.shrinkage.priorWeight,
      recentWeight: 1 - artifact.skater.targets.goals.shrinkage.priorWeight,
      notes: [
        `Model estimate (${artifact.modelVersion}), ${games.length} games in the next 7 days`,
        minP < 0.8 ? `Expected to dress in ${expectedGames.toFixed(1)} of ${games.length} games based on recent availability` : 'Regular in the lineup recently',
        b2b ? `${b2b} back-to-back set${b2b > 1 ? 's' : ''}` : 'No back-to-backs',
      ],
    },
  };
}

export type GoalieGameEstimate = { gameId: number; date: string; opp: string; home: number; startProb: number; saves: number; ga: number; win: number; shutout: number };

/**
 * Per-game goalie estimates for one team's next 7 days. Start probabilities are normalised
 * across the team's candidates (as in predict.py). For a game whose previous team game is
 * also in the window, "started the previous game" is that game's start probability.
 */
export function projectTeamGoalies(team: string, artifact: ModelArtifact, data: RuntimeData, index: Indexes): Map<number, GoalieGameEstimate[]> {
  const out = new Map<number, GoalieGameEstimate[]>();
  const g = artifact.goalie;
  if (!g || !data.goalieRows?.length) return out;
  const end = new Date(`${data.today}T12:00:00Z`).getTime() + 7 * 86_400_000;
  const games: ScheduledGame[] = data.schedule
    .filter(x => (x.home === team || x.away === team) && x.date >= data.today && new Date(`${x.date}T12:00:00Z`).getTime() < end)
    .sort((a, b) => a.date.localeCompare(b.date));
  let previous: Map<number, number> | undefined;
  for (const game of games) {
    const home = game.home === team ? 1 : 0;
    const opp = home ? game.away : game.home;
    const candidates = goalieFeatures(team, opp, home, game.date, data, index, previous);
    const vectors = candidates.map(c => toVector(g.features, c.features));
    const raw = vectors.map(x => predict(g.targets.started.booster, x));
    const total = raw.reduce((a, b) => a + b, 0);
    previous = new Map();
    candidates.forEach((c, i) => {
      const startProb = total > 0 ? raw[i] / total : 0;
      previous!.set(c.playerId, startProb);
      const x = vectors[i];
      const estimate: GoalieGameEstimate = {
        gameId: game.gameId, date: game.date, opp, home, startProb,
        saves: predict(g.targets.saves.booster, x), ga: predict(g.targets.ga.booster, x),
        win: predict(g.targets.win.booster, x), shutout: predict(g.targets.shutout.booster, x),
      };
      (out.get(c.playerId) ?? out.set(c.playerId, []).get(c.playerId)!).push(estimate);
    });
  }
  return out;
}

/** Weekly goalie projection: expected starts times per-start estimates. */
export function goalieProjection(player: Player, games: GoalieGameEstimate[], artifact: ModelArtifact): Projection | null {
  if (!games.length) return null;
  const starts = games.reduce((a, x) => a + x.startProb, 0);
  const sum = (f: (x: GoalieGameEstimate) => number) => games.reduce((a, x) => a + x.startProb * f(x), 0);
  const SV = sum(x => x.saves);
  const GA = sum(x => x.ga);
  const likely = games.filter(x => x.startProb >= 0.5).length;
  return {
    playerId: player.id,
    timeframe: 'next_7',
    gamesPlayed: Math.round(starts * 100) / 100,
    goalieStats: {
      W: sum(x => x.win), SV, GA, SO: sum(x => x.shutout),
      // Starts are treated as 60 minutes, so GAA is goals against per expected start.
      GAA: starts > 0 ? GA / starts : 0,
      SV_PCT: SV + GA > 0 ? SV / (SV + GA) : 0,
    },
    confidence: Math.round(40 + 40 * Math.max(...games.map(x => Math.abs(x.startProb - 0.5) * 2))),
    modelVersion: artifact.modelVersion,
    source: 'model',
    context: {
      opponents: games.map(x => (x.home ? x.opp : `@${x.opp}`)),
      homeGames: games.filter(x => x.home).length,
      awayGames: games.filter(x => !x.home).length,
      backToBacks: 0,
      seasonWeight: 0,
      recentWeight: 0,
      notes: [
        `Model estimate (${artifact.modelVersion}): ${starts.toFixed(1)} expected starts in ${games.length} team games`,
        ...games.map(x => `${x.date} ${x.home ? 'vs' : '@'} ${x.opp}: ${Math.round(x.startProb * 100)}% to start (projected, not confirmed)`),
        likely ? `Likely starter in ${likely} of ${games.length}` : 'Not the likely starter in any game this week',
      ],
    },
  };
}

export function projectAll(players: Player[], artifact: ModelArtifact, data: RuntimeData, options?: ProjectOptions): Projection[] {
  const index = buildIndexes(data);
  const goalieTeams = new Map<string, Map<number, GoalieGameEstimate[]>>();
  return players.flatMap(player => {
    if (player.isGoalie) {
      if (!goalieTeams.has(player.nhlTeam)) goalieTeams.set(player.nhlTeam, projectTeamGoalies(player.nhlTeam, artifact, data, index));
      const projection = goalieProjection(player, goalieTeams.get(player.nhlTeam)!.get(Number(player.id)) || [], artifact);
      return projection ? [projection] : [];
    }
    const projection = projectPlayer(player, artifact, data, index, options);
    return projection ? [projection] : [];
  });
}
