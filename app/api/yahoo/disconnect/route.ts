import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/supabase/auth';
import { deleteYahooConnection } from '@/lib/yahooConnection';

export async function POST() {
  const session = await getServerSession();
  if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  await deleteYahooConnection(session.user.id);
  return NextResponse.json({ success: true });
}
