import { NextResponse } from 'next/server';

const NHL_API = 'https://api-web.nhle.com/v1';

export const revalidate = 30;

export async function GET() {
  try {
    const [scoreResponse, scheduleResponse] = await Promise.all([
      fetch(`${NHL_API}/score/now`, { next: { revalidate: 30 } }),
      fetch(`${NHL_API}/schedule/now`, { next: { revalidate: 300 } }),
    ]);
    if (!scoreResponse.ok || !scheduleResponse.ok) throw new Error('NHL live feed unavailable');
    const [score, schedule] = await Promise.all([scoreResponse.json(), scheduleResponse.json()]);
    return NextResponse.json({
      success: true,
      updatedAt: new Date().toISOString(),
      games: score.games || [],
      gameWeek: schedule.gameWeek || [],
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to load games' }, { status: 502 });
  }
}
