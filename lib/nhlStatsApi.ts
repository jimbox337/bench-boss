import { Player, Projection, SkaterStats } from './calculator';

// NHL Stats API - Much faster bulk endpoints
const NHL_STATS_API = 'https://api.nhle.com/stats/rest/en';

interface NHLStatsPlayer {
  playerId: number;
  skaterFullName: string;
  positionCode: string;
  teamAbbrevs: string;
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  ppGoals: number;
  ppPoints: number;
  shots: number;
  hits: number;
  blockedShots: number;
  penaltyMinutes: number;
}

/**
 * Fetch all NHL players with stats in one fast API call
 * This is MUCH faster than the previous approach
 */
export async function fetchAllPlayersWithStats(): Promise<Player[]> {
  try {
    console.log('Fetching all NHL skater stats...');

    // Get all skaters with stats - single API call!
    const skatersUrl = `${NHL_STATS_API}/skater/summary?cayenneExp=seasonId=20252026 and gameTypeId=2&limit=-1`;
    const skatersRes = await fetch(skatersUrl);

    if (!skatersRes.ok) {
      throw new Error(`Failed to fetch skaters: ${skatersRes.status}`);
    }

    const skatersData = await skatersRes.json();
    const skaters: NHLStatsPlayer[] = skatersData.data || [];

    console.log(`✅ Fetched ${skaters.length} skaters from summary`);

    // Fetch realtime stats for hits and blocks
    console.log('Fetching realtime stats for hits and blocks...');
    const realtimeUrl = `${NHL_STATS_API}/skater/realtime?cayenneExp=seasonId=20252026 and gameTypeId=2&limit=-1`;
    const realtimeRes = await fetch(realtimeUrl);

    const realtimeMap = new Map<number, { hits: number; blockedShots: number }>();

    if (realtimeRes.ok) {
      const realtimeData = await realtimeRes.json();
      const realtimeStats = realtimeData.data || [];

      realtimeStats.forEach((stat: any) => {
        realtimeMap.set(stat.playerId, {
          hits: stat.hits || 0,
          blockedShots: stat.blockedShots || 0
        });
      });

      console.log(`✅ Fetched realtime stats for ${realtimeMap.size} skaters`);
    } else {
      console.warn('⚠️ Failed to fetch realtime stats, hits and blocks will be 0');
    }

    // Convert to our Player format
    const players: Player[] = skaters.map(s => {
      const realtimeStats = realtimeMap.get(s.playerId) || { hits: 0, blockedShots: 0 };

      return {
        id: s.playerId.toString(),
        name: s.skaterFullName,
        nhlTeam: s.teamAbbrevs.split(',')[0] || 'UNK', // Take first team if traded
        positions: [s.positionCode],
        isGoalie: false,
        gamesPlayed: s.gamesPlayed,
        seasonStats: {
          G: s.goals,
          A: s.assists,
          PTS: s.points,
          plusMinus: s.plusMinus,
          PPP: s.ppPoints,
          SOG: s.shots,
          HIT: realtimeStats.hits,
          BLK: realtimeStats.blockedShots,
          PIM: s.penaltyMinutes,
        }
      };
    });

    // Also fetch goalies
    console.log('Fetching all NHL goalie stats...');
    const goaliesUrl = `${NHL_STATS_API}/goalie/summary?cayenneExp=seasonId=20252026 and gameTypeId=2&limit=-1`;
    const goaliesRes = await fetch(goaliesUrl);

    if (goaliesRes.ok) {
      const goaliesData = await goaliesRes.json();
      const goalies = goaliesData.data || [];

      console.log(`✅ Fetched ${goalies.length} goalies`);

      goalies.forEach((g: any) => {
        players.push({
          id: g.playerId.toString(),
          name: g.goalieFullName,
          nhlTeam: g.teamAbbrevs.split(',')[0] || 'UNK',
          positions: ['G'],
          isGoalie: true,
          gamesPlayed: g.gamesPlayed,
        });
      });
    }

    console.log(`✅ Total players loaded: ${players.length}`);
    return players;

  } catch (error) {
    console.error('Error fetching NHL stats:', error);
    throw error;
  }
}

/**
 * Generate simple projections based on current stats
 */
export async function generateSimpleProjections(players: Player[]): Promise<Projection[]> {
  const projections: Projection[] = [];

  // Simple projection: assume similar performance over next 7 games
  const avgGamesPerWeek = 3;

  players.forEach(player => {
    if (player.isGoalie || !player.seasonStats || !player.gamesPlayed) return;

    const gamesPlayed = player.gamesPlayed;
    if (gamesPlayed === 0) return;

    // Calculate per-game averages
    const stats = player.seasonStats;
    const projection: Projection = {
      playerId: player.id,
      timeframe: 'next_7',
      gamesPlayed: avgGamesPerWeek,
      skaterStats: {
        G: (stats.G / gamesPlayed) * avgGamesPerWeek,
        A: (stats.A / gamesPlayed) * avgGamesPerWeek,
        PTS: (stats.PTS / gamesPlayed) * avgGamesPerWeek,
        plusMinus: (stats.plusMinus / gamesPlayed) * avgGamesPerWeek,
        PPP: (stats.PPP / gamesPlayed) * avgGamesPerWeek,
        SOG: (stats.SOG / gamesPlayed) * avgGamesPerWeek,
        HIT: (stats.HIT / gamesPlayed) * avgGamesPerWeek,
        BLK: (stats.BLK / gamesPlayed) * avgGamesPerWeek,
        PIM: (stats.PIM / gamesPlayed) * avgGamesPerWeek,
      }
    };

    projections.push(projection);
  });

  return projections;
}

/**
 * Load all data - single fast call
 */
export async function loadFastNHLData() {
  const players = await fetchAllPlayersWithStats();
  const projections = await generateSimpleProjections(players);

  return { players, projections };
}
