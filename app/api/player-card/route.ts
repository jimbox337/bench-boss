import { NextResponse } from 'next/server';
import { fetchPlayerCard } from '@/lib/playerCard';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get('id') || '';
  const season = Number(params.get('season')) || undefined;
  if (!/^\d{7}$/.test(id)) return NextResponse.json({ success: false, error: 'A 7-digit NHL player id is required' }, { status: 400 });
  try {
    return NextResponse.json({ success: true, card: await fetchPlayerCard(id, season) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Player unavailable' }, { status: 502 });
  }
}
