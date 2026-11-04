'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  ExternalLink,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldCheck,
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
  const searchParams = useSearchParams();
  const { players, setMyTeam, setESPNConfig, setLeagueSettings } = useData();
  const [leagueId, setLeagueId] = useState('');
  const [leagueIdInput, setLeagueIdInput] = useState('');
  const [seasonId] = useState('2025');
  const [espnS2, setEspnS2] = useState('');
  const [swid, setSwid] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showTeamSelection, setShowTeamSelection] = useState(false);
  const [availableTeams, setAvailableTeams] = useState<ESPNTeam[]>([]);
  const [leagueInfo, setLeagueInfo] = useState<LeagueInfo | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

  useEffect(() => {
    const s2 = searchParams.get('espn_s2');
    const swidParam = searchParams.get('swid');

    if (s2) {
      setEspnS2(s2);
      setShowAdvanced(true);
    }

    if (swidParam) {
      setSwid(swidParam);
      setShowAdvanced(true);
    }
  }, [searchParams]);

  const handleOpenESPN = () => {
    window.open('https://www.espn.com/fantasy/hockey/', '_blank');
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

  const bookmarkletCode = `javascript:(function(){var c=document.cookie,s2=c.match(/espn_s2=([^;]+)/),sw=c.match(/SWID=([^;]+)/);if(!s2||!sw){alert('Not found. Make sure you are logged in to ESPN.');return;}window.location='https://www.benchboss.pro/teams/espn?espn_s2='+encodeURIComponent(s2[1])+'&swid='+encodeURIComponent(sw[1]);})()`;

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

          <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
            <div>
              <div className="mb-4 inline-flex border border-error/30 bg-error/10 px-3 py-1 text-xs font-medium text-error">
                ESPN Fantasy
              </div>
              <h1 className="text-3xl font-semibold leading-tight text-ink">
                Connect your ESPN team.
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-6 text-ink-2">
                Import your league, choose your roster, and save it to your Bench Boss account.
              </p>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center bg-paper-3 text-sm font-medium text-ink">
                  ESPN
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">Login required</p>
                  <p className="text-xs text-muted">Teams are saved to your account.</p>
                </div>
              </div>
              <div className="rink-divider my-5" />
              <div className="space-y-3 text-sm font-medium text-muted">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-success" />
                  Private leagues supported
                </div>
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-accent" />
                  Roster sync after import
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
          <aside className="space-y-4">
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
