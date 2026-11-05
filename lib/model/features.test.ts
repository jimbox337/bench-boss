import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { availabilityFeatures, buildIndexes, skaterFeatures, type FeatureInputs, type Position, type SeasonTotals, type TeamTotals } from './features';

type Fixture = {
  date: string;
  skaterRows: FeatureInputs['skaterRows'];
  teamRows: FeatureInputs['teamRows'];
  seasonTotals: Record<string, SeasonTotals>;
  prevSeasonTotals: Record<string, SeasonTotals>;
  teamTotals: Record<string, TeamTotals>;
  schedule: FeatureInputs['schedule'];
  expectedSkaters: { playerId: number; team: string; opp: string; home: number; position: Position; features: Record<string, number | null> }[];
  expectedAvailability: { playerId: number; team: string; home: number; position: Position; features: Record<string, number | null> }[];
};

const fixture: Fixture = JSON.parse(readFileSync(join(__dirname, '__fixtures__', 'parity.json'), 'utf8'));
const toMap = <T,>(o: Record<string, T>) => new Map(Object.entries(o).map(([k, v]) => [Number(k), v]));
const inputs: FeatureInputs = {
  skaterRows: fixture.skaterRows,
  teamRows: fixture.teamRows,
  seasonTotals: toMap(fixture.seasonTotals),
  prevSeasonTotals: toMap(fixture.prevSeasonTotals),
  teamTotals: new Map(Object.entries(fixture.teamTotals)),
  schedule: fixture.schedule,
};
const index = buildIndexes(inputs);

function expectSame(actual: Record<string, number>, expected: Record<string, number | null>, label: string) {
  for (const [name, value] of Object.entries(expected)) {
    const got = actual[name];
    if (value === null) expect(Number.isNaN(got), `${label} ${name} should be missing, got ${got}`).toBe(true);
    else expect(got, `${label} ${name}`).toBeCloseTo(value, 6);
  }
}

describe('runtime features match Python training features', () => {
  it(`skater features for ${fixture.expectedSkaters.length} players on ${fixture.date}`, () => {
    expect(fixture.expectedSkaters.length).toBeGreaterThan(50);
    for (const row of fixture.expectedSkaters) {
      const actual = skaterFeatures(row.playerId, row.position, row.team, row.opp, row.home, fixture.date, inputs, index);
      expectSame(actual, row.features, `player ${row.playerId}`);
    }
  });

  it(`availability features for ${fixture.expectedAvailability.length} candidates`, () => {
    for (const row of fixture.expectedAvailability) {
      const actual = availabilityFeatures(row.playerId, row.position, row.team, row.home, fixture.date, inputs, index);
      expect(actual, `player ${row.playerId} should be a candidate`).not.toBeNull();
      expectSame(actual!, row.features, `availability ${row.playerId}`);
    }
  });
});
