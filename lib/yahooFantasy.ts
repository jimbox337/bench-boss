/**
 * Yahoo Fantasy Sports (NHL) integration: OAuth 2.0 authorization code flow + API helpers.
 *
 * Server configuration (Yahoo Developer app, free): YAHOO_CLIENT_ID, YAHOO_CLIENT_SECRET and
 * YAHOO_REDIRECT_URI (must exactly match the redirect URI registered with Yahoo, e.g.
 * https://bench-boss.vercel.app/api/yahoo/callback). Without them the integration reports
 * "not configured" instead of failing.
 *
 * Parsers are pure functions over Yahoo's JSON (?format=json), which nests most objects as
 * numeric-keyed maps and arrays of single-key objects.
 */
import type { LeagueSettings } from './calculator';

const AUTH_URL = 'https://api.login.yahoo.com/oauth2/request_auth';
const TOKEN_URL = 'https://api.login.yahoo.com/oauth2/get_token';
const API = 'https://fantasysports.yahooapis.com/fantasy/v2';

export type YahooConfig = { clientId: string; clientSecret: string; redirectUri: string };

export function yahooConfig(env: Record<string, string | undefined> = process.env): YahooConfig | null {
  const clientId = env.YAHOO_CLIENT_ID, clientSecret = env.YAHOO_CLIENT_SECRET, redirectUri = env.YAHOO_REDIRECT_URI;
  return clientId && clientSecret && redirectUri ? { clientId, clientSecret, redirectUri } : null;
}

export function authorizeUrl(config: YahooConfig, state: string): string {
  const params = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code', state, language: 'en-us' });
  return `${AUTH_URL}?${params.toString()}`;
}

export type YahooTokens = { accessToken: string; refreshToken: string; expiresAt: Date };

async function tokenRequest(config: YahooConfig, body: Record<string, string>): Promise<YahooTokens> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ redirect_uri: config.redirectUri, ...body }).toString(),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Yahoo token request failed (${response.status})`);
  const data = await response.json() as { access_token: string; refresh_token: string; expires_in: number };
  // Refresh a minute early so a request never goes out with an expiring token.
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: new Date(Date.now() + (data.expires_in - 60) * 1000) };
}

export const exchangeCode = (config: YahooConfig, code: string) => tokenRequest(config, { grant_type: 'authorization_code', code });
export const refreshTokens = (config: YahooConfig, refreshToken: string) => tokenRequest(config, { grant_type: 'refresh_token', refresh_token: refreshToken });

export async function yahooGet<T = unknown>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${API}/${path}${path.includes('?') ? '&' : '?'}format=json`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (response.status === 401) throw new Error('YAHOO_UNAUTHORIZED');
  if (!response.ok) throw new Error(`Yahoo API request failed (${response.status})`);
  return response.json() as Promise<T>;
}

// ------------------------------------------------------------------------------------
// JSON helpers
// ------------------------------------------------------------------------------------

type Json = unknown;
const isObject = (v: Json): v is Record<string, Json> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Merge Yahoo's arrays of single-key objects ([{a:1},{b:2},[]]) into one object. */
export function flatten(value: Json): Record<string, Json> {
  if (!Array.isArray(value)) return isObject(value) ? value : {};
  return value.reduce<Record<string, Json>>((acc, item) => (isObject(item) ? { ...acc, ...item } : Array.isArray(item) ? { ...acc, ...flatten(item) } : acc), {});
}

/** Values of a numeric-keyed collection ({"0": x, "1": y, count: 2}). */
export function collection(value: Json): Json[] {
  if (!isObject(value)) return [];
  return Object.keys(value).filter(k => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b)).map(k => value[k]);
}

const str = (v: Json) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

/** games -> first game -> its child collection (e.g. leagues / teams). */
function userGameChildren(payload: Json, child: 'leagues' | 'teams'): Json[] {
  const content = isObject(payload) ? payload.fantasy_content : undefined;
  const user = collection(isObject(content) ? content.users : undefined)[0];
  const userParts = isObject(user) && Array.isArray(user.user) ? user.user : [];
  const games = flatten(userParts).games;
  const out: Json[] = [];
  for (const game of collection(games)) {
    const parts = isObject(game) && Array.isArray(game.game) ? game.game : [];
    const container = flatten(parts)[child];
    out.push(...collection(container));
  }
  return out;
}

// ------------------------------------------------------------------------------------
// Parsers
// ------------------------------------------------------------------------------------

export type YahooLeague = { leagueKey: string; name: string; season: string; numTeams: number; scoringType: string };
export type YahooTeam = { teamKey: string; leagueKey: string; name: string; logo?: string };

export function parseLeagues(payload: Json): YahooLeague[] {
  return userGameChildren(payload, 'leagues').map(entry => {
    const league = flatten(isObject(entry) ? entry.league : undefined);
    return { leagueKey: str(league.league_key), name: str(league.name), season: str(league.season), numTeams: Number(league.num_teams) || 0, scoringType: str(league.scoring_type) };
  }).filter(l => l.leagueKey);
}

export const leagueKeyOfTeam = (teamKey: string) => teamKey.split('.t.')[0];

export function parseTeams(payload: Json): YahooTeam[] {
  return userGameChildren(payload, 'teams').map(entry => {
    const team = flatten(isObject(entry) ? entry.team : undefined);
    const logos = Array.isArray(team.team_logos) ? team.team_logos : [];
    const logo = flatten(logos.map(l => (isObject(l) ? l.team_logo : undefined)));
    const teamKey = str(team.team_key);
    return { teamKey, leagueKey: leagueKeyOfTeam(teamKey), name: str(team.name), logo: str(logo.url) || undefined };
  }).filter(t => t.teamKey);
}

/** Yahoo display names -> Bench Boss stat keys. */
const STAT_KEYS: Record<string, string> = {
  G: 'G', A: 'A', P: 'PTS', '+/-': 'plusMinus', PIM: 'PIM', PPP: 'PPP', SOG: 'SOG', HIT: 'HIT', BLK: 'BLK',
  W: 'W', SV: 'SV', GA: 'GA', GAA: 'GAA', 'SV%': 'SV_PCT', SHO: 'SO',
};
const GOALIE_STATS = new Set(['W', 'SV', 'GA', 'GAA', 'SV_PCT', 'SO']);

export type YahooLeagueSettings = { settings: LeagueSettings; unsupportedStats: string[] };

export function parseSettings(payload: Json): YahooLeagueSettings {
  const content = isObject(payload) ? payload.fantasy_content : undefined;
  const leagueParts = isObject(content) && Array.isArray(content.league) ? content.league : [];
  const settingsBlock = flatten(leagueParts).settings;
  const settings = flatten(Array.isArray(settingsBlock) ? settingsBlock[0] : settingsBlock);

  const categories = (isObject(settings.stat_categories) && Array.isArray(settings.stat_categories.stats) ? settings.stat_categories.stats : [])
    .map(s => (isObject(s) && isObject(s.stat) ? s.stat : {}))
    .filter(s => str(s.is_only_display_stat) !== '1');
  const modifiers = new Map(
    (isObject(settings.stat_modifiers) && Array.isArray(settings.stat_modifiers.stats) ? settings.stat_modifiers.stats : [])
      .map(s => (isObject(s) && isObject(s.stat) ? s.stat : {}))
      .map(s => [str(s.stat_id), Number(s.value)] as const),
  );

  const scoringType = str(settings.scoring_type);
  const isPoints = scoringType === 'point' || scoringType === 'headpoint';
  const unsupported: string[] = [];
  const pointsPerStat: Record<string, number> = {};
  const skaterCategories: string[] = [];
  const goalieCategories: string[] = [];
  for (const stat of categories) {
    const key = STAT_KEYS[str(stat.display_name)];
    if (!key) { unsupported.push(str(stat.display_name) || str(stat.stat_id)); continue; }
    if (isPoints) {
      const value = modifiers.get(str(stat.stat_id));
      if (value !== undefined && Number.isFinite(value)) pointsPerStat[key] = value;
    } else if (GOALIE_STATS.has(key)) goalieCategories.push(key);
    else skaterCategories.push(key);
  }

  const slots: Record<string, number> = {};
  for (const entry of Array.isArray(settings.roster_positions) ? settings.roster_positions : []) {
    const position = isObject(entry) && isObject(entry.roster_position) ? entry.roster_position : {};
    slots[str(position.position)] = (slots[str(position.position)] || 0) + (Number(position.count) || 0);
  }
  const leagueSettings: LeagueSettings = {
    scoringType: isPoints ? 'H2H_Points' : 'H2H_Categories',
    ...(isPoints ? { pointsPerStat } : { skaterCategories: skaterCategories as LeagueSettings['skaterCategories'], goalieCategories: goalieCategories as LeagueSettings['goalieCategories'] }),
    rosterSlots: {
      C: slots.C || 0, LW: slots.LW || 0, RW: slots.RW || 0, D: slots.D || 0, G: slots.G || 0,
      UTIL: (slots.Util || 0) + (slots.F || 0), BN: slots.BN || 0, IR: (slots.IR || 0) + (slots['IR+'] || 0),
    },
  };
  return { settings: leagueSettings, unsupportedStats: unsupported };
}

export type YahooRosterPlayer = { yahooId: string; name: string; nhlTeam: string; positions: string[]; selectedPosition?: string };

export function parseRoster(payload: Json): YahooRosterPlayer[] {
  const content = isObject(payload) ? payload.fantasy_content : undefined;
  const teamParts = isObject(content) && Array.isArray(content.team) ? content.team : [];
  const roster = flatten(teamParts).roster;
  const players = isObject(roster) ? collection(roster)[0] : undefined;
  const list = isObject(players) ? collection(players.players) : [];
  return list.map(entry => {
    const parts = isObject(entry) && Array.isArray(entry.player) ? entry.player : [];
    const info = flatten(parts[0]);
    const selected = flatten(isObject(parts[1]) ? parts[1].selected_position : undefined);
    const name = isObject(info.name) ? str(info.name.full) : '';
    return {
      yahooId: str(info.player_id), name, nhlTeam: str(info.editorial_team_abbr).toUpperCase(),
      positions: str(info.display_position).split(',').map(p => p.trim()).filter(Boolean),
      selectedPosition: str(selected.position) || undefined,
    };
  }).filter(p => p.name);
}
