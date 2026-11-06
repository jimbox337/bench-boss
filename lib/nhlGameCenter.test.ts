import { describe, expect, it } from 'vitest';
import type { LeagueSettings } from './calculator';
import {
  slateDate,
  attachRecords,
  pickFeatured,
  normalizePlayByPlay,
  shotDistance,
  shotStrength,
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

describe('attachRecords', () => {
  it('adds standings records to scoreboard teams', () => {
    const game = normalizeScoreGame({ id: 1, gameDate: '2026-11-04', startTimeUTC: '', gameState: 'FUT', awayTeam: { abbrev: 'OTT' }, homeTeam: { abbrev: 'BUF' } });
    const row = { abbrev: 'OTT', name: 'Senators', conference: 'E', division: 'A', divisionRank: 1, gp: 16, w: 9, l: 6, otl: 1, pts: 19, pointPct: 0.6, gf: 1, ga: 1, diff: 0, l10: '', streak: '', homeRecord: '4-2-0', roadRecord: '5-4-1' };
    const [result] = attachRecords([game], [row]);
    expect(result.away.record).toBe('9-6-1');
    expect(result.home.record).toBeUndefined();
  });
});

describe('normalizePlayByPlay', () => {
  const payload = {
    rosterSpots: [
      { teamId: 13, playerId: 1, firstName: { default: 'Sandis' }, lastName: { default: 'Vilmanis' } },
      { teamId: 13, playerId: 2, firstName: { default: 'Sam' }, lastName: { default: 'Reinhart' } },
      { teamId: 16, playerId: 3, firstName: { default: 'Spencer' }, lastName: { default: 'Knight' } },
      { teamId: 16, playerId: 4, firstName: { default: 'Connor' }, lastName: { default: 'Bedard' } },
    ],
    plays: [
      { eventId: 30, sortOrder: 9, typeDescKey: 'period-end', timeInPeriod: '20:00', periodDescriptor: { number: 1, periodType: 'REG' } },
      { eventId: 172, sortOrder: 5, typeDescKey: 'goal', timeInPeriod: '04:43', periodDescriptor: { number: 1, periodType: 'REG' },
        details: { eventOwnerTeamId: 13, scoringPlayerId: 1, scoringPlayerTotal: 2, assist1PlayerId: 2, shotType: 'wrist', goalieInNetId: 3, awayScore: 0, homeScore: 1 } },
      { eventId: 275, sortOrder: 7, typeDescKey: 'penalty', timeInPeriod: '12:09', periodDescriptor: { number: 1, periodType: 'REG' },
        details: { eventOwnerTeamId: 16, committedByPlayerId: 4, drawnByPlayerId: 2, descKey: 'tripping', duration: 2 } },
      { eventId: 99, sortOrder: 6, typeDescKey: 'something-new', periodDescriptor: { number: 1 } },
    ],
  };
  const events = normalizePlayByPlay(payload, { 13: 'FLA', 16: 'CHI' });

  it('orders by sort order, resolves names and skips unknown events', () => {
    expect(events.map(e => e.kind)).toEqual(['goal', 'penalty', 'period']);
    expect(events[0]).toMatchObject({ team: 'FLA', score: '0–1', text: 'Goal: S. Vilmanis (2), wrist. Assists: S. Reinhart' });
    expect(events[1].text).toBe('Penalty: C. Bedard, 2 min for tripping, drawn by S. Reinhart');
    expect(events[2].text).toBe('End of 1st');
  });
  it('handles a missing feed', () => {
    expect(normalizePlayByPlay(null, {})).toEqual([]);
  });
});

describe('pickFeatured', () => {
  const make = (id: number, away: string, home: string, gameState: string, startTimeUTC = '2026-11-05T00:30:00Z') =>
    normalizeScoreGame({ id, gameDate: '2026-11-04', startTimeUTC, gameState, awayTeam: { abbrev: away }, homeTeam: { abbrev: home } });
  const games = [make(1, 'OTT', 'BUF', 'LIVE'), make(2, 'CHI', 'FLA', 'LIVE'), make(3, 'SJS', 'LAK', 'FUT', '2026-11-05T03:00:00Z'), make(4, 'NYR', 'STL', 'OFF')];

  it('prefers a live game with your players, then any live game', () => {
    expect(pickFeatured(games, new Set(['FLA']))).toMatchObject({ reason: 'Live with your players' });
    expect(pickFeatured(games, new Set(['FLA']))?.game.id).toBe(2);
    expect(pickFeatured(games, new Set())?.game.id).toBe(1);
  });
  it('falls back to the next game, then the latest final', () => {
    const later = [make(3, 'SJS', 'LAK', 'FUT'), make(4, 'NYR', 'STL', 'OFF')];
    expect(pickFeatured(later, new Set(['LAK']))).toMatchObject({ reason: 'Your players next' });
    expect(pickFeatured([make(4, 'NYR', 'STL', 'OFF')], new Set())).toMatchObject({ reason: 'Final' });
    expect(pickFeatured([], new Set())).toBeNull();
  });
});

describe('slateDate', () => {
  it('keeps last night until 10am Pacific, then shows today', () => {
    expect(slateDate(new Date('2026-11-05T16:59:00Z'))).toBe('2026-11-04'); // 08:59 PST
    expect(slateDate(new Date('2026-11-05T18:00:00Z'))).toBe('2026-11-05'); // 10:00 PST
    expect(slateDate(new Date('2026-07-01T17:00:00Z'))).toBe('2026-07-01'); // 10:00 PDT
    expect(slateDate(new Date('2026-03-01T07:30:00Z'))).toBe('2026-02-28'); // 23:30 PST, month edge
  });
});

describe('shot attempts', () => {
  const roster = [
    { teamId: 8, playerId: 10, firstName: { default: 'Cole' }, lastName: { default: 'Caufield' } },
    { teamId: 68, playerId: 20, firstName: { default: 'Clayton' }, lastName: { default: 'Keller' } },
    { teamId: 68, playerId: 21, firstName: { default: 'Karel' }, lastName: { default: 'Vejmelka' } },
  ];
  const period = { number: 1, periodType: 'REG' };
  const payload = {
    homeTeam: { id: 8 }, rosterSpots: roster,
    plays: [
      // Home (MTL) defends the right this period, so it shoots at the left net: flipped to the right.
      { eventId: 1, sortOrder: 1, typeDescKey: 'shot-on-goal', situationCode: '1451', homeTeamDefendingSide: 'right', periodDescriptor: period,
        details: { eventOwnerTeamId: 8, shootingPlayerId: 10, goalieInNetId: 21, shotType: 'snap', xCoord: -80, yCoord: 5 } },
      // Away shot at the right net that period: flipped to the left.
      { eventId: 2, sortOrder: 2, typeDescKey: 'missed-shot', situationCode: '1551', homeTeamDefendingSide: 'right', periodDescriptor: period,
        details: { eventOwnerTeamId: 68, shootingPlayerId: 20, reason: 'wide-of-net', xCoord: 70, yCoord: -10 } },
      // MTL blocks a UTA shot; the attempt is UTA's and lands in UTA's attacking (left) half.
      { eventId: 3, sortOrder: 3, typeDescKey: 'blocked-shot', situationCode: '1551', homeTeamDefendingSide: 'right', periodDescriptor: period,
        details: { eventOwnerTeamId: 8, blockingPlayerId: 10, shootingPlayerId: 20, xCoord: 60, yCoord: 4 } },
    ],
  };
  const shots = normalizePlayByPlay(payload, { 8: 'MTL', 68: 'UTA' }).map(e => e.shot);

  it('orients home attacks right and away attacks left', () => {
    expect(shots[0]).toMatchObject({ result: 'shot', team: 'MTL', shooter: 'C. Caufield', goalie: 'K. Vejmelka', shotType: 'snap', strength: 'PP', x: 80, y: -5 });
    expect(shots[1]).toMatchObject({ result: 'miss', team: 'UTA', reason: 'wide of net', strength: 'EV', x: -70, y: 10 });
    expect(shots[2]).toMatchObject({ result: 'block', team: 'UTA', shooter: 'C. Keller', blocker: 'C. Caufield', x: -60, y: -4 });
  });
  it('reads strength from the situation code', () => {
    expect(shotStrength('1451', false)).toBe('SH');
    expect(shotStrength('0651', true)).toBe('EN');
    expect(shotStrength(undefined, true)).toBe('EV');
  });
  it('measures distance to the attacked net', () => {
    expect(shotDistance({ x: 80, y: 0 }, true)).toBeCloseTo(9);
    expect(shotDistance({ x: -86, y: 4 }, false)).toBeCloseTo(5);
  });
});
