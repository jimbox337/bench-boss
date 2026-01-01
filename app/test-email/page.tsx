'use client';

import { useState } from 'react';

export default function TestEmailPage() {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState('');

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResult('');

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject,
          html: `<h1>${subject}</h1><p>${message}</p>`,
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
      <h1 className="text-3xl font-bold text-slate-100 mb-6">Test Email Sender</h1>

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
            {isLoading ? 'Sending...' : 'Send Email'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-slate-750 rounded-lg border border-slate-600">
          <p className="text-xs text-slate-400">
            <strong>Note:</strong> This uses your Resend API key to send emails.
            The email will be sent from: <code className="text-blue-400">{process.env.NEXT_PUBLIC_EMAIL_FROM || 'Bench Boss <noreply@benchboss.app>'}</code>
          </p>
        </div>
      </div>
    </div>
  );
}
