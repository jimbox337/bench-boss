'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { AlertCircle, CheckCircle2, Mail, ShieldCheck, Zap } from 'lucide-react';
import BenchBossLogo from '@/components/BenchBossLogo';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(() => searchParams.get('signup') === 'true');
  const [isLoading, setIsLoading] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);

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
      if (!firstName.trim()) {
        setError('Please enter your first name');
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
        firstName: isSignUp ? firstName : undefined,
        lastName: isSignUp ? lastName : undefined,
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
    } catch {
      setError('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="order-2 lg:order-1 relative border-b border-on-brand/20 bg-brand-navy text-on-brand px-6 py-8 lg:border-b-0 lg:border-r lg:px-14 lg:py-10 flex flex-col">
          <button
            onClick={() => router.push('/')}
            className="flex w-fit items-center gap-3 px-2 text-left transition-colors hover:bg-on-brand/10"
          >
            <span className="bb-logo-plate"><BenchBossLogo size={48} /></span>
            <span>
              <span className="block text-2xl font-medium text-on-brand">Bench Boss</span>
              <span className="text-on-brand/75 block text-xs font-medium">Fantasy Hockey</span>
            </span>
          </button>

          <div className="flex flex-1 items-center py-10 lg:py-16">
            <div className="max-w-xl">
              <h1 className="text-3xl lg:text-4xl font-semibold leading-tight text-on-brand">
                Sign in before puck drop.
              </h1>

              <p className="mt-6 max-w-lg text-lg leading-7 text-on-brand/80">
                Keep your roster, scoring rules, and matchup tools in one clean fantasy hockey workspace.
              </p>

              <div className="mt-8 grid gap-0">
                {[
                  [ShieldCheck, 'Protected sessions', 'Secure account access for your fantasy teams.'],
                  [Zap, 'Fast decisions', 'Lineup, waiver, and trade tools stay one click away.'],
                  [Mail, 'Team setup ready', 'Create an account, then connect ESPN or build manually.'],
                ].map(([Icon, title, copy]) => (
                  <div key={title as string} className="border-t border-on-brand/20 py-4">
                    <div className="flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center text-on-brand/75">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-on-brand">{title as string}</h3>
                        <p className="mt-1 text-sm text-on-brand/75">{copy as string}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="order-1 lg:order-2 flex items-center justify-center px-5 py-8 sm:px-8 lg:px-12">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center justify-between lg:hidden">
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-2 pr-2 transition-colors hover:bg-paper-2"
              >
                <BenchBossLogo size={38} />
                <span className="text-sm font-medium text-ink">Bench Boss</span>
              </button>
              <button
                onClick={() => router.push('/')}
                className="border border-rule bg-paper-2 px-3 py-2 text-xs font-medium text-ink-2"
              >
                Guest
              </button>
            </div>

            <div className="bb-panel p-6 sm:p-8">
              <div className="mb-7">
                <h2 className="text-2xl font-semibold text-ink">
                  {isSignUp ? 'Create your account' : 'Welcome back'}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {isSignUp
                    ? 'Save your teams and carry recommendations across every device.'
                    : 'Jump back into your fantasy hockey command center.'}
                </p>
              </div>

          {showVerificationMessage && (
            <div className="mb-4 border border-success/30 bg-success/10 px-4 py-3 text-success">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-medium mb-1">Account created successfully.</p>
                  <p className="text-sm">
                    We&apos;ve sent a verification email to <strong>{email}</strong>.
                    Please check your inbox and click the verification link to activate your account.
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 flex items-start gap-3 border border-error/30 bg-error/10 px-4 py-3 text-error">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          {/* Google Sign In - Only show if configured */}
          {process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === 'true' && (
            <>
              <button
                type="button"
                onClick={() => signIn('google', { callbackUrl: '/' })}
                className="w-full bg-paper-2 hover:bg-paper-3 text-ink font-medium py-3 transition-colors flex items-center justify-center gap-3 border border-rule"
              >
                <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-rule"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 bg-paper text-muted">Or continue with email</span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {isSignUp && (
              <>
                <div>
                  <label htmlFor="login-email" className="block text-sm font-medium text-ink-2 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bb-field w-full border border-rule bg-paper px-4 py-3 text-ink outline-none transition-colors placeholder:text-muted focus:border-rule"
                    id="login-email"
                    placeholder="Enter your email"
                    required={isSignUp}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="login-first-name" className="block text-sm font-medium text-ink-2 mb-2">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="bb-field w-full border border-rule bg-paper px-4 py-3 text-ink outline-none transition-colors placeholder:text-muted focus:border-rule"
                      id="login-first-name"
                    placeholder="First name"
                      required={isSignUp}
                    />
                  </div>
                  <div>
                    <label htmlFor="login-last-name" className="block text-sm font-medium text-ink-2 mb-2">
                      Last Name <span className="text-muted font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="bb-field w-full border border-rule bg-paper px-4 py-3 text-ink outline-none transition-colors placeholder:text-muted focus:border-rule"
                      id="login-last-name"
                    placeholder="Last name"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label htmlFor="login-username" className="block text-sm font-medium text-ink-2 mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bb-field w-full border border-rule bg-paper px-4 py-3 text-ink outline-none transition-colors placeholder:text-muted focus:border-rule"
                id="login-username"
                    placeholder="Enter your username"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="login-password" className="block text-sm font-medium text-ink-2">
                  Password
                </label>
                {!isSignUp && (
                  <a
                    href="/forgot-password"
                    className="text-xs text-accent hover:text-accent font-medium"
                  >
                    Forgot password?
                  </a>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bb-field w-full border border-rule bg-paper px-4 py-3 text-ink outline-none transition-colors placeholder:text-muted focus:border-rule"
                id="login-password"
                    placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bb-button text-accent-ink font-medium py-3.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {isLoading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-accent hover:text-accent text-sm font-medium"
            >
              {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
            </button>
          </div>

          <div className="mt-4 text-center">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-rule"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 bg-paper text-xs text-muted">or</span>
              </div>
            </div>
            <button
              onClick={() => router.push('/')}
              className="mt-4 text-muted hover:text-ink text-sm font-medium transition-colors"
            >
              Continue as Guest
            </button>
          </div>
        </div>
        </div>
        </section>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen fantasy-app-shell flex items-center justify-center">
        <div className="bb-panel px-8 py-7 text-accent font-medium">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
