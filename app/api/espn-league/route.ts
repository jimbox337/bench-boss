import { NextRequest, NextResponse } from 'next/server';
import { fetchESPNLeagueInfo, fetchESPNTeams, ESPNLeagueConfig } from '@/lib/espnFantasyApi';

/**
 * API route to fetch ESPN Fantasy League information
 * POST /api/espn-league
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leagueId, seasonId, espnS2, swid, action } = body;

    if (!leagueId || !seasonId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: leagueId and seasonId' },
        { status: 400 }
      );
    }

    const config: ESPNLeagueConfig = {
      leagueId,
      seasonId: parseInt(seasonId),
      espnS2,
      swid,
    };

    // Handle different actions
    if (action === 'getLeagueInfo') {
      const leagueInfo = await fetchESPNLeagueInfo(config);
      return NextResponse.json({ success: true, leagueInfo });
    } else if (action === 'getTeams') {
      const teams = await fetchESPNTeams(config);
      return NextResponse.json({ success: true, teams });
    } else {
      // Default: fetch both league info and teams
      const [leagueInfo, teams] = await Promise.all([
        fetchESPNLeagueInfo(config),
        fetchESPNTeams(config),
      ]);
      return NextResponse.json({ success: true, leagueInfo, teams });
    }
  } catch (error) {
    console.error('ESPN API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch ESPN league data',
      },
      { status: 500 }
    );
  }
}
