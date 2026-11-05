import { NextResponse } from 'next/server';
import { fetchTeam } from '@/lib/nhlGameCenter';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ abbrev: string }> }) {
  const { abbrev } = await params;
  if (!/^[A-Za-z]{3}$/.test(abbrev)) return NextResponse.json({ success: false, error: 'Invalid team' }, { status: 400 });
  try {
    return NextResponse.json({ success: true, team: await fetchTeam(abbrev) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Team unavailable' }, { status: 502 });
  }
}
