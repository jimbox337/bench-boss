import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { calculateFantasyRange, defaultLeagueSettings, type Player, type Projection } from '../calculator';
import { productionBaseline, shrunkBaseline } from './baselines';
import { predict } from './gbdt';
import { combineProjections } from './index';
import { perGameStat, SKATER_TARGETS, type ModelArtifact } from './project';

const artifact: ModelArtifact & { goalie?: { targets: Record<string, { booster?: { parity?: { x: (number | null)[]; y: number }[] } & ModelArtifact['skater']['targets']['goals']['booster'] }> } } =
  JSON.parse(readFileSync(join(__dirname, 'artifacts', 'bench-boss-model.json'), 'utf8'));

describe('tree evaluator matches LightGBM', () => {
  const boosters = [
    ...SKATER_TARGETS.map(t => artifact.skater.targets[t].booster),
    ...Object.values(artifact.goalie?.targets || {}).map(t => t.booster),
    artifact.availability?.booster,
  ].filter((b): b is NonNullable<typeof b> => !!b && !!b.parity?.length);

  it(`reproduces ${boosters.length} boosters' reference predictions`, () => {
    expect(boosters.length).toBeGreaterThan(0);
    for (const booster of boosters) {
      for (const sample of booster.parity!) {
        const x = Float64Array.from(sample.x.map(v => (v === null ? NaN : v)));
        // Residual boosters store raw-score parity (no init score); predict() applies the link.
        const got = predict(booster, x);
        // Leaf values are exported to 8 significant digits, so compare relative error.
        expect(Math.abs(got - sample.y) / Math.max(Math.abs(sample.y), 1e-9)).toBeLessThan(1e-6);
      }
    }
  });
});

describe('baselines', () => {
  const fallback = { C: 0.2, W: 0.2, D: 0.1 };
  it('production blend reweights missing windows and falls back', () => {
    expect(productionBaseline({ std_goals: 0.5, l20_goals: 0.3 }, 'goals', 'C', fallback)).toBeCloseTo((0.5 * 0.45 + 0.3 * 0.25) / 0.7, 10);
    expect(productionBaseline({ prev_goals: 0.4 }, 'goals', 'C', fallback)).toBe(0.4);
    expect(productionBaseline({}, 'goals', 'D', fallback)).toBe(0.1);
  });
  it('shrinkage tempers one hot game for a low-minute player but trusts a full season', () => {
    const params = { k: 2, priorWeight: 0.35, seasonWeight: 0, reference: { perMinute: { W: 0.012 }, toi: { W: 15 } } };
    const oneGame = { std_goals: 1, l20_goals: 1, l10_goals: 1, l5_goals: 1, prev_goals: 0.02, prev_gp: 30, l10_toi: 8.5, std_gp: 1 };
    expect(shrunkBaseline(oneGame, 'goals', 'W', params)).toBeLessThan(0.35);
    const veteran = { std_goals: 0.45, l20_goals: 0.45, l10_goals: 0.5, l5_goals: 0.6, prev_goals: 0.45, prev_gp: 82, l10_toi: 20, std_gp: 60 };
    expect(shrunkBaseline(veteran, 'goals', 'W', params)).toBeCloseTo(0.47, 1);
  });
});

describe('per-game projection with the shipped artifact', () => {
  it('produces finite, non-negative stats for a typical forward', () => {
    const f: Record<string, number> = { std_gp: 12, prev_gp: 82, home: 1, pos_C: 1, pos_W: 0, pos_D: 0, rest_days: 2, b2b: 0, team_games_next7: 3, availability_30d: 1, days_since_last_game: 2 };
    for (const stat of ['goals', 'assists', 'shots', 'ppPoints', 'hits', 'blocks', 'toi', 'ppToi']) {
      for (const w of ['std', 'l5', 'l10', 'l20', 'prev']) f[`${w}_${stat}`] = stat === 'toi' ? 18 : stat === 'ppToi' ? 2.5 : stat === 'shots' ? 2.8 : 0.5;
    }
    for (const stat of SKATER_TARGETS) {
      const value = perGameStat(artifact, stat, f, 'C');
      expect(Number.isFinite(value), stat).toBe(true);
      expect(value, stat).toBeGreaterThanOrEqual(0);
      expect(value, stat).toBeLessThan(6);
    }
  });
});

describe('fallback to the schedule-aware baseline', () => {
  const players = [{ id: '1', name: 'A', nhlTeam: 'BUF', positions: ['C'], isGoalie: false }, { id: '2', name: 'B', nhlTeam: 'OTT', positions: ['D'], isGoalie: false }] as Player[];
  const baseline = async () => players.map(p => ({ playerId: p.id, timeframe: 'next_7', gamesPlayed: 3, modelVersion: 'bench-boss-schedule-v1' }) as Projection);

  it('uses the model where it has a projection and the baseline elsewhere', async () => {
    const model = async () => [{ playerId: '1', timeframe: 'next_7', gamesPlayed: 2.8, source: 'model', modelVersion: 'm' }] as Projection[];
    const result = await combineProjections(players, { model, baseline });
    expect(result.map(p => [p.playerId, p.source])).toEqual([['1', 'model'], ['2', 'baseline']]);
  });
  it('returns the baseline when the model throws', async () => {
    const result = await combineProjections(players, { model: async () => { throw new Error('NHL down'); }, baseline });
    expect(result.every(p => p.source === 'baseline')).toBe(true);
    expect(result).toHaveLength(2);
  });
  it('returns the baseline when the model times out', async () => {
    const slow = () => new Promise<Projection[]>(resolve => setTimeout(() => resolve([]), 1000));
    const result = await combineProjections(players, { model: slow, baseline, timeoutMs: 20 });
    expect(result.every(p => p.source === 'baseline')).toBe(true);
  });
});

describe('fantasy range', () => {
  it('widens with variance and respects league weights', () => {
    const projection: Projection = { playerId: '1', timeframe: 'next_7', gamesPlayed: 3, skaterStats: { G: 1, A: 1, PTS: 2, plusMinus: 0, PPP: 0.5, SOG: 9, HIT: 3, BLK: 2, PIM: 0 }, variance: { G: 1, A: 1, PPP: 0.5, SOG: 9, HIT: 3, BLK: 2 }, intervalScale: 1 };
    const range = calculateFantasyRange(projection, defaultLeagueSettings)!;
    expect(range.low).toBeLessThan(range.mean);
    expect(range.high).toBeGreaterThan(range.mean);
    expect(range.low).toBeGreaterThanOrEqual(0);
    expect(calculateFantasyRange({ ...projection, variance: undefined }, defaultLeagueSettings)).toBeNull();
  });
});
