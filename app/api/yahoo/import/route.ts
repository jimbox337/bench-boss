import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/supabase/auth';
import { leagueKeyOfTeam, parseRoster, parseSettings, yahooGet } from '@/lib/yahooFantasy';
import { yahooAccessToken } from '@/lib/yahooConnection';

export const dynamic = 'force-dynamic';

/** League scoring settings and the user's roster for one Yahoo team; the client maps players and saves. */
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { teamKey?: string };
  if (!body.teamKey || !/^\d+\.l\.\d+\.t\.\d+$/.test(body.teamKey)) return NextResponse.json({ success: false, error: 'Invalid team' }, { status: 400 });
  try {
    const token = await yahooAccessToken(session.user.id);
    if (!token) return NextResponse.json({ success: false, error: 'Yahoo is not connected' }, { status: 409 });
    const [settingsPayload, rosterPayload] = await Promise.all([
      yahooGet(`league/${leagueKeyOfTeam(body.teamKey)}/settings`, token),
      yahooGet(`team/${body.teamKey}/roster`, token),
    ]);
    return NextResponse.json({ success: true, ...parseSettings(settingsPayload), roster: parseRoster(rosterPayload) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Yahoo request failed';
    return NextResponse.json({ success: false, error: message === 'YAHOO_UNAUTHORIZED' ? 'Yahoo access expired. Reconnect Yahoo.' : message }, { status: 502 });
  }
}
