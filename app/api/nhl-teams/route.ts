import { NextResponse } from 'next/server';
import { fetchStandings } from '@/lib/nhlGameCenter';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ success: true, standings: await fetchStandings() });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Standings unavailable' }, { status: 502 });
  }
}
