import { NextResponse } from 'next/server';
import { fetchGameDetail } from '@/lib/nhlGameCenter';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d{10}$/.test(id)) return NextResponse.json({ success: false, error: 'Invalid game id' }, { status: 400 });
  try {
    return NextResponse.json({ success: true, detail: await fetchGameDetail(Number(id)) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Game unavailable' }, { status: 502 });
  }
}
