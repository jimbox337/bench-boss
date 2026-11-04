import Link from 'next/link';
import { CircleCheck } from 'lucide-react';

export default function VerifyEmailPage() {
  return (
    <div className="bb-page flex min-h-full items-start justify-center py-12">
      <div className="bb-panel max-w-md p-8 text-center">
        <CircleCheck className="mx-auto mb-5 h-8 w-8 text-success" aria-hidden="true" />
        <h1 className="text-2xl font-semibold text-ink">Check your email</h1>
        <p className="mt-3 text-muted">Supabase now verifies new accounts through the secure link sent to your inbox.</p>
        <Link href="/login" className="bb-button mt-6 inline-block">Back to login</Link>
      </div>
    </div>
  );
}
