'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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

    if (password.length < 4) {
      setError('Password must be at least 4 characters');
      setIsLoading(false);
      return;
    }

    try {
      const result = await signIn('credentials', {
        username,
        password,
        isSignUp: isSignUp.toString(),
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
        setIsLoading(false);
      } else if (result?.ok) {
        router.push('/');
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

          {error && (
            <div className="bg-red-900/30 border border-red-600 text-red-200 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
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

        {/* Demo Info */}
        <div className="mt-6 bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4">
          <p className="text-xs text-slate-400 text-center mb-2">
            <span className="font-semibold text-slate-300">Demo Account:</span> username: <code className="text-blue-400">demo</code>, password: <code className="text-blue-400">demo1234</code>
          </p>
          <p className="text-xs text-slate-400 text-center">
            Or create a new account with any username and password (4+ characters)
          </p>
        </div>
      </div>
    </div>
  );
}
