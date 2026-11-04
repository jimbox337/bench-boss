'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, ReactNode } from 'react';
import { AlertTriangle, Lock, LoaderCircle } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requiresTeam?: boolean;
}

export default function ProtectedRoute({ children, requiresTeam = false }: ProtectedRouteProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalReason, setModalReason] = useState<'not_authenticated' | 'no_team' | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      // Wait for session to load
      if (status === 'loading') {
        return;
      }

      // Redirect if not authenticated
      if (status === 'unauthenticated') {
        setModalReason('not_authenticated');
        setShowModal(true);
        setIsChecking(false);
        return;
      }

      // Check if user has a team (if required)
      if (requiresTeam && session?.user) {
        try {
          const response = await fetch('/api/team');
          const data = await response.json();
          const userHasTeam = data.success && data.team !== null;

          if (!userHasTeam) {
            setModalReason('no_team');
            setShowModal(true);
            setIsChecking(false);
            return;
          }
        } catch (error) {
          console.error('Error checking team status:', error);
          setModalReason('no_team');
          setShowModal(true);
          setIsChecking(false);
          return;
        }
      }

      setIsChecking(false);
    };

    checkAccess();
  }, [session, status, requiresTeam, router]);

  // Handle modal close and redirect
  const handleModalClose = () => {
    setShowModal(false);
    router.push(modalReason === 'not_authenticated' ? '/login' : '/');
  };

  // Show loading state while checking
  if (status === 'loading' || (isChecking && !showModal)) {
    return (
      <div className="flex h-screen fantasy-app-shell items-center justify-center">
        <div className="fantasy-card rounded-none px-8 py-7 text-center">
          <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-ink" />
          <div className="mt-4 text-sm font-medium text-ink">Loading…</div>
        </div>
      </div>
    );
  }

  // Show full-page access state if unauthorized
  if (showModal && modalReason) {
    const Icon = modalReason === 'not_authenticated' ? Lock : AlertTriangle;

    return (
      <div className="flex min-h-full items-center justify-center p-5">
        <div className="w-full max-w-md border-y border-rule py-10">
          <div className="text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-none bg-paper-2 text-ink">
              <Icon className="h-8 w-8" />
            </div>

            <h2 className="text-2xl font-medium text-ink mb-4">
              {modalReason === 'not_authenticated'
                ? 'Authentication Required'
                : 'Team Required'}
            </h2>

            <p className="text-ink-2 mb-6">
              {modalReason === 'not_authenticated'
                ? 'You need to be logged in to access this feature. Please sign in or create an account to continue.'
                : 'You need to link a fantasy hockey team to use this tool. Add your team from ESPN or create a custom league to get started.'}
            </p>

            <div className="space-y-3">
              {modalReason === 'no_team' && (
                <button
                  onClick={() => router.push('/teams/new')}
                  className="w-full px-6 py-3 fantasy-button rounded-none font-medium transition-colors"
                >
                  Add Your Team
                </button>
              )}
              <button
                onClick={handleModalClose}
                className={`w-full px-6 py-3 rounded-none font-medium transition-colors ${
                  modalReason === 'no_team'
                    ? 'bg-paper-2 text-ink-2 hover:bg-paper-2'
                    : 'fantasy-button'
                }`}
              >
                {modalReason === 'not_authenticated' ? 'Go to Login' : 'Back to Home'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
