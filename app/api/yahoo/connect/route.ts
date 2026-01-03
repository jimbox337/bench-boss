import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await request.json();

    const { leagueId } = body;

    if (!leagueId) {
      return NextResponse.json({ error: 'League ID is required' }, { status: 400 });
    }

    // Note: Yahoo Fantasy API requires OAuth authentication
    // For now, we'll create a placeholder team entry
    // In production, you'd need to implement Yahoo OAuth flow

    // Deactivate all other teams for this user
    await prisma.team.updateMany({
      where: { userId },
      data: { isActive: false },
    });

    // Check if team already exists
    let team = await prisma.team.findFirst({
      where: {
        userId,
        platform: 'yahoo',
        espnLeagueId: leagueId.toString(), // Reusing this field for Yahoo league ID
      },
    });

    const teamData = {
      name: `Yahoo League ${leagueId}`,
      platform: 'yahoo',
      logo: null,
      espnLeagueId: leagueId.toString(), // Storing Yahoo league ID here
      espnTeamId: null,
      espnS2: null,
      swid: null,
      seasonId: '2025',
      roster: null,
      leagueSettings: null,
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
      message: 'Yahoo league connected successfully. Full sync coming soon!',
    });
  } catch (error) {
    console.error('Error connecting Yahoo league:', error);
    return NextResponse.json({
      success: false,
      error: 'An unexpected error occurred while connecting your league',
    }, { status: 500 });
  }
}
