import { describe, expect, it } from 'vitest';
import type { LeagueSettings } from './calculator';
import {
  deriveLineScore,
  goalieFantasyPoints,
  normalizeScoreGame,
  normalizeTeamSchedule,
  periodLabel,
  powerPlayPoints,
  scheduleVolume,
  skaterFantasyPoints,
  type GoalEvent,
  type SkaterLine,
} from './nhlGameCenter';

const goal = (period: string, team: string, scorerId: number, strength = 'ev', assists: number[] = []): GoalEvent => ({
  period, time: '10:00', team, scorerId, scorer: `P${scorerId}`, assists: assists.map(id => ({ playerId: id, name: `P${id}` })), strength,
});

const points: LeagueSettings = {
  scoringType: 'H2H_Points',
  pointsPerStat: { G: 3, A: 2, PPP: 1, SOG: 0.4, HIT: 0.2, BLK: 0.5, plusMinus: 1, W: 4, SV: 0.2, GA: -2, SO: 3 },
  rosterSlots: { C: 2, LW: 2, RW: 2, D: 4, G: 2, BN: 4 },
};

describe('periodLabel', () => {
  it('labels regulation, overtime and shootout', () => {
    expect(periodLabel(2, 'REG')).toBe('2');
    expect(periodLabel(4, 'OT')).toBe('OT');
    expect(periodLabel(5, 'OT')).toBe('2OT');
    expect(periodLabel(5, 'SO')).toBe('SO');
  });
});

describe('deriveLineScore', () => {
  it('counts goals per period and always shows three periods', () => {
    const goals = [goal('1', 'OTT', 1), goal('1', 'BUF', 2), goal('3', 'BUF', 3)];
    expect(deriveLineScore(goals, 'OTT', 'BUF')).toEqual({ periods: ['1', '2', '3'], away: [1, 0, 0], home: [1, 0, 1] });
  });
  it('adds overtime when it was played or is in progress', () => {
    expect(deriveLineScore([goal('OT', 'OTT', 1)], 'OTT', 'BUF').periods).toEqual(['1', '2', '3', 'OT']);
    expect(deriveLineScore([], 'OTT', 'BUF', 'OT').periods).toEqual(['1', '2', '3', 'OT']);
  });
});

describe('normalizeScoreGame', () => {
  it('excludes shootout goals from the line score and marks live state', () => {
    const game = normalizeScoreGame({
      id: 1, gameDate: '2026-11-04', startTimeUTC: '2026-11-05T00:30:00Z', gameState: 'LIVE',
      periodDescriptor: { number: 2, periodType: 'REG' }, clock: { timeRemaining: '05:36' },
      awayTeam: { abbrev: 'CHI', score: 0, sog: 3 }, homeTeam: { abbrev: 'FLA', score: 1, sog: 8 },
      goals: [{ playerId: 9, periodDescriptor: { number: 1, periodType: 'REG' }, teamAbbrev: { default: 'FLA' }, name: { default: 'S. Vilmanis' }, strength: 'ev', assists: [] }],
      tvBroadcasts: [{ network: 'TNT', countryCode: 'US' }, { network: 'SN', countryCode: 'CA' }, { network: 'X', countryCode: 'SE' }],
    });
    expect(game.isLive).toBe(true);
    expect(game.lineScore.home).toEqual([1, 0, 0]);
    expect(game.goals[0].scorer).toBe('S. Vilmanis');
    expect(game.broadcasts).toEqual(['TNT', 'SN']);
  });
});

describe('fantasy points', () => {
  it('credits power-play points to the scorer and assisters on PP goals only', () => {
    const ppp = powerPlayPoints([goal('1', 'FLA', 1, 'pp', [2, 3]), goal('2', 'FLA', 1, 'ev', [2])]);
    expect([ppp.get(1), ppp.get(2), ppp.get(3), ppp.get(4)]).toEqual([1, 1, 1, undefined]);
  });
  it('uses the league point weights for skaters', () => {
    const line: SkaterLine = { playerId: 1, team: 'FLA', name: 'X', position: 'C', goals: 1, assists: 1, points: 2, plusMinus: 1, pim: 0, hits: 2, ppGoals: 1, ppPoints: 1, sog: 3, blocks: 1, toi: '18:00' };
    // 3 + 2 + 1 (PPP) + 1.2 (SOG) + 0.4 (HIT) + 0.5 (BLK) + 1 (+/-) = 9.1
    expect(skaterFantasyPoints(line, points)).toBe(9.1);
  });
  it('scores goalies with wins, saves, goals against and shutouts', () => {
    expect(goalieFantasyPoints({ playerId: 1, team: 'FLA', name: 'G', saves: 30, shotsAgainst: 30, goalsAgainst: 0, toi: '60:00', decision: 'W', shutout: true }, points)).toBe(13);
    expect(goalieFantasyPoints({ playerId: 1, team: 'FLA', name: 'G', saves: 25, shotsAgainst: 28, goalsAgainst: 3, toi: '60:00', decision: 'L', shutout: false }, points)).toBe(-1);
  });
  it('returns null for category leagues', () => {
    const categories: LeagueSettings = { ...points, scoringType: 'H2H_Categories' };
    expect(goalieFantasyPoints({ playerId: 1, team: 'X', name: 'G', saves: 1, shotsAgainst: 1, goalsAgainst: 0, toi: '1:00', shutout: false }, categories)).toBeNull();
  });
});

describe('team schedule', () => {
  const raw = [
    { id: 1, gameDate: '2026-11-02', startTimeUTC: '', gameType: 2, gameState: 'OFF', awayTeam: { abbrev: 'BUF', score: 2 }, homeTeam: { abbrev: 'TOR', score: 3 }, gameOutcome: { lastPeriodType: 'OT' } },
    { id: 2, gameDate: '2026-11-04', startTimeUTC: '', gameType: 2, gameState: 'FUT', awayTeam: { abbrev: 'OTT' }, homeTeam: { abbrev: 'BUF' } },
    { id: 3, gameDate: '2026-11-05', startTimeUTC: '', gameType: 2, gameState: 'FUT', awayTeam: { abbrev: 'BUF' }, homeTeam: { abbrev: 'MTL' } },
    { id: 4, gameDate: '2026-11-11', startTimeUTC: '', gameType: 2, gameState: 'FUT', awayTeam: { abbrev: 'BOS' }, homeTeam: { abbrev: 'BUF' } },
    { id: 5, gameDate: '2026-09-25', startTimeUTC: '', gameType: 1, gameState: 'OFF', awayTeam: { abbrev: 'BUF', score: 1 }, homeTeam: { abbrev: 'PIT', score: 0 } },
  ];
  const schedule = normalizeTeamSchedule(raw, 'BUF');

  it('drops preseason games and records overtime losses', () => {
    expect(schedule.map(g => g.id)).toEqual([1, 2, 3, 4]);
    expect(schedule[0]).toMatchObject({ opponent: 'TOR', home: false, result: 'OTL', teamScore: 2, oppScore: 3 });
  });
  it('counts games, home/away and back-to-backs in the next seven days', () => {
    const volume = scheduleVolume(schedule, '2026-11-04');
    expect(volume).toMatchObject({ games: 2, home: 1, away: 1, backToBacks: 1 });
    expect(scheduleVolume(schedule, '2026-11-05').games).toBe(2); // Nov 5 and Nov 11
  });
});
