'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import BenchBossLogo from '@/components/BenchBossLogo';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');
  const [countdown, setCountdown] = useState(3);

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

  // Countdown timer effect
  useEffect(() => {
    if (status === 'success') {
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            router.push('/login');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [status, router]);

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Verification Status (50%) */}
      <div className="w-1/2 bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center p-12">
        <div className="max-w-md w-full text-center">
          <div className="text-6xl mb-6">
            {status === 'verifying' && '⏳'}
            {status === 'success' && '✅'}
            {status === 'error' && '❌'}
          </div>

          <h1 className="text-3xl font-bold text-slate-800 mb-4">
            {status === 'verifying' && 'Verifying Your Email'}
            {status === 'success' && 'Email Verified!'}
            {status === 'error' && 'Verification Failed'}
          </h1>

          <p className="text-slate-700 mb-6 text-lg">
            {status === 'verifying' && 'Please wait while we verify your email address...'}
            {status === 'success' && message}
            {status === 'error' && message}
          </p>

          {status === 'success' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-300 rounded-lg p-4">
                <p className="text-blue-800 font-semibold text-lg">
                  Redirecting in {countdown}...
                </p>
              </div>
              <Link
                href="/login"
                className="inline-block px-8 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all shadow-md hover:shadow-lg"
              >
                Go to Login Now
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <Link
                href="/login"
                className="inline-block px-8 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all shadow-md hover:shadow-lg"
              >
                Back to Login
              </Link>
              <p className="text-sm text-slate-600 mt-4">
                Need help? <Link href="/support" className="text-blue-600 hover:underline font-medium">Contact Support</Link>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right Side - Logo (50%) */}
      <div className="w-1/2 bg-white flex flex-col items-center justify-center">
        <BenchBossLogo size={500} />
      </div>
    </div>
  );
}
