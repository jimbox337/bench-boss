import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type SessionUserWithId = {
  id: string;
};

// GET - Fetch user's active team
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as SessionUserWithId).id;

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
      return NextResponse.json({ success: true, team: null });
    }

    return NextResponse.json({ success: true, team });
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

    const userId = (session.user as SessionUserWithId).id;
    const body: unknown = await request.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid team payload' }, { status: 400 });
    }

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
    } = body as Record<string, unknown>;

    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'A team name is required' }, { status: 400 });
    }

    if (typeof platform !== 'string' || !platform.trim()) {
      return NextResponse.json({ success: false, error: 'A team platform is required' }, { status: 400 });
    }

    const normalizedName = name.trim();
    const normalizedPlatform = platform.trim();
    const normalizedLeagueSettings =
      leagueSettings && typeof leagueSettings === 'object' && !Array.isArray(leagueSettings)
        ? leagueSettings
        : undefined;

    // Check if user already has a team for this ESPN league/team combo
    let team;
    if (typeof espnLeagueId === 'string' && typeof espnTeamId === 'string') {
      team = await prisma.team.findFirst({
        where: {
          userId,
          espnLeagueId,
          espnTeamId,
        },
      });
    } else if (normalizedPlatform.toLowerCase() === 'custom') {
      team = await prisma.team.findFirst({
        where: {
          userId,
          platform: 'Custom',
          isActive: true,
        },
      });
    }

    if (team) {
      // Update existing team
      team = await prisma.team.update({
        where: { id: team.id },
        data: {
          name: normalizedName,
          platform: normalizedPlatform,
          logo: typeof logo === 'string' ? logo : undefined,
          espnS2: typeof espnS2 === 'string' ? espnS2 : undefined,
          swid: typeof swid === 'string' ? swid : undefined,
          seasonId: typeof seasonId === 'string' ? seasonId : undefined,
          roster: Array.isArray(roster) ? roster : undefined,
          leagueSettings: normalizedLeagueSettings,
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
          name: normalizedName,
          platform: normalizedPlatform,
          logo: typeof logo === 'string' ? logo : undefined,
          espnLeagueId: typeof espnLeagueId === 'string' ? espnLeagueId : undefined,
          espnTeamId: typeof espnTeamId === 'string' ? espnTeamId : undefined,
          espnS2: typeof espnS2 === 'string' ? espnS2 : undefined,
          swid: typeof swid === 'string' ? swid : undefined,
          seasonId: typeof seasonId === 'string' ? seasonId : undefined,
          roster: Array.isArray(roster) ? roster : undefined,
          leagueSettings: normalizedLeagueSettings,
          lastSyncedAt: new Date(),
          isActive: true,
        },
      });
    }

    return NextResponse.json({ success: true, team });
  } catch (error) {
    console.error('Error saving team:', error);
    return NextResponse.json({ success: false, error: 'Failed to save team' }, { status: 500 });
  }
}

// DELETE - Delete user's team
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as SessionUserWithId).id;

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
