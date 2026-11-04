'use client';

import { useState, useEffect } from 'react';
import { useSession } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';

export default function TestEmailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState('');
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);

  // Check admin status
  useEffect(() => {
    if (status === 'authenticated') {
      // Try to make a request to verify admin access
      fetch('/api/test-verification-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@test.com' }),
      })
        .then(res => {
          if (res.status === 403) {
            // Not an admin, redirect to home
            router.push('/');
          } else {
            setIsCheckingAdmin(false);
          }
        })
        .catch(() => {
          setIsCheckingAdmin(false);
        });
    }
  }, [status, router]);

  // Redirect if not logged in
  if (status === 'loading' || isCheckingAdmin) {
    return (
      <div className="bb-page max-w-4xl">
        <div className="text-muted">Loading...</div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/login');
    return null;
  }

  const handleTestVerification = async () => {
    if (!to) {
      setResult('Error: Please enter an email address');
      return;
    }

    setIsLoading(true);
    setResult('');

    try {
      console.log('📧 Sending verification email to:', to);
      const response = await fetch('/api/test-verification-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: to }),
      });

      const data = await response.json();

      if (data.success) {
        setResult(`Success: Verification email sent successfully to ${to}! Check your inbox.`);
      } else {
        setResult(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error sending verification email:', error);
      setResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResult('');

    try {
      // Build vibrant email template
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 20px;
              }
              .email-wrapper {
                max-width: 600px;
                margin: 0 auto;
                background: #ffffff;
                border-radius: 20px;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
              }
              .header {
                background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
                padding: 40px 30px;
                text-align: center;
                position: relative;
                overflow: hidden;
              }
              .header::before {
                content: '';
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
                animation: pulse 4s ease-in-out infinite;
              }
              @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
              }
              .logo {
                font-size: 60px;
                margin-bottom: 10px;
                position: relative;
                z-index: 1;
                text-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
              }
              .header-title {
                color: #ffffff;
                font-size: 28px;
                font-weight: 800;
                text-transform: ;
                letter-spacing: 2px;
                position: relative;
                z-index: 1;
                text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
              }
              .content {
                padding: 40px 30px;
                background: #ffffff;
              }
              .content-title {
                font-size: 28px;
                font-weight: 800;
                color: #1e293b;
                margin-bottom: 20px;
                text-align: center;
              }
              .message {
                font-size: 16px;
                line-height: 1.8;
                color: #475569;
                margin-bottom: 20px;
                text-align: center;
              }
              .footer {
                background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
                padding: 30px;
                text-align: center;
              }
              .footer-text {
                color: #cbd5e1;
                font-size: 14px;
                line-height: 1.6;
                margin-bottom: 10px;
              }
              .footer-brand {
                color: #ffffff;
                font-size: 16px;
                font-weight: 700;
                margin-top: 15px;
              }
            </style>
          </head>
          <body>
            <div class="email-wrapper">
              <div class="header">
                <div class="logo">BB</div>
                <div class="header-title">Bench Boss</div>
              </div>

              <div class="content">
                <div class="content-title">${subject}</div>
                <p class="message">${message}</p>
              </div>

              <div class="footer">
                <div class="footer-brand">BENCH BOSS</div>
                <p class="footer-text" style="font-size: 12px; margin-top: 10px;">
                  © 2026 Bench Boss. All rights reserved.
                </p>
              </div>
            </div>
          </body>
        </html>
      `;

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject,
          html,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult('Success: Email sent successfully!');
        setTo('');
        setSubject('');
        setMessage('');
      } else {
        setResult(`Error: ${data.error}`);
      }
    } catch (error) {
      setResult('Error: Failed to send email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bb-page max-w-4xl">
      <h1 className="text-3xl font-semibold text-ink mb-2">Test Email Sender</h1>
      <p className="text-muted mb-6 text-sm">Admin only - Logged in as {session?.user?.name}</p>

      <div className="bb-panel p-6">
        <form onSubmit={handleSend} className="space-y-4">
          {/* To */}
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-2">
              To Email Address
            </label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="bb-field w-full bg-paper-3 border border-rule text-ink px-4 py-2 focus:border-rule focus:outline-none"
              placeholder="recipient@example.com"
              required
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-2">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="bb-field w-full bg-paper-3 border border-rule text-ink px-4 py-2 focus:border-rule focus:outline-none"
              placeholder="Test Email"
              required
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-2">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="bb-field w-full bg-paper-3 border border-rule text-ink px-4 py-2 focus:border-rule focus:outline-none h-32"
              placeholder="Your message here..."
              required
            />
          </div>

          {/* Result Message */}
          {result && (
            <div className={`p-4  ${
              result.includes('Success:')
                ? 'bg-success/10 border border-success/30 text-success'
                : 'bg-error/10 border border-error/30 text-error'
            }`}>
              {result}
            </div>
          )}

          {/* Send Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="bb-button w-full bg-accent text-accent-ink py-3 font-medium hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Sending...' : 'Send Custom Email'}
          </button>

          {/* Test Verification Email Button */}
          <div className="mt-4 pt-4 border-t border-rule">
            <p className="text-sm text-muted mb-3">
              Or test the actual verification email template:
            </p>
            <button
              type="button"
              onClick={handleTestVerification}
              disabled={isLoading || !to}
              className="w-full hover:bg-paper-3 text-ink py-3 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Sending...' : 'Send Verification Email'}
            </button>
            <p className="text-xs text-muted mt-2">
              This will send the real verification email template to the email address above
            </p>
          </div>
        </form>

        <div className="mt-6 p-4 bg-paper-3 border border-rule">
          <p className="text-xs text-muted">
            <strong>Note:</strong> This uses your Resend API key to send emails.
            The email will be sent from: <code className="text-accent-2">{process.env.NEXT_PUBLIC_EMAIL_FROM || 'Bench Boss <noreply@benchboss.pro>'}</code>
          </p>
        </div>
      </div>
    </div>
  );
}
