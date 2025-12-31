import { NextResponse } from 'next/server';
import { fetchNHLRoster, generateProjections } from '@/lib/nhlApi';

export async function GET() {
  try {
    console.log('API Route: Fetching live NHL data...');

    const players = await fetchNHLRoster();
    const projections = await generateProjections(players, 7);

    return NextResponse.json({
      players,
      projections,
      success: true
    });
  } catch (error) {
    console.error('API Route: Failed to load live data:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
