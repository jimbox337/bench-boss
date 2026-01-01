'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided');
      return;
    }

    // Verify the email
    const verifyEmail = async () => {
      try {
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (data.success) {
          setStatus('success');
          setMessage(data.message || 'Your email has been verified successfully!');

          // Redirect to login after 3 seconds
          setTimeout(() => {
            router.push('/login');
          }, 3000);
        } else {
          setStatus('error');
          setMessage(data.error || 'Failed to verify email');
        }
      } catch (error) {
        setStatus('error');
        setMessage('An error occurred while verifying your email');
      }
    };

    verifyEmail();
  }, [token, router]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 p-8 max-w-md w-full">
        <div className="text-center">
          <div className="text-6xl mb-6">
            {status === 'verifying' && '⏳'}
            {status === 'success' && '✅'}
            {status === 'error' && '❌'}
          </div>

          <h1 className="text-2xl font-bold text-slate-100 mb-4">
            {status === 'verifying' && 'Verifying Your Email'}
            {status === 'success' && 'Email Verified!'}
            {status === 'error' && 'Verification Failed'}
          </h1>

          <p className="text-slate-300 mb-6">
            {status === 'verifying' && 'Please wait while we verify your email address...'}
            {status === 'success' && message}
            {status === 'error' && message}
          </p>

          {status === 'success' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">
                Redirecting to login in 3 seconds...
              </p>
              <Link
                href="/login"
                className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Go to Login
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-3">
              <Link
                href="/login"
                className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Back to Login
              </Link>
              <p className="text-xs text-slate-400 mt-4">
                Need help? <Link href="/support" className="text-blue-400 hover:underline">Contact Support</Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
