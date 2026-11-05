'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { StandingRow } from '@/lib/nhlGameCenter';
import { TeamLogo } from '@/components/gamecenter/shared';

export default function NhlTeamsPage() {
  const [rows, setRows] = useState<StandingRow[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/nhl-teams').then(r => r.json()).then(data => {
      if (!active) return;
      if (data.success) setRows(data.standings); else setError(data.error || 'Standings unavailable');
    }).catch(() => active && setError('Standings unavailable'));
    return () => { active = false; };
  }, []);

  const divisions = useMemo(() => {
    const groups = new Map<string, StandingRow[]>();
    for (const row of rows || []) groups.set(row.division, [...(groups.get(row.division) || []), row]);
    return [...groups.entries()].map(([name, list]) => ({ name, conference: list[0]?.conference, list: list.sort((a, b) => a.divisionRank - b.divisionRank) }))
      .sort((a, b) => a.conference.localeCompare(b.conference) || a.name.localeCompare(b.name));
  }, [rows]);

  return (
    <div className="bb-page space-y-6">
      <header className="bb-page-header"><div><h1>NHL Teams</h1><p>Standings, rosters, schedules and fantasy outlook for every club.</p></div></header>
      {error && <p className="fantasy-card p-5 text-sm text-error">{error}</p>}
      {!rows && !error && <p className="fantasy-card p-8 text-sm text-muted">Loading standings…</p>}
      <div className="grid gap-6 xl:grid-cols-2">
        {divisions.map(division => (
          <section key={division.name} className="fantasy-card overflow-hidden">
            <h2 className="border-b border-rule px-5 py-3 text-lg">{division.name} <span className="text-sm font-normal text-muted">· {division.conference}</span></h2>
            <div className="overflow-x-auto">
              <table className="bb-table w-full min-w-[560px] text-sm">
                <thead><tr className="text-xs text-muted">
                  <th className="px-4 py-2 text-left">Team</th>
                  {['GP', 'W', 'L', 'OTL', 'PTS', 'GF', 'GA', 'DIFF', 'L10', 'STRK'].map(h => <th key={h} className="px-2 py-2 text-right">{h}</th>)}
                </tr></thead>
                <tbody>{division.list.map(team => (
                  <tr key={team.abbrev} className="border-t border-rule-2 hover:bg-paper-3">
                    <td className="px-4 py-2"><Link href={`/nhl-teams/${team.abbrev}`} className="flex items-center gap-2 font-medium hover:text-accent"><span className="w-4 text-xs text-muted">{team.divisionRank}</span><TeamLogo team={team} size={22} />{team.name}</Link></td>
                    {[team.gp, team.w, team.l, team.otl].map((v, i) => <td key={i} className="px-2 py-2 text-right tabular-nums">{v}</td>)}
                    <td className="px-2 py-2 text-right font-semibold tabular-nums">{team.pts}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{team.gf}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{team.ga}</td>
                    <td className={`px-2 py-2 text-right tabular-nums ${team.diff > 0 ? 'text-success' : team.diff < 0 ? 'text-error' : ''}`}>{team.diff > 0 ? `+${team.diff}` : team.diff}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{team.l10}</td>
                    <td className="px-2 py-2 text-right">{team.streak}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
