/**
 * ESPN Fantasy Hockey API Integration
 *
 * This module handles fetching data from ESPN Fantasy Hockey leagues.
 * Note: ESPN's Fantasy API is unofficial and undocumented.
 */

import { LeagueSettings, Player, SkaterStats } from './calculator';

// Base URL for ESPN Fantasy API (as of April 2024)
const ESPN_API_BASE = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games';
const SPORT_CODE = 'fhl'; // Fantasy Hockey League

export interface ESPNLeagueConfig {
  leagueId: string;
  seasonId: number;
  espnS2?: string; // Required for private leagues
  swid?: string;   // Required for private leagues
}

export interface ESPNLeagueInfo {
  id: string;
  name: string;
  seasonId: number;
  size: number; // Number of teams
  settings: LeagueSettings;
}

export interface ESPNTeam {
  id: number;
  name: string;
  abbrev: string;
  logo?: string;
  primaryOwner?: string; // SWID of team owner, used for auto-detection
  roster: ESPNRosterEntry[];
}

export interface ESPNRosterEntry {
  playerId: number;
  playerName: string;
  position: string;
  defaultPosition: string;
  lineupSlotId: number;
  acquisitionType: string;
}

/**
 * Build the base URL for ESPN Fantasy API calls
 */
function buildLeagueUrl(config: ESPNLeagueConfig, views: string | string[]): string {
  const { leagueId, seasonId } = config;
  const url = `${ESPN_API_BASE}/${SPORT_CODE}/seasons/${seasonId}/segments/0/leagues/${leagueId}`;
  const viewList = Array.isArray(views) ? views : [views];
  return url + '?' + viewList.map(v => `view=${v}`).join('&');
}

/**
 * Fetch data from ESPN API with optional authentication
 */
async function fetchESPN(url: string, config: ESPNLeagueConfig): Promise<any> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Fantasy-Source': 'kona',
    'X-Fantasy-Platform': 'kona-PROD-c897b6aa89ea6e35c9d1e4f780a16fa28c44d62d',
  };

  // Normalize SWID — ESPN requires curly braces
  const rawSwid = config.swid?.trim() ?? '';
  const swid = rawSwid && !rawSwid.startsWith('{') ? `{${rawSwid}}` : rawSwid;

  // Add cookies for private league access
  const cookies: string[] = [];
  if (config.espnS2) {
    cookies.push(`espn_s2=${config.espnS2.trim()}`);
  }
  if (swid) {
    cookies.push(`SWID=${swid}`);
  }
  if (cookies.length > 0) {
    headers['Cookie'] = cookies.join('; ');
  }

  console.log(`ESPN fetch: ${url} | cookies: ${cookies.length > 0 ? 'yes' : 'none'}`);

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`ESPN API error ${response.status}: ${body.slice(0, 200)}`);
    if (response.status === 401 || response.status === 403) {
      throw new Error(`Private league access denied (${response.status}). Check that your espn_s2 and SWID cookies are correct and not expired.`);
    }
    throw new Error(`ESPN API error ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch league information and settings from ESPN
 */
export async function fetchESPNLeagueInfo(config: ESPNLeagueConfig): Promise<ESPNLeagueInfo> {
  const url = buildLeagueUrl(config, ['mSettings']);
  const data = await fetchESPN(url, config);

  // Parse league settings
  const settings = data.settings;
  const scoringSettings = settings.scoringSettings;

  // Map ESPN scoring format to our format
  const leagueSettings: LeagueSettings = {
    scoringType: scoringSettings.scoringType === 'H2H_POINTS' ? 'H2H_Points' : 'H2H_Categories',
    rosterSlots: parseRosterSlots(settings.rosterSettings),
  };

  // Parse scoring points if it's a points league
  if (leagueSettings.scoringType === 'H2H_Points') {
    leagueSettings.pointsPerStat = parseScoringItems(scoringSettings.scoringItems);
  } else {
    // For category leagues, parse stat categories
    leagueSettings.skaterCategories = parseStatCategories(scoringSettings.scoringItems, false);
    leagueSettings.goalieCategories = parseStatCategories(scoringSettings.scoringItems, true);
  }

  return {
    id: config.leagueId,
    name: data.settings.name || 'ESPN League',
    seasonId: config.seasonId,
    size: data.settings.size || 0,
    settings: leagueSettings,
  };
}

/**
 * Parse ESPN roster slot configuration
 */
function parseRosterSlots(rosterSettings: any): LeagueSettings['rosterSlots'] {
  const lineupSlotCounts = rosterSettings.lineupSlotCounts || {};

  // ESPN lineup slot IDs for hockey:
  // 0 = C, 1 = LW, 2 = RW, 3 = D, 4 = G, 5 = UTIL, 20 = BN, 21 = IR
  return {
    C: lineupSlotCounts['0'] || 0,
    LW: lineupSlotCounts['1'] || 0,
    RW: lineupSlotCounts['2'] || 0,
    D: lineupSlotCounts['3'] || 0,
    G: lineupSlotCounts['4'] || 0,
    UTIL: lineupSlotCounts['5'] || 0,
    BN: lineupSlotCounts['20'] || 0,
    IR: lineupSlotCounts['21'] || 0,
  };
}

/**
 * Parse ESPN scoring items to our points format
 */
function parseScoringItems(scoringItems: any): { [key: string]: number } {
  const pointsPerStat: { [key: string]: number } = {};

  // ESPN stat IDs mapping (these are common hockey stats)
  const statIdMap: { [key: string]: string } = {
    '0': 'G',      // Goals
    '1': 'A',      // Assists
    '2': 'PTS',    // Points
    '3': 'plusMinus',
    '4': 'PPP',    // Power Play Points
    '5': 'SOG',    // Shots on Goal
    '6': 'HIT',    // Hits
    '7': 'BLK',    // Blocks
    '11': 'PIM',   // Penalty Minutes
    '19': 'W',     // Goalie Wins
    '20': 'SV',    // Saves
    '21': 'GA',    // Goals Against
    '22': 'GAA',   // Goals Against Average
    '23': 'SO',    // Shutouts
  };

  if (scoringItems) {
    for (const [statId, value] of Object.entries(scoringItems)) {
      const statName = statIdMap[statId];
      if (statName && typeof value === 'number') {
        pointsPerStat[statName] = value;
      }
    }
  }

  return pointsPerStat;
}

/**
 * Parse ESPN stat categories for category leagues
 */
function parseStatCategories(scoringItems: any, isGoalie: boolean): any[] {
  const categories: any[] = [];

  const skaterStats = ['G', 'A', 'PTS', 'plusMinus', 'PPP', 'SOG', 'HIT', 'BLK', 'PIM'];
  const goalieStats = ['W', 'SV', 'GA', 'GAA', 'SO', 'SV_PCT'];

  const statList = isGoalie ? goalieStats : skaterStats;

  // In category leagues, if a stat is in the scoring items, it's a category
  const statIdMap: { [key: string]: string } = {
    '0': 'G', '1': 'A', '2': 'PTS', '3': 'plusMinus', '4': 'PPP',
    '5': 'SOG', '6': 'HIT', '7': 'BLK', '11': 'PIM',
    '19': 'W', '20': 'SV', '21': 'GA', '22': 'GAA', '23': 'SO', '24': 'SV_PCT'
  };

  if (scoringItems) {
    for (const [statId, _] of Object.entries(scoringItems)) {
      const statName = statIdMap[statId];
      if (statName && statList.includes(statName)) {
        categories.push(statName);
      }
    }
  }

  return categories;
}

/**
 * Fetch all teams and rosters from ESPN league
 */
export async function fetchESPNTeams(config: ESPNLeagueConfig): Promise<ESPNTeam[]> {
  const url = buildLeagueUrl(config, ['mRoster', 'mTeam', 'mSettings']);
  const data = await fetchESPN(url, config);

  const teams: ESPNTeam[] = [];

  if (data.teams) {
    for (const team of data.teams) {
      const roster: ESPNRosterEntry[] = [];

      if (team.roster && team.roster.entries) {
        for (const entry of team.roster.entries) {
          const player = entry.playerPoolEntry?.player;
          if (player) {
            roster.push({
              playerId: player.id,
              playerName: player.fullName,
              position: getSlotName(entry.lineupSlotId),
              defaultPosition: player.defaultPositionId ? getDefaultPositionName(player.defaultPositionId) : 'UNKNOWN',
              lineupSlotId: entry.lineupSlotId,
              acquisitionType: entry.acquisitionType || 'UNKNOWN',
            });
          }
        }
      }

      // ESPN team name — log raw fields to diagnose missing names
      console.log(`ESPN team ${team.id} raw:`, JSON.stringify({
        name: team.name, location: team.location, nickname: team.nickname,
        teamLocation: team.teamLocation, teamNickname: team.teamNickname,
        abbrev: team.abbrev,
      }));

      const location = (team.location || team.teamLocation || '').trim();
      const nickname = (team.nickname || team.teamNickname || '').trim();
      let teamName = (team.name || '').trim();
      if (!teamName) {
        if (location && nickname) {
          teamName = `${location} ${nickname}`;
        } else {
          teamName = location || nickname || team.abbrev || `Team ${team.id}`;
        }
      }

      teams.push({
        id: team.id,
        name: teamName,
        abbrev: team.abbrev || team.teamAbbrev || '',
        logo: team.logo || team.logoUrl || undefined,
        primaryOwner: team.primaryOwner || undefined,
        roster,
      });
    }
  }

  return teams;
}

/**
 * ESPN lineup slot ID → position label (where on roster a player is placed)
 */
function getSlotName(slotId: number): string {
  const slotMap: { [key: number]: string } = {
    0: 'C', 1: 'LW', 2: 'RW', 3: 'F', 4: 'D', 5: 'G',
    6: 'UTIL', 17: 'F', 20: 'BN', 21: 'IR',
  };
  return slotMap[slotId] || 'BN';
}

/**
 * ESPN defaultPositionId → actual player position
 * This is separate from lineup slot IDs — the numbering is different.
 */
function getDefaultPositionName(posId: number): string {
  const posMap: { [key: number]: string } = {
    1: 'C', 2: 'LW', 3: 'RW', 4: 'D', 5: 'G',
  };
  return posMap[posId] || 'F';
}

/**
 * Find my team in the ESPN league
 * This requires knowing which team belongs to the authenticated user
 */
export async function fetchMyESPNTeam(config: ESPNLeagueConfig): Promise<ESPNTeam | null> {
  const url = buildLeagueUrl(config, 'mTeam');
  const data = await fetchESPN(url, config);

  // ESPN API should return the authenticated user's team(s)
  // The exact structure may vary, but typically there's a 'members' array
  // with a primaryOwner field indicating the user's team

  if (data.teams && data.teams.length > 0) {
    // For now, we'll need to identify which team is "mine"
    // This typically requires the team ID to be stored in user preferences
    // or by matching against the authenticated SWID

    // Return first team for now - in production, you'd match against SWID
    const teams = await fetchESPNTeams(config);
    return teams.length > 0 ? teams[0] : null;
  }

  return null;
}

/**
 * Map ESPN player IDs to our NHL player database
 * This is a best-effort matching based on player names
 */
export function mapESPNPlayersToNHL(
  espnRoster: ESPNRosterEntry[],
  nhlPlayers: Player[]
): Player[] {
  const mappedPlayers: Player[] = [];

  for (const espnPlayer of espnRoster) {
    // Try to find matching NHL player by name
    const nhlPlayer = nhlPlayers.find(p =>
      p.name.toLowerCase() === espnPlayer.playerName.toLowerCase()
    );

    if (nhlPlayer) {
      mappedPlayers.push(nhlPlayer);
    } else {
      console.warn(`Could not find NHL player match for: ${espnPlayer.playerName}`);
    }
  }

  return mappedPlayers;
}
