import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/supabase/auth';
import './admin.css';

const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-adm-mono' });

export const metadata: Metadata = { title: 'bench-boss · admin console', robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session?.user) redirect('/login');

  if (session.user.role !== 'admin') {
    return (
      <div className={`adm ${mono.variable}`}>
        <main className="adm-denied" role="alert">
          <p className="adm-dim">$ bb admin --console</p>
          <p className="adm-err">error 403: permission denied</p>
          <p className="adm-dim">This account does not have the admin role.</p>
          <Link href="/" className="adm-btn">cd ~ <span className="adm-dim">(back to Bench Boss)</span></Link>
        </main>
      </div>
    );
  }

  return <div className={`adm ${mono.variable}`}>{children}</div>;
}
