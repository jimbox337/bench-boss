import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerSession } from '@/lib/supabase/auth';
import { exchangeCode, yahooConfig } from '@/lib/yahooFantasy';
import { saveYahooTokens } from '@/lib/yahooConnection';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = (query: string) => NextResponse.redirect(`${url.origin}/teams/yahoo?${query}`);
  const config = yahooConfig();
  if (!config) return back('error=not_configured');
  const session = await getServerSession();
  if (!session?.user) return NextResponse.redirect(`${url.origin}/login`);

  const store = await cookies();
  const expected = store.get('bb_yahoo_state')?.value;
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  if (url.searchParams.get('error')) return back('error=denied');
  if (!expected || !state || state !== expected || !code) return back('error=state');

  try {
    await saveYahooTokens(session.user.id, await exchangeCode(config, code));
    const response = back('connected=1');
    response.cookies.delete('bb_yahoo_state');
    return response;
  } catch (error) {
    console.error('Yahoo token exchange failed:', error instanceof Error ? error.message : error);
    return back('error=token');
  }
}
