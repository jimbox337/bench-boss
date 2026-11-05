'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FlaskConical, Loader2 } from 'lucide-react';
import { useSession } from '@/lib/AuthContext';
import { useData } from '@/lib/DataContext';
import { defaultLeagueSettings } from '@/lib/calculator';
import { TEST_MODE_PLATFORM, buildSampleRoster } from '@/lib/teamSetup';
import { SectionTitle, TeamLogo } from '@/components/gamecenter/shared';

/** Test mode: a sample roster of real NHL players with default scoring. Works signed in or as a guest. */
export default function TestModePage() {
  const router = useRouter();
  const { status } = useSession();
  const { players, isLoading, setMyTeam, refreshTeam } = useData();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sample = useMemo(() => buildSampleRoster(players), [players]);

  const start = async () => {
    setBusy(true); setError('');
    try {
      if (status === 'authenticated') {
        const result = await fetch('/api/team', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform: TEST_MODE_PLATFORM, name: 'Test team', roster: sample, leagueSettings: defaultLeagueSettings }),
        }).then(r => r.json());
        if (!result.success) { setError(result.error || 'Could not start test mode.'); return; }
        await refreshTeam();
      } else {
        setMyTeam(sample);
      }
      router.push('/myteam');
    } catch { setError('Could not start test mode.'); } finally { setBusy(false); }
  };

  return (
    <div className="bb-page mx-auto max-w-3xl space-y-8">
      <Link href="/teams/new" className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"><ArrowLeft className="h-4 w-4" /> Add a team</Link>
      <header className="flex items-center gap-4">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-paper-3"><FlaskConical className="h-7 w-7" aria-hidden /></span>
        <div>
          <h1 className="font-display text-4xl font-bold uppercase tracking-wide">Test it out</h1>
          <p className="mt-1 text-ink-2">Try Bench Boss with a sample roster. Nothing is connected, and you can swap players or connect your real league any time.</p>
        </div>
      </header>

      <section>
        <SectionTitle action={<span className="text-xs text-muted">Default Bench Boss scoring</span>}>Your sample roster</SectionTitle>
        {isLoading || sample.length === 0 ? <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" />Loading NHL players…</p> : (
          <ul className="grid gap-x-6 sm:grid-cols-2">{sample.map(player => (
            <li key={player.id} className="flex items-center gap-3 border-b border-rule py-2.5">
              <TeamLogo team={{ abbrev: player.nhlTeam }} size={22} />
              <span className="min-w-0 flex-1 truncate font-medium">{player.name}</span>
              <span className="text-xs font-semibold text-muted">{player.isGoalie ? 'G' : player.positions.map(pos => (pos === 'L' ? 'LW' : pos === 'R' ? 'RW' : pos)).join('/')}</span>
            </li>
          ))}</ul>
        )}
        <p className="mt-3 text-xs text-muted">Top producers by position this season, from NHL data. It’s a starting point, not a recommendation.</p>
      </section>

      {error && <p className="rounded-xl border border-error/40 bg-error/5 p-4 text-sm text-error">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" className="bb-button" onClick={start} disabled={busy || sample.length === 0}>{busy ? 'Starting…' : 'Start test mode'}</button>
        <Link href="/teams/new" className="bb-button-secondary">Connect a real league</Link>
      </div>
    </div>
  );
}
