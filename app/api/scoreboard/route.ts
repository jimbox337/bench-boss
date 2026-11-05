import { NextResponse } from 'next/server';
import { fetchScoreboard, isIsoDate } from '@/lib/nhlGameCenter';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get('date');
  try {
    const scoreboard = await fetchScoreboard(isIsoDate(date) ? date : undefined);
    return NextResponse.json({ success: true, updatedAt: new Date().toISOString(), ...scoreboard });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Scoreboard unavailable' }, { status: 502 });
  }
}
