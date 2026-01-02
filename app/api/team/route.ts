import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - Fetch user's active team
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;

    // Find the user's active team
    const team = await prisma.team.findFirst({
      where: {
        userId,
        isActive: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (!team) {
      return NextResponse.json({ team: null });
    }

    return NextResponse.json({ team });
  } catch (error) {
    console.error('Error fetching team:', error);
    return NextResponse.json({ error: 'Failed to fetch team' }, { status: 500 });
  }
}

// POST - Save/Update user's team
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await request.json();

    const {
      name,
      platform,
      logo,
      espnLeagueId,
      espnTeamId,
      espnS2,
      swid,
      seasonId,
      roster,
      leagueSettings,
    } = body;

    // Check if user already has a team for this ESPN league/team combo
    let team;
    if (espnLeagueId && espnTeamId) {
      team = await prisma.team.findFirst({
        where: {
          userId,
          espnLeagueId,
          espnTeamId,
        },
      });
    }

    if (team) {
      // Update existing team
      team = await prisma.team.update({
        where: { id: team.id },
        data: {
          name,
          platform,
          logo,
          espnS2,
          swid,
          seasonId,
          roster,
          leagueSettings,
          lastSyncedAt: new Date(),
          isActive: true,
          updatedAt: new Date(),
        },
      });
    } else {
      // Deactivate all other teams for this user
      await prisma.team.updateMany({
        where: { userId },
        data: { isActive: false },
      });

      // Create new team
      team = await prisma.team.create({
        data: {
          userId,
          name,
          platform,
          logo,
          espnLeagueId,
          espnTeamId,
          espnS2,
          swid,
          seasonId,
          roster,
          leagueSettings,
          lastSyncedAt: new Date(),
          isActive: true,
        },
      });
    }

    return NextResponse.json({ team });
  } catch (error) {
    console.error('Error saving team:', error);
    return NextResponse.json({ error: 'Failed to save team' }, { status: 500 });
  }
}

// DELETE - Delete user's team
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;

    // Delete all teams for this user
    await prisma.team.deleteMany({
      where: { userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting team:', error);
    return NextResponse.json({ error: 'Failed to delete team' }, { status: 500 });
  }
}
