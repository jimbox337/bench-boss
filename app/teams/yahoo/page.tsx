'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Unplug } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useData } from '@/lib/DataContext';
import type { LeagueSettings, Player } from '@/lib/calculator';
import { matchPlayers } from '@/lib/teamSetup';
import type { YahooLeague, YahooRosterPlayer, YahooTeam } from '@/lib/yahooFantasy';
import { SectionTitle } from '@/components/gamecenter/shared';

type Status = { configured: boolean; connected: boolean; signedIn: boolean };
type LeagueRow = YahooLeague & { team: YahooTeam | null };
type Preview = { league: LeagueRow; settings: LeagueSettings; unsupportedStats: string[]; matched: Player[]; unmatched: string[]; total: number };

const ERRORS: Record<string, string> = {
  not_configured: 'Yahoo connection is not set up on this site yet.',
  denied: 'Yahoo access was not granted.',
  state: 'The Yahoo sign-in could not be verified. Try connecting again.',
  token: 'Yahoo did not accept the sign-in. Try connecting again.',
};

function YahooSetup() {
  const router = useRouter();
  const params = useSearchParams();
  const { players, refreshTeam } = useData();
  const [status, setStatus] = useState<Status | null>(null);
  const [leagues, setLeagues] = useState<LeagueRow[] | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(ERRORS[params.get('error') || ''] || '');
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/yahoo/status').then(r => r.json()).then((data: Status) => {
      if (!active) return;
      setStatus(data);
      if (data.connected) {
        return fetch('/api/yahoo/leagues').then(r => r.json()).then(result => {
          if (!active) return;
          if (result.success) setLeagues(result.leagues); else setError(result.error || 'Could not load your Yahoo leagues.');
        });
      }
    }).catch(() => active && setError('Could not reach Bench Boss. Try again.'));
    return () => { active = false; };
  }, []);

  const importTeam = async (league: LeagueRow) => {
    if (!league.team) return;
    setBusy(league.leagueKey); setError(''); setPreview(null);
    try {
      const result = await fetch('/api/yahoo/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teamKey: league.team.teamKey }) }).then(r => r.json());
      if (!result.success) { setError(result.error || 'Import failed.'); return; }
      const roster = result.roster as YahooRosterPlayer[];
      const { matched, unmatched } = matchPlayers(roster, players);
      setPreview({ league, settings: result.settings, unsupportedStats: result.unsupportedStats, matched, unmatched, total: roster.length });
    } catch { setError('Import failed. Try again.'); } finally { setBusy(''); }
  };

  const save = async () => {
    if (!preview?.league.team) return;
    setBusy('save'); setError('');
    try {
      const result = await fetch('/api/team', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'yahoo', name: preview.league.team.name, logo: preview.league.team.logo, seasonId: preview.league.season, roster: preview.matched, leagueSettings: preview.settings }),
      }).then(r => r.json());
      if (!result.success) { setError(result.error || 'Could not save your team.'); return; }
      await refreshTeam();
      router.push('/myteam');
    } catch { setError('Could not save your team.'); } finally { setBusy(''); }
  };

  const disconnect = async () => {
    setBusy('disconnect');
    await fetch('/api/yahoo/disconnect', { method: 'POST' }).catch(() => {});
    setStatus(s => (s ? { ...s, connected: false } : s)); setLeagues(null); setPreview(null); setBusy('');
  };

  return (
    <div className="bb-page mx-auto max-w-3xl space-y-8">
      <Link href="/teams/new" className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"><ArrowLeft className="h-4 w-4" /> Add a team</Link>
      <header>
        <h1 className="font-display text-4xl font-bold uppercase tracking-wide">Yahoo Fantasy</h1>
        <p className="mt-1 text-ink-2">Connect your Yahoo account to import your NHL league’s roster and scoring settings.</p>
      </header>

      {error && <p className="flex items-start gap-2 rounded-xl border border-error/40 bg-error/5 p-4 text-sm text-error"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
      {params.get('connected') && status?.connected && !error && <p className="flex items-center gap-2 rounded-xl border border-success/40 bg-success/5 p-4 text-sm text-success"><CheckCircle2 className="h-4 w-4" />Yahoo connected.</p>}

      {!status ? <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" />Checking your Yahoo connection…</p>
        : !status.configured ? (
          <section className="rounded-2xl border border-rule bg-paper-2 p-6">
            <SectionTitle>Not available yet</SectionTitle>
            <p className="text-sm text-ink-2">Yahoo connection hasn’t been set up on this site. In the meantime you can connect ESPN or try Bench Boss in test mode.</p>
            <div className="mt-4 flex flex-wrap gap-3"><Link href="/teams/espn" className="bb-button">Connect ESPN</Link><Link href="/teams/test" className="bb-button-secondary">Try test mode</Link></div>
          </section>
        ) : !status.connected ? (
          <section className="rounded-2xl border border-rule bg-paper-2 p-6">
            <SectionTitle>Connect Yahoo</SectionTitle>
            <ul className="mb-5 space-y-2 text-sm text-ink-2">
              {['Sign in on Yahoo’s own page; Bench Boss never sees your password', 'Read-only access to your fantasy leagues', 'Disconnect any time'].map(item => <li key={item} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" />{item}</li>)}
            </ul>
            <a href="/api/yahoo/auth" className="bb-button">Connect Yahoo</a>
          </section>
        ) : (
          <section>
            <SectionTitle action={<button type="button" onClick={disconnect} disabled={busy === 'disconnect'} className="flex items-center gap-1 text-sm font-semibold text-muted hover:text-error"><Unplug className="h-4 w-4" />Disconnect</button>}>Your NHL leagues</SectionTitle>
            {!leagues ? <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" />Loading leagues…</p>
              : leagues.length === 0 ? <p className="text-sm text-muted">No Yahoo NHL leagues found for this season.</p>
              : <ul className="divide-y divide-rule rounded-2xl border border-rule bg-paper-2">{leagues.map(league => (
                <li key={league.leagueKey} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{league.name}</p>
                    <p className="text-xs text-muted">{league.season} · {league.numTeams} teams · {league.scoringType === 'point' || league.scoringType === 'headpoint' ? 'Points' : 'Categories'}{league.team ? ` · Your team: ${league.team.name}` : ''}</p>
                  </div>
                  <button type="button" className="bb-button" disabled={!league.team || !!busy} onClick={() => importTeam(league)}>
                    {busy === league.leagueKey ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Import
                  </button>
                </li>
              ))}</ul>}
          </section>
        )}

      {preview && (
        <section className="rounded-2xl border border-rule bg-paper-2 p-6">
          <SectionTitle>Review import</SectionTitle>
          <p className="text-sm text-ink-2"><span className="font-semibold text-ink">{preview.league.team?.name}</span> in {preview.league.name}</p>
          <ul className="mt-3 space-y-1.5 text-sm">
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" />{preview.matched.length} of {preview.total} players matched to NHL data</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" />{preview.settings.scoringType === 'H2H_Points' ? `Points scoring: ${Object.entries(preview.settings.pointsPerStat || {}).map(([k, v]) => `${k} ${v}`).join(', ')}` : `Categories: ${[...(preview.settings.skaterCategories || []), ...(preview.settings.goalieCategories || [])].join(', ')}`}</li>
          </ul>
          {preview.unmatched.length > 0 && <p className="mt-3 text-sm text-muted">Not matched (they won’t be imported): {preview.unmatched.join(', ')}</p>}
          {preview.unsupportedStats.length > 0 && <p className="mt-2 text-sm text-muted">Stats Bench Boss doesn’t project yet: {preview.unsupportedStats.join(', ')}</p>}
          <div className="mt-5 flex gap-3"><button type="button" className="bb-button" onClick={save} disabled={busy === 'save' || preview.matched.length === 0}>{busy === 'save' ? 'Saving…' : 'Save team'}</button><button type="button" className="bb-button-secondary" onClick={() => setPreview(null)}>Cancel</button></div>
        </section>
      )}
    </div>
  );
}

export default function YahooPage() {
  return <ProtectedRoute><Suspense fallback={null}><YahooSetup /></Suspense></ProtectedRoute>;
}
