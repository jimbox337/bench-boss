'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
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
      <div className="p-8 max-w-2xl mx-auto">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/login');
    return null;
  }

  const handleTestVerification = async () => {
    if (!to) {
      setResult('❌ Please enter an email address');
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
        setResult(`✅ Verification email sent successfully to ${to}! Check your inbox.`);
      } else {
        setResult(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error sending verification email:', error);
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
                text-transform: uppercase;
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
                <div class="logo">🏒</div>
                <div class="header-title">Bench Boss</div>
              </div>

              <div class="content">
                <div class="content-title">${subject}</div>
                <p class="message">${message}</p>
              </div>

              <div class="footer">
                <div class="footer-brand">🏒 BENCH BOSS</div>
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
        setResult('✅ Email sent successfully!');
        setTo('');
        setSubject('');
        setMessage('');
      } else {
        setResult(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      setResult('❌ Failed to send email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-100 mb-2">Test Email Sender</h1>
      <p className="text-slate-400 mb-6 text-sm">Admin only - Logged in as {session?.user?.name}</p>

      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-6">
        <form onSubmit={handleSend} className="space-y-4">
          {/* To */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              To Email Address
            </label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 py-2 focus:border-blue-500 focus:outline-none"
              placeholder="recipient@example.com"
              required
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 py-2 focus:border-blue-500 focus:outline-none"
              placeholder="Test Email"
              required
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 py-2 focus:border-blue-500 focus:outline-none h-32"
              placeholder="Your message here..."
              required
            />
          </div>

          {/* Result Message */}
          {result && (
            <div className={`p-4 rounded-lg ${
              result.includes('✅')
                ? 'bg-green-900/30 border border-green-600 text-green-200'
                : 'bg-red-900/30 border border-red-600 text-red-200'
            }`}>
              {result}
            </div>
          )}

          {/* Send Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Sending...' : 'Send Custom Email'}
          </button>

          {/* Test Verification Email Button */}
          <div className="mt-4 pt-4 border-t border-slate-600">
            <p className="text-sm text-slate-400 mb-3">
              Or test the actual verification email template:
            </p>
            <button
              type="button"
              onClick={handleTestVerification}
              disabled={isLoading || !to}
              className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Sending...' : '🏒 Send Verification Email'}
            </button>
            <p className="text-xs text-slate-500 mt-2">
              This will send the real verification email template to the email address above
            </p>
          </div>
        </form>

        <div className="mt-6 p-4 bg-slate-750 rounded-lg border border-slate-600">
          <p className="text-xs text-slate-400">
            <strong>Note:</strong> This uses your Resend API key to send emails.
            The email will be sent from: <code className="text-blue-400">{process.env.NEXT_PUBLIC_EMAIL_FROM || 'Bench Boss <noreply@benchboss.pro>'}</code>
          </p>
        </div>
      </div>
    </div>
  );
}
