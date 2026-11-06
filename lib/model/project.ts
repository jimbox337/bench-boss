/**
 * Bench Boss model projections for the next 7 days, from the exported artifact
 * (lib/model/artifacts/bench-boss-model.json) and runtime features. Labelled as model
 * estimates; callers fall back to the schedule-aware engine on any failure.
 */
import type { Player, Projection, SkaterStats } from '../calculator';
import { productionBaseline, shrunkBaseline, type ShrinkParams } from './baselines';
import { availabilityFeatures, buildIndexes, skaterFeatures, type Indexes } from './features';
import { predict, rawScore, toVector, type CompactBooster } from './gbdt';
import type { RuntimeData } from './runtimeData';

export const SKATER_TARGETS = ['goals', 'assists', 'shots', 'ppPoints', 'hits', 'blocks'] as const;
type Target = (typeof SKATER_TARGETS)[number];

export type TargetArtifact = {
  selected: 'baseline' | 'shrunk' | 'direct' | 'residual' | 'residualShrunk' | string;
  dispersion: number;
  shrinkage: ShrinkParams;
  features?: string[];
  initScore?: string | null;
  booster?: CompactBooster;
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
  };
  availability?: { features: string[]; booster: CompactBooster } | null;
};

/** Probability of dressing for a player who has not appeared in the team's last 10 games. */
export const INACTIVE_PLAY_PROBABILITY = 0.3;

/** Per-game expectation for one stat under the artifact's selected method. */
export function perGameStat(artifact: ModelArtifact, stat: Target, f: Record<string, number>, position: string): number {
  const t = artifact.skater.targets[stat];
  const base = productionBaseline(f, stat, position, artifact.skater.positionFallback[stat] || {});
  let model: number;
  if (t.selected === 'baseline') model = base;
  else if (t.selected === 'shrunk') model = shrunkBaseline(f, stat, position, t.shrinkage);
  else if (t.booster && t.features) {
    const x = toVector(t.features, f);
    if (t.initScore === 'log(shrunkBaseline)') model = Math.max(shrunkBaseline(f, stat, position, t.shrinkage), 1e-3) * Math.exp(rawScore(t.booster, x));
    else if (t.initScore === 'log(productionBaseline)') model = Math.max(base, 1e-3) * Math.exp(rawScore(t.booster, x));
    else model = predict(t.booster, x);
  } else model = base;
  const baselineWeight = artifact.skater.blendWithProductionBaseline ?? 0;
  return (1 - baselineWeight) * model + baselineWeight * base;
}

const KEY: Record<Target, keyof SkaterStats> = { goals: 'G', assists: 'A', shots: 'SOG', ppPoints: 'PPP', hits: 'HIT', blocks: 'BLK' };

export function projectPlayer(player: Player, artifact: ModelArtifact, data: RuntimeData, index: Indexes): Projection | null {
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
      const mu = perGameStat(artifact, stat, f, position);
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
    modelVersion: artifact.modelVersion,
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

export function projectAll(players: Player[], artifact: ModelArtifact, data: RuntimeData): Projection[] {
  const index = buildIndexes(data);
  return players.flatMap(player => {
    if (player.isGoalie) return [];
    const projection = projectPlayer(player, artifact, data, index);
    return projection ? [projection] : [];
  });
}
