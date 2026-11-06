import { describe, expect, it } from 'vitest';
import type { Player } from './calculator';
import { buildSampleRoster, matchPlayers, normalizeName, normalizeTeam, platformLabel } from './teamSetup';

const skater = (id: string, name: string, team: string, pos: string, pts: number): Player => ({
  id, name, nhlTeam: team, positions: [pos], isGoalie: false, gamesPlayed: 10,
  seasonStats: { G: 0, A: 0, PTS: pts, plusMinus: 0, PPP: 0, SOG: 0, HIT: 0, BLK: 0, PIM: 0 },
});
const goalie = (id: string, name: string, gp: number): Player => ({ id, name, nhlTeam: 'TBL', positions: ['G'], isGoalie: true, gamesPlayed: gp });

describe('names and teams', () => {
  it('ignores accents, punctuation and case', () => {
    expect(normalizeName('Tim Stützle')).toBe('tim stutzle');
    expect(normalizeName("Ryan O'Reilly")).toBe('ryan oreilly');
  });
  it('maps short team codes', () => {
    expect(normalizeTeam('Tb')).toBe('TBL');
    expect(normalizeTeam('NJ')).toBe('NJD');
    expect(normalizeTeam('Ott')).toBe('OTT');
  });
});

describe('matchPlayers', () => {
  const pool = [skater('1', 'Tim Stützle', 'OTT', 'C', 20), skater('2', 'Sebastian Aho', 'CAR', 'C', 18), skater('3', 'Sebastian Aho', 'NYI', 'D', 5)];
  it('matches by normalized name and uses the team to break ties', () => {
    const result = matchPlayers([{ name: 'Tim Stutzle', nhlTeam: 'Ott' }, { name: 'Sebastian Aho', nhlTeam: 'NYI' }], pool);
    expect(result.matched.map(p => p.id)).toEqual(['1', '3']);
    expect(result.unmatched).toEqual([]);
  });
  it('reports unknown or ambiguous players instead of guessing', () => {
    const result = matchPlayers([{ name: 'Nobody Here' }, { name: 'Sebastian Aho' }], pool);
    expect(result.matched).toEqual([]);
    expect(result.unmatched).toEqual(['Nobody Here', 'Sebastian Aho']);
  });
});

describe('buildSampleRoster', () => {
  it('takes the top producers per position and the busiest goalies', () => {
    const pool = [
      skater('c1', 'C One', 'BOS', 'C', 30), skater('c2', 'C Two', 'BOS', 'C', 10), skater('w1', 'W One', 'BOS', 'L', 25), skater('w2', 'W Two', 'BOS', 'R', 20),
      skater('d1', 'D One', 'BOS', 'D', 15), goalie('g1', 'G One', 12), goalie('g2', 'G Two', 3),
    ];
    const roster = buildSampleRoster(pool, { C: 1, W: 2, D: 1, G: 1 });
    expect(roster.map(p => p.id)).toEqual(['c1', 'w1', 'w2', 'd1', 'g1']);
  });
  it('labels test and legacy custom teams as test mode', () => {
    expect(platformLabel('Test')).toBe('Test mode');
    expect(platformLabel('Custom')).toBe('Test mode');
    expect(platformLabel('yahoo')).toBe('Yahoo');
    expect(platformLabel('ESPN')).toBe('ESPN');
  });
});
