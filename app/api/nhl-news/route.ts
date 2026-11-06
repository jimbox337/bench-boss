import { NextResponse } from 'next/server';
import { getNhlNews } from '@/lib/nhlNews';

export const revalidate = 600;

export async function GET() {
  const items = await getNhlNews();
  if (items.length === 0) {
    return NextResponse.json({ success: false, error: 'News feeds unavailable', items: [] }, { status: 502 });
  }
  return NextResponse.json(
    { success: true, updatedAt: new Date().toISOString(), items },
    { headers: { 'Cache-Control': 's-maxage=600, stale-while-revalidate=1800' } },
  );
}
