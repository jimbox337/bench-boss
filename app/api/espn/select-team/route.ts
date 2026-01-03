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

    const { leagueId, seasonId, espnS2, swid, teamId } = body;

    if (!leagueId || !seasonId || !teamId) {
      return NextResponse.json({ error: 'League ID, Season ID, and Team ID are required' }, { status: 400 });
    }

    // Build ESPN config
    const espnConfig: ESPNLeagueConfig = {
      leagueId: leagueId.toString(),
      seasonId: parseInt(seasonId),
      espnS2: espnS2 || undefined,
      swid: swid || undefined,
    };

    // Fetch league info and teams from ESPN
    let leagueInfo, teams;
    try {
      [leagueInfo, teams] = await Promise.all([
        fetchESPNLeagueInfo(espnConfig),
        fetchESPNTeams(espnConfig),
      ]);
    } catch (error: any) {
      console.error('Error fetching ESPN data:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch data from ESPN. Please try again.',
      }, { status: 400 });
    }

    // Find the selected team
    const selectedTeam = teams.find(t => t.id === teamId);

    if (!selectedTeam) {
      return NextResponse.json({
        success: false,
        error: 'Selected team not found in league.',
      }, { status: 400 });
    }

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
      roster: selectedTeam.roster,
      leagueSettings: leagueInfo.settings,
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
    console.error('Error selecting ESPN team:', error);
    return NextResponse.json({
      success: false,
      error: 'An unexpected error occurred',
    }, { status: 500 });
  }
}
