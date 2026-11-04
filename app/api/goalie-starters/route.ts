import { NextResponse } from 'next/server';
import { getStartingGoalies } from '@/lib/goalieStarters';

const NHL_API = 'https://api-web.nhle.com/v1';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const response = await fetch(`${NHL_API}/score/now`, { next: { revalidate: 30 }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error('NHL live feed unavailable');
    const score = await response.json();
    const starters = await getStartingGoalies(score.games || []);
    return NextResponse.json({ success: true, updatedAt: new Date().toISOString(), starters });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to load goalies' }, { status: 502 });
  }
}
