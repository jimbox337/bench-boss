import { NextRequest, NextResponse } from 'next/server';
import { fetchESPNLeagueInfo, fetchESPNTeams, ESPNLeagueConfig } from '@/lib/espnFantasyApi';
import { getServerSession } from '@/lib/supabase/auth';
import { prisma } from '@/lib/prisma';
import { decryptCredential, encryptCredential, isEncryptedCredential } from '@/lib/espnCredentials';

/**
 * API route to fetch ESPN Fantasy League information
 * POST /api/espn-league
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { leagueId, seasonId, action } = body;
    let { espnS2, swid } = body;

    if (!leagueId || !seasonId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: leagueId and seasonId' },
        { status: 400 }
      );
    }

    if (!espnS2 || !swid) {
      const storedTeam = await prisma.team.findFirst({
        where: { userId: session.user.id, espnLeagueId: String(leagueId) },
        orderBy: { updatedAt: 'desc' },
      });
      if (storedTeam) {
        espnS2 ||= decryptCredential(storedTeam.espnS2);
        swid ||= decryptCredential(storedTeam.swid);
        if ((storedTeam.espnS2 && !isEncryptedCredential(storedTeam.espnS2)) || (storedTeam.swid && !isEncryptedCredential(storedTeam.swid))) {
          await prisma.team.update({
            where: { id: storedTeam.id },
            data: {
              espnS2: encryptCredential(storedTeam.espnS2),
              swid: encryptCredential(storedTeam.swid),
            },
          });
        }
      }
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
