'use client';

import { CircleCheck, CircleX, KeyRound } from 'lucide-react';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    if (!token) {
      setMessage('Invalid reset token');
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setMessage('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setMessage('Password must be at least 6 characters');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setMessage(data.message);

        // Redirect to login after 2 seconds
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      } else {
        setMessage(data.error || 'Failed to reset password');
      }
    } catch (error) {
      setMessage('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="bb-page flex min-h-full items-start justify-center py-12">
        <div className="bb-panel p-6 sm:p-8 max-w-md w-full text-center">
          <CircleX aria-hidden="true" className="mb-6 h-8 w-8 text-muted" />
          <h1 className="text-2xl font-semibold text-ink mb-4">Invalid Reset Link</h1>
          <p className="text-muted mb-6">
            This password reset link is invalid or has expired.
          </p>
          <Link
            href="/forgot-password"
            className="bb-button inline-block px-6 py-2 bg-accent text-accent-ink font-medium hover:bg-accent transition-colors"
          >
            Request New Link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bb-page flex min-h-full items-start justify-center py-12">
      <div className="bb-panel p-6 sm:p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <KeyRound aria-hidden="true" className="mb-6 h-8 w-8 text-muted" />
          <h1 className="text-3xl font-semibold text-ink mb-2">Reset Password</h1>
          <p className="text-muted">
            Enter your new password below.
          </p>
        </div>

        {success ? (
          <div className="bg-success/10 border border-success/30 text-success p-4 mb-6">
            <div className="flex items-start gap-3">
              <CircleCheck aria-hidden="true" className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium mb-1">Password Reset Successful</p>
                <p className="text-sm">Redirecting to login...</p>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {message && (
              <div className="bg-error/10 border border-error/30 text-error p-3 text-sm">
                {message}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-ink-2 mb-2">
                New Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bb-field w-full bg-paper-3 border border-rule text-ink px-4 py-3 focus:border-rule focus:outline-none"
                placeholder="Enter new password"
                required
                minLength={6}
              />
              <p className="text-xs text-muted mt-1">
                Must be at least 6 characters
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-2 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bb-field w-full bg-paper-3 border border-rule text-ink px-4 py-3 focus:border-rule focus:outline-none"
                placeholder="Confirm new password"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="bb-button w-full bg-accent text-accent-ink py-3 font-medium hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="text-accent-2 hover:text-accent-2 text-sm font-medium"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-ink">Loading...</div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
