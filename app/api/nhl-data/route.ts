import { NextResponse } from 'next/server';
import { loadFastNHLData } from '@/lib/nhlStatsApi';

export async function GET() {
  try {
    console.log('API Route: Fetching live NHL data using fast bulk endpoint...');

    const { players, projections } = await loadFastNHLData();

    console.log(`API Route: Successfully loaded ${players.length} players`);

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
