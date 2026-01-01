'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);

  useEffect(() => {
    if (searchParams.get('signup') === 'true') {
      setIsSignUp(true);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!username.trim()) {
      setError('Please enter a username');
      setIsLoading(false);
      return;
    }

    if (isSignUp) {
      if (!email.trim() || !email.includes('@')) {
        setError('Please enter a valid email address');
        setIsLoading(false);
        return;
      }

      if (!name.trim()) {
        setError('Please enter your name');
        setIsLoading(false);
        return;
      }
    }

    if (password.length < 4) {
      setError('Password must be at least 4 characters');
      setIsLoading(false);
      return;
    }

    try {
      const result = await signIn('credentials', {
        username,
        email: isSignUp ? email : undefined,
        name: isSignUp ? name : undefined,
        password,
        isSignUp: isSignUp.toString(),
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
        setIsLoading(false);
      } else if (result?.ok) {
        if (isSignUp) {
          // Show verification message for new signups
          setShowVerificationMessage(true);
          setIsLoading(false);
        } else {
          // Redirect to dashboard for login
          router.push('/');
        }
      }
    } catch (err) {
      setError('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🏒</div>
          <h1 className="text-4xl font-bold text-white mb-2">Bench Boss</h1>
          <p className="text-slate-300">Fantasy Hockey Assistant</p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h2>

          {showVerificationMessage && (
            <div className="bg-green-900/30 border border-green-600 text-green-200 px-4 py-3 rounded-lg mb-4">
              <div className="flex items-start gap-3">
                <span className="text-xl">✅</span>
                <div>
                  <p className="font-semibold mb-1">Account created successfully!</p>
                  <p className="text-sm">
                    We've sent a verification email to <strong>{email}</strong>.
                    Please check your inbox and click the verification link to activate your account.
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-600 text-red-200 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    placeholder="Enter your full name"
                    required={isSignUp}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    placeholder="Enter your email"
                    required={isSignUp}
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="Enter your username"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-300">
                  Password
                </label>
                {!isSignUp && (
                  <a
                    href="/forgot-password"
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Forgot password?
                  </a>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-700">
            <button
              onClick={() => router.push('/welcome')}
              className="w-full text-slate-400 hover:text-slate-300 text-sm"
            >
              ← Back to Welcome
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
