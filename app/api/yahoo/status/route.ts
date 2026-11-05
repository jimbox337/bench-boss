import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/supabase/auth';
import { prisma } from '@/lib/prisma';
import { yahooConfig } from '@/lib/yahooFantasy';

export const dynamic = 'force-dynamic';

export async function GET() {
  const configured = Boolean(yahooConfig());
  const session = await getServerSession();
  if (!session?.user) return NextResponse.json({ configured, connected: false, signedIn: false });
  const connection = configured ? await prisma.yahooConnection.findUnique({ where: { userId: session.user.id }, select: { id: true } }) : null;
  return NextResponse.json({ configured, connected: Boolean(connection), signedIn: true });
}
