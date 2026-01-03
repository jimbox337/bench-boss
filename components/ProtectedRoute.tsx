'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  requiresTeam?: boolean;
}

export default function ProtectedRoute({ children, requiresTeam = false }: ProtectedRouteProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [hasTeam, setHasTeam] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      // Wait for session to load
      if (status === 'loading') {
        return;
      }

      // Redirect if not authenticated
      if (status === 'unauthenticated') {
        router.push('/');
        return;
      }

      // Check if user has a team (if required)
      if (requiresTeam && session?.user) {
        try {
          const response = await fetch('/api/team');
          const data = await response.json();
          const userHasTeam = data.success && data.team !== null;

          setHasTeam(userHasTeam);

          if (!userHasTeam) {
            router.push('/');
            return;
          }
        } catch (error) {
          console.error('Error checking team status:', error);
          router.push('/');
          return;
        }
      }

      setIsChecking(false);
    };

    checkAccess();
  }, [session, status, requiresTeam, router]);

  // Show loading state while checking
  if (status === 'loading' || isChecking) {
    return (
      <div className="flex h-screen bg-slate-900 items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🏒</div>
          <div className="text-slate-300">Loading...</div>
        </div>
      </div>
    );
  }

  // Don't render anything if unauthorized (will redirect)
  if (status === 'unauthenticated' || (requiresTeam && hasTeam === false)) {
    return null;
  }

  return <>{children}</>;
}
