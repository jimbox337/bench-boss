import { describe, expect, it } from 'vitest';
import { authorizeUrl, collection, flatten, leagueKeyOfTeam, parseLeagues, parseRoster, parseSettings, parseTeams, yahooConfig } from './yahooFantasy';

const usersPayload = (child: 'leagues' | 'teams', items: unknown[]) => ({
  fantasy_content: {
    users: {
      0: { user: [[{ guid: 'ABC' }], { games: { 0: { game: [{ game_key: '465', code: 'nhl' }, { [child]: Object.fromEntries([...items.map((v, i) => [String(i), v]), ['count', items.length]]) }] }, count: 1 } }] },
      count: 1,
    },
  },
});

describe('config and helpers', () => {
  it('requires all three environment variables', () => {
    expect(yahooConfig({ YAHOO_CLIENT_ID: 'a', YAHOO_CLIENT_SECRET: 'b' })).toBeNull();
    expect(yahooConfig({ YAHOO_CLIENT_ID: 'a', YAHOO_CLIENT_SECRET: 'b', YAHOO_REDIRECT_URI: 'https://x/cb' })).toMatchObject({ clientId: 'a' });
  });
  it('builds an authorization URL with state and redirect', () => {
    const url = new URL(authorizeUrl({ clientId: 'id', clientSecret: 's', redirectUri: 'https://x/cb' }, 'st8'));
    expect(url.hostname).toBe('api.login.yahoo.com');
    expect(url.searchParams.get('state')).toBe('st8');
    expect(url.searchParams.get('redirect_uri')).toBe('https://x/cb');
    expect(url.searchParams.get('response_type')).toBe('code');
  });
  it('flattens arrays of single-key objects and reads numeric collections in order', () => {
    expect(flatten([{ a: 1 }, [], { b: 2 }, [{ c: 3 }]])).toEqual({ a: 1, b: 2, c: 3 });
    expect(collection({ 1: 'b', 0: 'a', count: 2 })).toEqual(['a', 'b']);
    expect(leagueKeyOfTeam('465.l.12345.t.7')).toBe('465.l.12345');
  });
});

describe('leagues and teams', () => {
  it('parses leagues', () => {
    const payload = usersPayload('leagues', [{ league: [{ league_key: '465.l.12345', name: 'Bar Down', season: '2026', num_teams: 12, scoring_type: 'headpoint' }] }]);
    expect(parseLeagues(payload)).toEqual([{ leagueKey: '465.l.12345', name: 'Bar Down', season: '2026', numTeams: 12, scoringType: 'headpoint' }]);
  });
  it('parses the user team with its logo and league key', () => {
    const payload = usersPayload('teams', [{ team: [[{ team_key: '465.l.12345.t.7' }, { name: 'Ice Hogs' }, { team_logos: [{ team_logo: { size: 'large', url: 'https://img/logo.png' } }] }]] }]);
    expect(parseTeams(payload)).toEqual([{ teamKey: '465.l.12345.t.7', leagueKey: '465.l.12345', name: 'Ice Hogs', logo: 'https://img/logo.png' }]);
  });
  it('returns empty lists for unexpected shapes', () => {
    expect(parseLeagues({})).toEqual([]);
    expect(parseTeams(null)).toEqual([]);
  });
});

describe('settings', () => {
  const settingsPayload = (scoring: string) => ({
    fantasy_content: {
      league: [{ league_key: '465.l.12345' }, {
        settings: [{
          scoring_type: scoring,
          roster_positions: [{ roster_position: { position: 'C', count: 2 } }, { roster_position: { position: 'Util', count: 1 } }, { roster_position: { position: 'BN', count: 4 } }, { roster_position: { position: 'IR+', count: 1 } }],
          stat_categories: { stats: [
            { stat: { stat_id: 1, display_name: 'G' } }, { stat: { stat_id: 2, display_name: 'A' } },
            { stat: { stat_id: 31, display_name: 'HIT' } }, { stat: { stat_id: 19, display_name: 'W' } },
            { stat: { stat_id: 99, display_name: 'FW' } }, { stat: { stat_id: 3, display_name: 'P', is_only_display_stat: '1' } },
          ] },
          stat_modifiers: { stats: [{ stat: { stat_id: 1, value: '3' } }, { stat: { stat_id: 2, value: '2' } }, { stat: { stat_id: 31, value: '0.5' } }, { stat: { stat_id: 19, value: '4' } }] },
        }],
      }],
    },
  });

  it('maps a points league to point weights and roster slots', () => {
    const { settings, unsupportedStats } = parseSettings(settingsPayload('headpoint'));
    expect(settings.scoringType).toBe('H2H_Points');
    expect(settings.pointsPerStat).toEqual({ G: 3, A: 2, HIT: 0.5, W: 4 });
    expect(settings.rosterSlots).toMatchObject({ C: 2, UTIL: 1, BN: 4, IR: 1 });
    expect(unsupportedStats).toEqual(['FW']);
  });
  it('maps a category league to skater and goalie categories', () => {
    const { settings } = parseSettings(settingsPayload('head'));
    expect(settings.scoringType).toBe('H2H_Categories');
    expect(settings.skaterCategories).toEqual(['G', 'A', 'HIT']);
    expect(settings.goalieCategories).toEqual(['W']);
  });
});

describe('roster', () => {
  it('parses players with team and positions', () => {
    const payload = {
      fantasy_content: {
        team: [[{ team_key: '465.l.12345.t.7' }], {
          roster: { 0: { players: {
            0: { player: [[{ player_key: '465.p.6743' }, { player_id: '6743' }, { name: { full: 'Tim Stützle', first: 'Tim' } }, { editorial_team_abbr: 'Ott' }, { display_position: 'C,LW' }], { selected_position: [{ coverage_type: 'date' }, { position: 'C' }] }] },
            1: { player: [[{ player_id: '1' }, { name: { full: 'Andrei Vasilevskiy' } }, { editorial_team_abbr: 'TB' }, { display_position: 'G' }], {}] },
            count: 2,
          } }, count: 1 },
        }],
      },
    };
    expect(parseRoster(payload)).toEqual([
      { yahooId: '6743', name: 'Tim Stützle', nhlTeam: 'OTT', positions: ['C', 'LW'], selectedPosition: 'C' },
      { yahooId: '1', name: 'Andrei Vasilevskiy', nhlTeam: 'TB', positions: ['G'], selectedPosition: undefined },
    ]);
  });
});
