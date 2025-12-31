'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';

// Re-export SessionProvider as AuthProvider for consistency
export function AuthProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}

// Re-export useSession as useAuth for backward compatibility
export { useSession as useAuth } from 'next-auth/react';
