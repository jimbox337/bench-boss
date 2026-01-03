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

          setHasTeam(userHasTeam);

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
    router.push('/');
  };

  // Show loading state while checking
  if (status === 'loading' || (isChecking && !showModal)) {
    return (
      <div className="flex h-screen bg-slate-900 items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🏒</div>
          <div className="text-slate-300">Loading...</div>
        </div>
      </div>
    );
  }

  // Show modal if unauthorized
  if (showModal && modalReason) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-8 max-w-md w-full">
          <div className="text-center">
            <div className="text-6xl mb-4">
              {modalReason === 'not_authenticated' ? '🔒' : '⚠️'}
            </div>

            <h2 className="text-2xl font-bold text-slate-100 mb-4">
              {modalReason === 'not_authenticated'
                ? 'Authentication Required'
                : 'Team Required'}
            </h2>

            <p className="text-slate-300 mb-6">
              {modalReason === 'not_authenticated'
                ? 'You need to be logged in to access this feature. Please sign in or create an account to continue.'
                : 'You need to link a fantasy hockey team to use this tool. Add your team from ESPN or create a custom league to get started.'}
            </p>

            <div className="space-y-3">
              {modalReason === 'no_team' && (
                <button
                  onClick={() => router.push('/teams/new')}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all shadow-md hover:shadow-lg"
                >
                  Add Your Team
                </button>
              )}
              <button
                onClick={handleModalClose}
                className={`w-full px-6 py-3 rounded-lg font-medium transition-all ${
                  modalReason === 'no_team'
                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
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
