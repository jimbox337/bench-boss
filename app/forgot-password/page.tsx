'use client';

import { CircleCheck, LockKeyhole } from 'lucide-react';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setMessage(data.message);
      } else {
        setMessage(data.error || 'Failed to send reset email');
      }
    } catch (error) {
      setMessage('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bb-page flex min-h-full items-start justify-center py-12">
      <div className="bb-panel p-6 sm:p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <LockKeyhole aria-hidden="true" className="mb-6 h-8 w-8 text-muted" />
          <h1 className="text-3xl font-semibold text-ink mb-2">Forgot Password</h1>
          <p className="text-muted">
            Enter your email address and we’ll send you a link to reset your password.
          </p>
        </div>

        {success ? (
          <div className="bg-success/10 border border-success/30 text-success p-4 mb-6">
            <div className="flex items-start gap-3">
              <CircleCheck aria-hidden="true" className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium mb-1">Check your email</p>
                <p className="text-sm">{message}</p>
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
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bb-field w-full bg-paper-3 border border-rule text-ink px-4 py-3 focus:border-rule focus:outline-none"
                placeholder="you@example.com"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="bb-button w-full bg-accent text-accent-ink py-3 font-medium hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Sending...' : 'Send Reset Link'}
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

        {success && (
          <div className="mt-6 text-center">
            <p className="text-xs text-muted">
              Didn’t receive the email? Check your spam folder or{' '}
              <button
                onClick={() => setSuccess(false)}
                className="text-accent-2 hover:underline"
              >
                try again
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
