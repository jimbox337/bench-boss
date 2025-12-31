import { Player, Projection, SkaterStats } from './calculator';

const NHL_API_BASE = 'https://api-web.nhle.com/v1';

// All NHL team abbreviations
const NHL_TEAMS = [
  'ANA', 'BOS', 'BUF', 'CAR', 'CBJ', 'CGY', 'CHI', 'COL', 'DAL', 'DET',
  'EDM', 'FLA', 'LAK', 'MIN', 'MTL', 'NJD', 'NSH', 'NYI', 'NYR', 'OTT',
  'PHI', 'PIT', 'SEA', 'SJS', 'STL', 'TBL', 'TOR', 'VAN', 'VGK', 'WPG', 'WSH', 'ARI'
];

// Helper to delay between requests
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch current season stats for a player with retry logic
async function fetchPlayerStats(playerId: number, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await delay(100); // 100ms delay before each request
      const res = await fetch(`${NHL_API_BASE}/player/${playerId}/landing`);

      if (res.status === 429) {
        // Rate limited - wait longer and retry
        console.warn(`Rate limited on player ${playerId}, waiting...`);
        await delay(2000 * (attempt + 1)); // Exponential backoff
        continue;
      }

      if (!res.ok) {
        throw new Error(`Failed to fetch player ${playerId}: ${res.status}`);
      }
      return res.json();
    } catch (error) {
      if (attempt === retries - 1) {
        console.error(`Error fetching player ${playerId} after ${retries} attempts:`, error);
        return null;
      }
      await delay(1000 * (attempt + 1));
    }
  }
  return null;
}

// Fetch roster for a specific team with retry logic
async function fetchTeamRoster(teamAbbrev: string, retries = 3): Promise<any> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await delay(200); // 200ms delay between team requests
      const res = await fetch(`${NHL_API_BASE}/roster/${teamAbbrev}/current`);

      if (res.status === 429) {
        console.warn(`Rate limited on ${teamAbbrev} roster, waiting...`);
        await delay(2000 * (attempt + 1));
        continue;
      }

      if (!res.ok) {
        console.warn(`Failed to fetch roster for ${teamAbbrev}: ${res.status}`);
        return null;
      }
      return res.json();
    } catch (error) {
      if (attempt === retries - 1) {
        console.error(`Error fetching roster for ${teamAbbrev}:`, error);
        return null;
      }
      await delay(1000 * (attempt + 1));
    }
  }
  return null;
}

// Fetch team schedule with retry logic
async function fetchTeamSchedule(teamAbbrev: string, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await delay(200); // 200ms delay
      const season = '20242025';
      const res = await fetch(`${NHL_API_BASE}/club-schedule-season/${teamAbbrev}/${season}`);

      if (res.status === 429) {
        console.warn(`Rate limited on ${teamAbbrev} schedule, waiting...`);
        await delay(2000 * (attempt + 1));
        continue;
      }

      if (!res.ok) {
        console.warn(`Failed to fetch schedule for ${teamAbbrev}: ${res.status}`);
        return null;
      }
      return res.json();
    } catch (error) {
      if (attempt === retries - 1) {
        console.error(`Error fetching schedule for ${teamAbbrev}:`, error);
        return null;
      }
      await delay(1000 * (attempt + 1));
    }
  }
  return null;
}

// Fetch all NHL players from all team rosters with their season stats
export async function fetchNHLRoster(): Promise<Player[]> {
  console.log('Fetching rosters from all 32 NHL teams...');
  const allPlayers: Player[] = [];

  // Fetch rosters in smaller batches with delays to avoid rate limiting
  const batchSize = 4; // Reduced from 8 to 4
  for (let i = 0; i < NHL_TEAMS.length; i += batchSize) {
    const batch = NHL_TEAMS.slice(i, i + batchSize);
    const batchPromises = batch.map(team => fetchTeamRoster(team));
    const batchResults = await Promise.all(batchPromises);

    for (let j = 0; j < batchResults.length; j++) {
      const roster = batchResults[j];
      const teamAbbrev = batch[j];

      if (!roster) continue;

      // Process forwards
      if (roster.forwards) {
        for (const player of roster.forwards) {
          allPlayers.push({
            id: player.id.toString(),
            name: `${player.firstName.default} ${player.lastName.default}`,
            nhlTeam: teamAbbrev,
            positions: [player.positionCode || 'F'],
            isGoalie: false,
          });
        }
      }

      // Process defensemen
      if (roster.defensemen) {
        for (const player of roster.defensemen) {
          allPlayers.push({
            id: player.id.toString(),
            name: `${player.firstName.default} ${player.lastName.default}`,
            nhlTeam: teamAbbrev,
            positions: ['D'],
            isGoalie: false,
          });
        }
      }

      // Process goalies
      if (roster.goalies) {
        for (const player of roster.goalies) {
          allPlayers.push({
            id: player.id.toString(),
            name: `${player.firstName.default} ${player.lastName.default}`,
            nhlTeam: teamAbbrev,
            positions: ['G'],
            isGoalie: true,
          });
        }
      }
    }

    console.log(`Processed ${i + batch.length}/${NHL_TEAMS.length} teams, ${allPlayers.length} players so far...`);

    // Add delay between batches to avoid rate limiting
    if (i + batchSize < NHL_TEAMS.length) {
      await delay(1000); // 1 second between batches
    }
  }

  console.log(`Total players fetched: ${allPlayers.length}`);
  return allPlayers;
}

// Extract current season stats from player data
function extractSeasonStats(playerData: any): SkaterStats | undefined {
  const currentSeasonStats = playerData?.featuredStats?.regularSeason?.season;
  if (!currentSeasonStats) return undefined;

  return {
    G: currentSeasonStats.goals || 0,
    A: currentSeasonStats.assists || 0,
    PTS: currentSeasonStats.points || 0,
    plusMinus: currentSeasonStats.plusMinus || 0,
    PPP: currentSeasonStats.powerPlayGoals + currentSeasonStats.powerPlayPoints || 0,
    SOG: currentSeasonStats.shots || 0,
    HIT: currentSeasonStats.hits || 0,
    BLK: currentSeasonStats.blockedShots || 0,
    PIM: currentSeasonStats.pim || 0,
  };
}

// Calculate per-game averages from season stats
function calculatePerGameStats(seasonStats: any): SkaterStats | null {
  if (!seasonStats || !seasonStats.gamesPlayed) {
    return null;
  }

  const gp = seasonStats.gamesPlayed;
  
  return {
    G: (seasonStats.goals || 0) / gp,
    A: (seasonStats.assists || 0) / gp,
    PTS: (seasonStats.points || 0) / gp,
    plusMinus: (seasonStats.plusMinus || 0) / gp,
    PPP: ((seasonStats.powerPlayGoals || 0) + (seasonStats.powerPlayPoints || 0)) / gp,
    SOG: (seasonStats.shots || 0) / gp,
    HIT: (seasonStats.hits || 0) / gp,
    BLK: (seasonStats.blockedShots || 0) / gp,
    PIM: (seasonStats.pim || 0) / gp,
  };
}

// Get upcoming games count for a team
async function getUpcomingGames(teamAbbrev: string, days: number = 7): Promise<number> {
  try {
    const schedule = await fetchTeamSchedule(teamAbbrev);
    
    if (!schedule || !schedule.games) {
      console.warn(`No schedule data for ${teamAbbrev}, defaulting to 3 games`);
      return 3;
    }

    const today = new Date();
    const futureDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
    
    const upcomingGames = schedule.games.filter((game: any) => {
      const gameDate = new Date(game.gameDate);
      return gameDate >= today && gameDate <= futureDate;
    }).length;
    
    return upcomingGames > 0 ? upcomingGames : 3;
  } catch (error) {
    console.error(`Error counting upcoming games for ${teamAbbrev}:`, error);
    return 3;
  }
}

// Generate projections for next N days (optimized for large player lists)
export async function generateProjections(
  players: Player[],
  days: number = 7
): Promise<Projection[]> {
  // For performance, only fetch stats for first 200 players
  // In production, you'd fetch on-demand or use a different approach
  const playersToFetch = players.slice(0, 200);
  console.log(`Generating projections for ${playersToFetch.length} of ${players.length} players...`);
  const projections: Projection[] = [];

  for (const player of playersToFetch) {
    try {
      console.log(`Fetching stats for ${player.name}...`);
      
      const playerData = await fetchPlayerStats(parseInt(player.id));
      
      if (!playerData) {
        console.warn(`No data returned for ${player.name}`);
        continue;
      }

      // Try to find current season stats
      const seasonStats = playerData.featuredStats?.regularSeason?.subSeason;
      
      if (!seasonStats) {
        console.warn(`No season stats found for ${player.name}`);
        continue;
      }

      console.log(`Stats for ${player.name}:`, seasonStats);

      // Get upcoming games
      const gamesPlayed = await getUpcomingGames(player.nhlTeam, days);

      // Calculate per-game averages
      const perGameStats = calculatePerGameStats(seasonStats);
      
      if (!perGameStats) {
        console.warn(`Could not calculate per-game stats for ${player.name}`);
        continue;
      }

      // Project stats over upcoming games
      const projectedStats: SkaterStats = {
        G: perGameStats.G * gamesPlayed,
        A: perGameStats.A * gamesPlayed,
        PTS: perGameStats.PTS * gamesPlayed,
        plusMinus: perGameStats.plusMinus * gamesPlayed,
        PPP: perGameStats.PPP * gamesPlayed,
        SOG: perGameStats.SOG * gamesPlayed,
        HIT: perGameStats.HIT * gamesPlayed,
        BLK: perGameStats.BLK * gamesPlayed,
        PIM: perGameStats.PIM * gamesPlayed,
      };

      projections.push({
        playerId: player.id,
        timeframe: 'next_7',
        gamesPlayed,
        skaterStats: projectedStats,
      });

      console.log(`✅ Generated projection for ${player.name}`);

    } catch (error) {
      console.error(`Error generating projection for ${player.name}:`, error);
    }
  }

  // Add placeholder projections for players without stats (so they still appear in lists)
  for (const player of players) {
    if (!projections.find(p => p.playerId === player.id)) {
      projections.push({
        playerId: player.id,
        timeframe: 'next_7',
        gamesPlayed: 3,
        skaterStats: {
          G: 0.1,
          A: 0.2,
          PTS: 0.3,
          plusMinus: 0,
          PPP: 0.1,
          SOG: 1.5,
          HIT: 0.5,
          BLK: 0.3,
          PIM: 0.2,
        },
      });
    }
  }

  console.log(`Successfully generated ${projections.length} projections (${playersToFetch.length} detailed, ${projections.length - playersToFetch.length} placeholders)`);
  return projections;
}