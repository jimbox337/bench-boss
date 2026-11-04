'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Suspense, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Download,
  ExternalLink,
  KeyRound,
  Lock,
  Puzzle,
  Wifi,
} from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useData } from '@/lib/DataContext';
import { mapESPNPlayersToNHL } from '@/lib/espnFantasyApi';

interface ESPNTeam {
  id: number;
  name: string;
  abbrev: string;
}

interface LeagueInfo {
  id: string;
  name: string;
  seasonId: number;
}

interface ESPNLeagueTeam {
  id: number;
  roster: unknown[];
}

function ESPNSetupInner() {
  const router = useRouter();
  const { players, setMyTeam, setESPNConfig, setLeagueSettings } = useData();
  const [leagueId, setLeagueId] = useState('');
  const [leagueIdInput, setLeagueIdInput] = useState('');
  const [seasonId, setSeasonId] = useState(() => {
    const now = new Date();
    return String(now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear());
  });
  const [espnS2, setEspnS2] = useState('');
  const [swid, setSwid] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showTeamSelection, setShowTeamSelection] = useState(false);
  const [availableTeams, setAvailableTeams] = useState<ESPNTeam[]>([]);
  const [leagueInfo, setLeagueInfo] = useState<LeagueInfo | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [extensionInstalled, setExtensionInstalled] = useState(false);
  const [sessionDetected, setSessionDetected] = useState(false);

  useEffect(() => {
    const handleReady = () => setExtensionInstalled(true);
    window.addEventListener('BENCH_BOSS_EXTENSION_READY', handleReady);
    window.dispatchEvent(new CustomEvent('BENCH_BOSS_EXTENSION_PING'));

    const encoded = window.location.hash.match(/^#espn=([^&]+)/)?.[1];
    if (encoded) {
      try {
        const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encoded.length / 4) * 4, '=');
        const bytes = Uint8Array.from(window.atob(normalized), character => character.charCodeAt(0));
        const payload = JSON.parse(new TextDecoder().decode(bytes));
        if (payload.leagueId) {
          setLeagueId(String(payload.leagueId));
          setLeagueIdInput(String(payload.leagueId));
        }
        if (payload.seasonId) setSeasonId(String(payload.seasonId));
        if (payload.espnS2) setEspnS2(String(payload.espnS2));
        if (payload.swid) setSwid(String(payload.swid));
        setShowAdvanced(true);
        setSessionDetected(true);
        window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`);
      } catch {
        setError('The ESPN extension handoff could not be read. Please try syncing again.');
      }
    }

    return () => window.removeEventListener('BENCH_BOSS_EXTENSION_READY', handleReady);
  }, []);

  const handleOpenESPN = () => {
    window.open('https://www.espn.com/fantasy/hockey/#benchboss-sync', '_blank', 'noopener,noreferrer');
  };

  const parseLeagueInput = (value: string) => {
    setLeagueIdInput(value);
    const match = value.match(/leagueId=(\d+)/);

    if (match) {
      setLeagueId(match[1]);
    } else if (/^\d+$/.test(value.trim())) {
      setLeagueId(value.trim());
    } else {
      setLeagueId('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!leagueId.trim()) {
      setError('Please enter your ESPN League ID');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/espn/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId,
          seasonId,
          espnS2: espnS2 || undefined,
          swid: swid || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        if (data.requiresTeamSelection) {
          setLeagueInfo(data.league);
          setAvailableTeams(data.teams);
          setShowTeamSelection(true);
        } else {
          router.push('/myteam');
        }
      } else {
        setError(data.error || 'Failed to connect ESPN league');
      }
    } catch {
      setError('An error occurred while connecting your league');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTeamSelection = async () => {
    if (!selectedTeamId || !leagueInfo) {
      setError('Please select a team');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const config = {
        leagueId,
        seasonId: parseInt(seasonId, 10),
        espnS2: espnS2 || undefined,
        swid: swid || undefined,
      };

      const res = await fetch('/api/espn-league', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch league data');
      }

      const selectedTeam = data.teams?.find((team: ESPNLeagueTeam) => team.id === selectedTeamId);
      if (!selectedTeam) {
        throw new Error('Selected team not found');
      }

      const mappedPlayers = mapESPNPlayersToNHL(selectedTeam.roster, players);

      if (mappedPlayers.length === 0) {
        throw new Error('No players could be matched. NHL player data may still be loading. Try again in a moment.');
      }

      setESPNConfig(config);
      if (data.leagueInfo?.settings) {
        setLeagueSettings(data.leagueInfo.settings);
      }
      setMyTeam(mappedPlayers);

      router.push('/myteam');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while selecting your team');
    } finally {
      setIsLoading(false);
    }
  };

  const bookmarkletCode = `javascript:(function(){var c=document.cookie,s2=c.match(/espn_s2=([^;]+)/),sw=c.match(/SWID=([^;]+)/);if(!s2||!sw){alert('Not found. Make sure you are logged in to ESPN.');return;}var p=btoa(unescape(encodeURIComponent(JSON.stringify({espnS2:s2[1],swid:sw[1]})))).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');window.location='https://www.benchboss.pro/teams/espn#espn='+p;})()`;

  if (showTeamSelection && leagueInfo) {
    return (
      <div className="bb-page">
        <div className="mx-auto max-w-4xl">
          <button
            onClick={() => setShowTeamSelection(false)}
            className="mb-6 inline-flex items-center gap-2 border border-rule bg-paper-2 px-4 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to league details
          </button>

          <section className="bb-page-header mb-6">

            <h1 className="text-4xl font-semibold text-ink md:text-4xl">Select your team.</h1>
            <p className="text-muted mb-3 text-xs font-medium">ESPN League Found</p>
            <p className="mt-3 text-lg text-ink-2">{leagueInfo.name}</p>
          </section>

          {error && (
            <div className="mb-5 flex items-start gap-3 border border-error/30 bg-error/10 px-4 py-3 text-error">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          <div className="grid gap-3">
            {availableTeams.map((team) => {
              const isSelected = selectedTeamId === team.id;

              return (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeamId(team.id)}
                  className={`group flex items-center gap-4  border p-4 text-left transition-colors ${
                    isSelected
                      ? 'border-accent bg-paper-3'
                      : 'border-rule bg-paper-2 hover:border-rule hover:bg-paper-2'
                  }`}
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center bg-paper text-sm font-medium text-ink">
                    {team.abbrev}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-semibold text-ink">{team.name}</h2>
                    <p className="text-sm text-muted">{team.abbrev}</p>
                  </div>
                  {isSelected ? (
                    <CheckCircle2 className="h-6 w-6 text-success" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted transition-colors group-hover:text-accent" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setShowTeamSelection(false)}
              className="flex-1 border border-rule bg-paper-2 px-6 py-3 font-medium text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
            >
              Back
            </button>
            <button
              onClick={handleTeamSelection}
              disabled={!selectedTeamId || isLoading}
              className="bb-button flex-1 bg-accent px-6 py-3 font-medium text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? 'Connecting...' : 'Import Selected Team'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bb-page">
      <div className="mx-auto max-w-6xl">
        <button
          onClick={() => router.back()}
          className="mb-6 inline-flex items-center gap-2 border border-rule bg-paper-2 px-4 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <section className="bb-page-header mb-6">

          <div className="w-full">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-3 border border-error/30 bg-white px-4 py-2">
                <Image src="/espn-logo.svg" alt="ESPN" width={118} height={30} priority className="h-6 w-auto" />
                <span className="border-l border-rule pl-3 text-xs font-medium text-error">Fantasy Hockey</span>
              </div>
              <h1 className="text-3xl font-semibold leading-tight text-ink">
                Connect your ESPN team.
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-6 text-ink-2">
                Import your league, choose your roster, and save it to your Bench Boss account.
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
          <aside className="space-y-4">
            <div className="bb-panel border-accent/30 p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center bg-accent/10 text-accent">
                  <Puzzle className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-ink">Bench Boss Sync</h2>
                  <p className="text-sm text-muted">FantasyPros-style ESPN import.</p>
                </div>
              </div>
              <div className={`mb-4 flex items-center gap-2 text-sm font-medium ${extensionInstalled ? 'text-success' : 'text-muted'}`}>
                <Wifi className="h-4 w-4" />
                {extensionInstalled ? 'Extension detected' : 'Chrome extension required'}
              </div>
              <div className="space-y-2">
                <a href="/bench-boss-espn-sync.zip" download className="bb-button-secondary flex w-full items-center justify-center gap-2 px-5 py-3 text-sm font-medium">
                  <Download className="h-4 w-4" /> Download extension
                </a>
                <button type="button" onClick={handleOpenESPN} className="fantasy-button flex w-full items-center justify-center gap-2 px-5 py-3 text-sm font-medium">
                  Open ESPN & sync <ExternalLink className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-3 text-xs leading-5 text-muted">Install once from chrome://extensions using “Load unpacked,” then open your ESPN hockey league and choose Connect to Bench Boss.</p>
            </div>

            <div className="bb-panel p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center bg-error/10 text-error">
                  <ExternalLink className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-ink">Open ESPN first</h2>
                  <p className="text-sm text-muted">Find your league URL or ID.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleOpenESPN}
                className="flex w-full items-center justify-center gap-2 bg-paper-2 px-5 py-3 font-medium text-error transition-colors hover:bg-error/10"
              >
                Open ESPN Fantasy Hockey
                <ExternalLink className="h-4 w-4" />
              </button>
            </div>

            <div className="bb-panel p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center bg-paper-2 text-accent">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-ink">Private league helper</h2>
                  <p className="text-sm text-muted">Optional cookie capture.</p>
                </div>
              </div>
              <p className="mb-4 text-sm leading-6 text-muted">
                Drag this bookmark to your bookmarks bar, open ESPN Fantasy, then click it to return with private league cookies filled in.
              </p>
              <div
                dangerouslySetInnerHTML={{
                  __html: `<a href="${bookmarkletCode}" draggable="true" class="bb-button-secondary w-full cursor-grab">Bench Boss ESPN Auth</a>`,
                }}
              />
            </div>
          </aside>

          <section className="bb-panel p-6 md:p-7">
            {sessionDetected && (
              <div className="mb-5 flex items-start gap-3 border border-success/30 bg-success/10 px-4 py-3 text-success">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                <span className="text-sm font-medium">ESPN session detected. Your private league credentials are ready—confirm the league below.</span>
              </div>
            )}
            {error && (
              <div className="mb-5 flex items-start gap-3 border border-error/30 bg-error/10 px-4 py-3 text-error">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold text-ink">Enter your ESPN league.</h2>
                <p className="text-muted mb-2 text-xs font-medium">League Details</p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-ink-2">ESPN League URL or ID</label>
                <input
                  type="text"
                  value={leagueIdInput}
                  onChange={(e) => parseLeagueInput(e.target.value)}
                  className="bb-field w-full border border-rule bg-paper px-4 py-3 text-ink outline-none transition-colors placeholder:text-muted focus:border-error/30"
                  placeholder="Paste your league URL or numeric ID"
                  required
                />
                {leagueId && leagueIdInput !== leagueId && (
                  <p className="mt-2 text-xs font-medium text-success">League ID detected: {leagueId}</p>
                )}
                {!leagueId && leagueIdInput && (
                  <p className="mt-2 text-xs font-medium text-error">Could not find a league ID. Try pasting the full URL.</p>
                )}
                {!leagueIdInput && (
                  <p className="mt-2 text-xs text-muted">
                    Example: fantasy.espn.com/hockey/league?leagueId=12345678
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-ink-2">Season Year</label>
                <input
                  type="text"
                  value={seasonId}
                  readOnly
                  className="bb-field w-full cursor-not-allowed border border-rule bg-paper-2 px-4 py-3 text-muted"
                />
                <p className="mt-2 text-xs text-muted">Current ESPN fantasy hockey season endpoint.</p>
              </div>

              <div className="border-y border-rule py-4">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center bg-paper-2 text-accent">
                      <Lock className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-ink">Private league access</span>
                      <span className="block text-xs text-muted">Optional for locked ESPN leagues</span>
                    </span>
                  </span>
                  <ChevronRight className={`h-5 w-5 text-muted motion-reduce:transition-none transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
                </button>

                {showAdvanced && (
                  <div className="mt-5 space-y-4 border-t border-rule pt-5">
                    {espnS2 && swid && (
                      <div className="flex items-center gap-2 border border-success/30 bg-success/10 px-3 py-2 text-xs font-medium text-success">
                        <CheckCircle2 className="h-4 w-4" />
                        Cookies loaded and ready.
                      </div>
                    )}
                    <p className="text-xs leading-5 text-muted">
                      Use the bookmarklet helper or paste these values manually from ESPN cookies.
                    </p>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-ink-2">espn_s2 Cookie</label>
                      <input
                        type="text"
                        value={espnS2}
                        onChange={(e) => setEspnS2(e.target.value)}
                        className="bb-field w-full border border-rule bg-paper px-4 py-3 font-mono text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-error/30"
                        placeholder="AEA..."
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-ink-2">SWID Cookie</label>
                      <input
                        type="text"
                        value={swid}
                        onChange={(e) => setSwid(e.target.value)}
                        className="bb-field w-full border border-rule bg-paper px-4 py-3 font-mono text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-error/30"
                        placeholder="{...}"
                      />
                    </div>

                    <div className="bg-paper-2 p-3 text-xs leading-5 text-muted">
                      <div className="mb-1 flex items-center gap-2 font-medium text-ink-2">
                        <Clipboard className="h-4 w-4 text-accent" />
                        Manual path
                      </div>
                      Open ESPN, sign in, inspect cookies for espn.com, then copy espn_s2 and SWID.
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="flex-1 border border-rule bg-paper-2 px-6 py-3 font-medium text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="bb-button flex-1 bg-accent px-6 py-3 font-medium text-accent-ink transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? 'Connecting...' : 'Connect League'}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function ESPNSetup() {
  return (
    <ProtectedRoute>
      <Suspense>
        <ESPNSetupInner />
      </Suspense>
    </ProtectedRoute>
  );
}
