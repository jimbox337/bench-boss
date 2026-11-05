import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CONFIRMED_SOURCE,
  IN_NET_SOURCE,
  confirmedStarter,
  firstGoaliesInNet,
  startedGoalie,
  toiSeconds,
  getStartingGoalies,
  recentStartShares,
  resolveTeamStarter,
  type GoalieAppearance,
} from './goalieStarters';

function start(gameId: number, gameDate: string, playerId: number, team = 'BUF', started = true): GoalieAppearance {
  return { gameId, gameDate, playerId, name: `G${playerId}`, team, started };
}

const history: GoalieAppearance[] = [
  start(1, '2026-10-10', 30), start(2, '2026-10-12', 30), start(3, '2026-10-14', 31),
  start(4, '2026-10-16', 30), start(5, '2026-10-18', 31), start(6, '2026-10-20', 30),
  start(6, '2026-10-20', 31, 'BUF', false), // relief appearance, not a start
  start(7, '2026-10-22', 99, 'TOR'),
  start(8, '2026-11-04', 31), // same day as the game being resolved: must be ignored
];

describe('confirmedStarter', () => {
  it('returns the single goalie flagged by the NHL', () => {
    expect(confirmedStarter([{ playerId: 1, name: 'A', starter: false }, { playerId: 2, name: 'B', starter: true }])?.playerId).toBe(2);
  });
  it('treats missing or ambiguous flags as unconfirmed', () => {
    expect(confirmedStarter(undefined)).toBeNull();
    expect(confirmedStarter([{ playerId: 1, name: 'A' }, { playerId: 2, name: 'B' }])).toBeNull();
    expect(confirmedStarter([{ playerId: 1, name: 'A', starter: true }, { playerId: 2, name: 'B', starter: true }])).toBeNull();
  });
});

describe('recentStartShares', () => {
  it('counts starts in the team window, ignoring relief, other teams and same-day games', () => {
    const shares = recentStartShares(history, 'BUF', '2026-11-04');
    expect(shares).toEqual([
      { playerId: 30, name: 'G30', starts: 4, ofGames: 6 },
      { playerId: 31, name: 'G31', starts: 2, ofGames: 6 },
    ]);
  });
  it('limits to the most recent games', () => {
    const shares = recentStartShares(history, 'BUF', '2026-11-04', 2);
    expect(shares).toEqual([
      { playerId: 30, name: 'G30', starts: 1, ofGames: 2 },
      { playerId: 31, name: 'G31', starts: 1, ofGames: 2 },
    ]);
  });
});

describe('resolveTeamStarter', () => {
  it('prefers the NHL-confirmed starter over usage', () => {
    const result = resolveTeamStarter([{ playerId: 31, name: 'G31', starter: true }], history, 'BUF', '2026-11-04');
    expect(result).toEqual({ status: 'confirmed', playerId: 31, name: 'G31', source: CONFIRMED_SOURCE });
  });
  it('falls back to a clearly labelled likely starter', () => {
    const result = resolveTeamStarter(undefined, history, 'BUF', '2026-11-04');
    expect(result.status).toBe('likely');
    expect(result).toMatchObject({ playerId: 30, starts: 4, ofGames: 6 });
    expect(result.source).toMatch(/Not confirmed/);
  });
  it('says unknown rather than guessing when there is no data', () => {
    expect(resolveTeamStarter(undefined, [], 'SEA', '2026-11-04').status).toBe('unknown');
  });
});

describe('live games (NHL omits the starter flag until the game is final)', () => {
  const live = [{ playerId: 1, name: 'Ersson', toi: '09:18' }, { playerId: 2, name: 'Johansson', toi: '00:00' }];

  it('parses ice time', () => {
    expect(toiSeconds('09:18')).toBe(558);
    expect(toiSeconds('00:00')).toBe(0);
    expect(toiSeconds(undefined)).toBe(0);
  });
  it('confirms the only goalie with ice time once the game is live', () => {
    expect(resolveTeamStarter(live, history, 'OTT', '2026-11-04', 'LIVE')).toEqual({ status: 'confirmed', playerId: 1, name: 'Ersson', source: IN_NET_SOURCE });
  });
  it('does not treat ice time as confirmation before puck drop', () => {
    expect(resolveTeamStarter(live, history, 'BUF', '2026-11-04', 'PRE').status).toBe('likely');
  });
  it('uses the first goalie in net when a starter was pulled', () => {
    const pulled = [{ playerId: 1, name: 'A', toi: '25:00' }, { playerId: 2, name: 'B', toi: '20:00' }];
    expect(startedGoalie(pulled)).toBeNull();
    expect(startedGoalie(pulled, 2)?.name).toBe('B');
    expect(resolveTeamStarter(pulled, [], 'OTT', '2026-11-04', 'LIVE', 2)).toMatchObject({ status: 'confirmed', playerId: 2 });
  });
  it('reads the first goalie each team faced from the play-by-play', () => {
    // OTT (away, id 9) shoots first at BUF goalie 8481551; BUF (home, id 7) shoots at 8481035.
    const pbp = { plays: [{ details: {} }, { details: { goalieInNetId: 8481551, eventOwnerTeamId: 9 } },
      { details: { goalieInNetId: 8481035, eventOwnerTeamId: 7 } }, { details: { goalieInNetId: 999, eventOwnerTeamId: 7 } }] };
    expect(firstGoaliesInNet(pbp, 9, 7)).toEqual({ home: 8481551, away: 8481035 });
  });
});

describe('getStartingGoalies', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses one usage query plus one boxscore per game and falls back when the boxscore fails', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(url);
      if (url.includes('goalie/summary')) {
        return new Response(JSON.stringify({ data: [{ gameId: 1, gameDate: '2026-11-01', playerId: 30, goalieFullName: 'G30', teamAbbrev: 'BUF', gamesStarted: 1 }] }));
      }
      if (url.includes('/100/boxscore')) {
        return new Response(JSON.stringify({ gameState: 'PRE', playerByGameStats: {
          awayTeam: { goalies: [{ playerId: 50, name: { default: 'Away G' }, starter: true }] },
          homeTeam: { goalies: [{ playerId: 30, name: { default: 'G30' }, starter: false }, { playerId: 31, name: { default: 'G31' }, starter: true }] },
        } }));
      }
      return new Response('error', { status: 500 });
    }));
    const games = [
      { id: 100, startTimeUTC: '2026-11-05T00:30:00Z', gameDate: '2026-11-04', gameState: 'PRE', awayTeam: { abbrev: 'OTT' }, homeTeam: { abbrev: 'BUF' } },
      { id: 101, startTimeUTC: '2026-11-05T00:30:00Z', gameDate: '2026-11-04', gameState: 'FUT', awayTeam: { abbrev: 'SEA' }, homeTeam: { abbrev: 'BUF' } },
    ];
    const result = await getStartingGoalies(games, new Date('2026-11-04T20:00:00Z'));
    expect(calls).toHaveLength(3);
    expect(result[0].home.starter).toMatchObject({ status: 'confirmed', playerId: 31 });
    expect(result[0].away.starter).toMatchObject({ status: 'confirmed', playerId: 50 });
    expect(result[1].home.starter).toMatchObject({ status: 'likely', playerId: 30 });
    expect(result[1].away.starter.status).toBe('unknown');
  });
});
