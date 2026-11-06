import { describe, expect, it } from 'vitest';
import { defaultLeagueSettings } from './calculator';
import { ageOn, defenseTable, normalizeGameLog, normalizeSeasons, seasonLabel } from './playerCard';
import { heat, matchupStars, meter, percentile, rankOf, skaterGamePoints, teamFullName, writeRead } from './playerCardMetrics';

describe('player card data', () => {
  it('labels seasons and ages', () => {
    expect(seasonLabel(20262027)).toBe('2026-27');
    expect(ageOn('1997-01-13', new Date('2026-11-05T12:00:00Z'))).toBe(29);
    expect(ageOn('1997-12-13', new Date('2026-11-05T12:00:00Z'))).toBe(28);
  });

  it('ranks defences by goals against per game', () => {
    const rows = [
      { abbrev: 'AAA', name: 'Aces', city: 'A', gp: 10, ga: 40 },
      { abbrev: 'BBB', name: 'Bees', city: 'B', gp: 10, ga: 20 },
    ] as never;
    const table = defenseTable(rows);
    expect(table.BBB.gaRank).toBe(1);
    expect(table.AAA).toMatchObject({ gaRank: 2, gaPerGame: 4 });
  });

  it('keeps NHL regular seasons only, newest first, and sorts the game log by date', () => {
    const seasons = normalizeSeasons([
      { season: 20252026, gameTypeId: 2, leagueAbbrev: 'NHL', gamesPlayed: 80, points: 100, teamName: { default: 'Edmonton Oilers' } },
      { season: 20262027, gameTypeId: 2, leagueAbbrev: 'NHL', gamesPlayed: 16, points: 40 },
      { season: 20262027, gameTypeId: 3, leagueAbbrev: 'NHL', gamesPlayed: 4 },
      { season: 20142015, gameTypeId: 2, leagueAbbrev: 'OHL', gamesPlayed: 47 },
    ]);
    expect(seasons.map(s => s.season)).toEqual([20262027, 20252026]);
    expect(seasons[1].team).toBe('Edmonton Oilers');
    const log = normalizeGameLog([
      { gameId: 2, gameDate: '2026-10-03', opponentAbbrev: 'CAR', homeRoadFlag: 'H', goals: 1, assists: 1, points: 2 },
      { gameId: 1, gameDate: '2026-10-01', opponentAbbrev: 'NJD', homeRoadFlag: 'R' },
    ]);
    expect(log.map(g => g.gameId)).toEqual([1, 2]);
    expect(log[1]).toMatchObject({ home: true, points: 2 });
  });
});

describe('player card metrics', () => {
  it('ranks and buckets', () => {
    expect(rankOf(10, [12, 10, 8])).toBe(2);
    expect(percentile(10, [12, 10, 8])).toBe(0.5);
    expect(meter('Overall', 0.95)).toMatchObject({ bars: 5, value: 'Very high' });
    expect(meter('Overall', 0)).toMatchObject({ bars: 1, value: 'Very low' });
  });

  it('gives leaky opponents more stars for skaters and fewer for goalies', () => {
    const leaky = { abbrev: 'X', name: 'X', gaPerGame: 4, gaRank: 32 };
    const stingy = { abbrev: 'Y', name: 'Y', gaPerGame: 2, gaRank: 1 };
    expect(matchupStars(leaky)).toBe(5);
    expect(matchupStars(stingy)).toBe(1);
    expect(matchupStars(leaky, 32, true)).toBe(1);
    expect(matchupStars(stingy, 32, true)).toBe(5);
    expect(matchupStars(undefined)).toBe(0);
  });

  it('colours cells against the player average', () => {
    expect(heat(6, 4)).toBe('good');
    expect(heat(2, 4)).toBe('bad');
    expect(heat(4, 4)).toBeUndefined();
    expect(heat(0, 0.4, 'count')).toBeUndefined();
    expect(heat(1, 0.4, 'count')).toBe('good');
    expect(heat(-1, 0, 'signed')).toBe('bad');
  });

  it('scores a game with league weights', () => {
    const game = { gameId: 1, date: '2026-10-01', opponent: 'NJD', home: true, goals: 1, assists: 1, points: 2, plusMinus: 1, ppp: 1, shots: 4, pim: 0, toi: '20:00' };
    expect(skaterGamePoints(game, defaultLeagueSettings)).toBeGreaterThan(0);
  });

  it('writes full team names once', () => {
    expect(teamFullName({ name: 'Ducks', city: 'Anaheim' })).toBe('Anaheim Ducks');
    expect(teamFullName({ name: 'Rangers', city: 'NY Rangers' })).toBe('NY Rangers');
    expect(teamFullName({ name: 'Anaheim Ducks', city: 'Anaheim' })).toBe('Anaheim Ducks');
  });

  it('writes a read only from the data it is given', () => {
    const read = writeRead({ name: 'Test Player', isGoalie: false, games: [], projection: null, injury: null });
    expect(read).toBe('');
    const withInjury = writeRead({ name: 'Test Player', isGoalie: false, games: [], projection: null, injury: 'Day-to-Day' });
    expect(withInjury).toContain('day-to-day');
  });
});

describe('form wording', () => {
  it('never calls a pointless stretch hot', () => {
    const games = Array.from({ length: 5 }, (_, i) => ({ gameId: i, date: `2026-10-0${i + 1}`, opponent: 'NJD', home: true, goals: 0, assists: 0, points: 0, plusMinus: 0, ppp: 0, shots: 1, pim: 0, toi: '10:00' }));
    expect(writeRead({ name: 'A B', isGoalie: false, games, seasonPpg: 0, projection: null })).toContain('steady');
  });
});
