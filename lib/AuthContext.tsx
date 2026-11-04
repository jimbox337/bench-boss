'use client';

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
type AppSession = { user: { id: string; email: string; name: string; image?: string | null } } | null;
type AuthValue = { data: AppSession; status: AuthStatus; update: () => Promise<void> };

const AuthContext = createContext<AuthValue>({ data: null, status: 'loading', update: async () => {} });

function toSession(user: User | null): AppSession {
  if (!user?.email) return null;
  const metadata = user.user_metadata || {};
  return { user: {
    id: user.id,
    email: user.email,
    name: metadata.full_name || [metadata.first_name, metadata.last_name].filter(Boolean).join(' ') || user.email,
    image: metadata.avatar_url || null,
  } };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<AppSession>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const update = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setData(toSession(user));
    setStatus(user ? 'authenticated' : 'unauthenticated');
  };

  useEffect(() => {
    void supabase.auth.getUser().then(({ data: { user } }) => {
      setData(toSession(user));
      setStatus(user ? 'authenticated' : 'unauthenticated');
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setData(toSession(session?.user ?? null));
      setStatus(session?.user ? 'authenticated' : 'unauthenticated');
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  return <AuthContext.Provider value={{ data, status, update }}>{children}</AuthContext.Provider>;
}

export function useSession() { return useContext(AuthContext); }

export async function signOut({ callbackUrl = '/' }: { callbackUrl?: string } = {}) {
  await createClient().auth.signOut();
  window.location.assign(callbackUrl);
}

export const useAuth = useSession;
