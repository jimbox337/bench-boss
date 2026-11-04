'use client';

import { CircleCheck, CircleX, LoaderCircle } from 'lucide-react';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import BenchBossLogo from '@/components/BenchBossLogo';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [verificationStatus, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [verificationMessage, setMessage] = useState('');
  const [countdown, setCountdown] = useState(3);
  const status = token ? verificationStatus : 'error';
  const message = token ? verificationMessage : 'No verification token provided';

  useEffect(() => {
    if (!token) return;

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
    <div className="bb-page grid min-h-full gap-8 py-10 lg:grid-cols-2">
      {/* Left Side - Verification Status (50%) */}
      <div className="bb-panel flex items-start justify-center p-8">
        <div className="max-w-md w-full text-center">
          <div className="text-6xl mb-6">
            {status === 'verifying' && <LoaderCircle aria-hidden="true" className="h-8 w-8 text-muted" />}
            {status === 'success' && <CircleCheck aria-hidden="true" className="h-8 w-8 text-muted" />}
            {status === 'error' && <CircleX aria-hidden="true" className="h-8 w-8 text-muted" />}
          </div>

          <h1 className="text-3xl font-semibold text-ink mb-4">
            {status === 'verifying' && 'Verifying Your Email'}
            {status === 'success' && 'Email Verified!'}
            {status === 'error' && 'Verification Failed'}
          </h1>

          <p className="text-ink mb-6 text-lg">
            {status === 'verifying' && 'Please wait while we verify your email address…'}
            {status === 'success' && message}
            {status === 'error' && message}
          </p>

          {status === 'success' && (
            <div className="space-y-4">
              <div className="bg-paper-2 border border-rule p-4">
                <p className="text-accent-2 font-medium text-lg">
                  Redirecting in {countdown}…
                </p>
              </div>
              <Link
                href="/login"
                className="bb-button inline-block px-8 py-3 bg-accent text-accent-ink font-medium hover:bg-accent transition-colors"
              >
                Go to Login Now
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <Link
                href="/login"
                className="bb-button inline-block px-8 py-3 bg-accent text-accent-ink font-medium hover:bg-accent transition-colors"
              >
                Back to Login
              </Link>
              <p className="text-sm text-muted mt-4">
                Need help? <Link href="/support" className="text-accent-2 hover:underline font-medium">Contact Support</Link>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right Side - Logo (50%) */}
      <div className="flex items-center justify-center py-10">
        <BenchBossLogo size={240} />
      </div>
    </div>
  );
}
