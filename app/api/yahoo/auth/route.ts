import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/supabase/auth';
import { authorizeUrl, yahooConfig } from '@/lib/yahooFantasy';

export const dynamic = 'force-dynamic';

/** Starts the Yahoo OAuth flow. A random state is kept in an httpOnly cookie and checked on return. */
export async function GET(request: Request) {
  const config = yahooConfig();
  const origin = new URL(request.url).origin;
  if (!config) return NextResponse.redirect(`${origin}/teams/yahoo?error=not_configured`);
  const session = await getServerSession();
  if (!session?.user) return NextResponse.redirect(`${origin}/login`);
  const state = randomBytes(24).toString('base64url');
  const response = NextResponse.redirect(authorizeUrl(config, state));
  response.cookies.set('bb_yahoo_state', state, { httpOnly: true, secure: origin.startsWith('https'), sameSite: 'lax', maxAge: 600, path: '/' });
  return response;
}
