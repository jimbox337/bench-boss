import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fetchESPNLeagueInfo, fetchESPNTeams, ESPNLeagueConfig } from '@/lib/espnFantasyApi';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await request.json();

    const { leagueId, seasonId, espnS2, swid } = body;

    if (!leagueId || !seasonId) {
      return NextResponse.json({ error: 'League ID and Season ID are required' }, { status: 400 });
    }

    // Build ESPN config
    const espnConfig: ESPNLeagueConfig = {
      leagueId: leagueId.toString(),
      seasonId: parseInt(seasonId),
      espnS2: espnS2 || undefined,
      swid: swid || undefined,
    };

    // Fetch league info from ESPN
    let leagueInfo;
    try {
      leagueInfo = await fetchESPNLeagueInfo(espnConfig);
    } catch (error: any) {
      console.error('Error fetching ESPN league:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to connect to ESPN league. Please check your League ID and try again. If your league is private, you may need to provide authentication cookies.',
      }, { status: 400 });
    }

    // Fetch teams from ESPN
    let teams;
    try {
      teams = await fetchESPNTeams(espnConfig);
    } catch (error: any) {
      console.error('Error fetching ESPN teams:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch teams from ESPN league. Please try again.',
      }, { status: 400 });
    }

    if (!teams || teams.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No teams found in the league. Please verify your League ID.',
      }, { status: 400 });
    }

    // For now, let user select their team if there are multiple teams
    // We'll store the league info and redirect to a team selection page
    if (teams.length > 1) {
      // Store ESPN config temporarily in session or return teams for selection
      return NextResponse.json({
        success: true,
        requiresTeamSelection: true,
        league: {
          id: leagueInfo.id,
          name: leagueInfo.name,
          seasonId: leagueInfo.seasonId,
        },
        teams: teams.map(t => ({
          id: t.id,
          name: t.name,
          abbrev: t.abbrev,
          logo: t.logo,
        })),
        leagueId,
        seasonId,
        espnS2,
        swid,
      });
    }

    // If only one team, auto-select it
    const selectedTeam = teams[0];

    // Deactivate all other teams for this user
    await prisma.team.updateMany({
      where: { userId },
      data: { isActive: false },
    });

    // Check if team already exists
    let team = await prisma.team.findFirst({
      where: {
        userId,
        espnLeagueId: leagueId.toString(),
        espnTeamId: selectedTeam.id.toString(),
      },
    });

    const teamData = {
      name: selectedTeam.name,
      platform: 'espn',
      logo: selectedTeam.logo || null,
      espnLeagueId: leagueId.toString(),
      espnTeamId: selectedTeam.id.toString(),
      espnS2: espnS2 || null,
      swid: swid || null,
      seasonId: seasonId.toString(),
      roster: selectedTeam.roster as any,
      leagueSettings: leagueInfo.settings as any,
      lastSyncedAt: new Date(),
      isActive: true,
    };

    if (team) {
      // Update existing team
      team = await prisma.team.update({
        where: { id: team.id },
        data: teamData,
      });
    } else {
      // Create new team
      team = await prisma.team.create({
        data: {
          userId,
          ...teamData,
        },
      });
    }

    return NextResponse.json({
      success: true,
      team,
    });
  } catch (error) {
    console.error('Error connecting ESPN league:', error);
    return NextResponse.json({
      success: false,
      error: 'An unexpected error occurred while connecting your league',
    }, { status: 500 });
  }
}
