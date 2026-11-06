import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/supabase/auth';
import { parseLeagues, parseTeams, yahooGet } from '@/lib/yahooFantasy';
import { yahooAccessToken } from '@/lib/yahooConnection';

export const dynamic = 'force-dynamic';

/** The signed-in user's Yahoo NHL leagues for the current season, each with their own team. */
export async function GET() {
  const session = await getServerSession();
  if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const token = await yahooAccessToken(session.user.id);
    if (!token) return NextResponse.json({ success: false, error: 'Yahoo is not connected' }, { status: 409 });
    const [leaguesPayload, teamsPayload] = await Promise.all([
      yahooGet('users;use_login=1/games;game_keys=nhl/leagues', token),
      yahooGet('users;use_login=1/games;game_keys=nhl/teams', token),
    ]);
    const teams = parseTeams(teamsPayload);
    const leagues = parseLeagues(leaguesPayload).map(league => ({ ...league, team: teams.find(t => t.leagueKey === league.leagueKey) || null }));
    return NextResponse.json({ success: true, leagues });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Yahoo request failed';
    return NextResponse.json({ success: false, error: message === 'YAHOO_UNAUTHORIZED' ? 'Yahoo access expired. Reconnect Yahoo.' : message }, { status: 502 });
  }
}
