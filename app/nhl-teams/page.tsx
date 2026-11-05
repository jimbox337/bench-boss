'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { StandingRow } from '@/lib/nhlGameCenter';
import { teamColor } from '@/lib/teamColors';
import { SectionTitle, TeamLogo } from '@/components/gamecenter/shared';

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
    <div className="bb-page space-y-10">
      <header>
        <h1 className="font-display text-4xl font-bold uppercase tracking-wide">Teams</h1>
        <p className="mt-1 text-sm text-muted">Standings, rosters, schedules and fantasy outlook for every club.</p>
      </header>

      {rows && (
        <section aria-label="All teams">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8 lg:grid-cols-16">
            {[...rows].sort((a, b) => a.name.localeCompare(b.name)).map(team => (
              <Link key={team.abbrev} href={`/nhl-teams/${team.abbrev}`} title={team.city ? `${team.city} ${team.name}` : team.name}
                className="flex flex-col items-center gap-1 rounded-xl border border-rule bg-paper-2 py-2.5 hover:border-field-border" style={{ boxShadow: `inset 0 3px 0 ${teamColor(team.abbrev)}` }}>
                <TeamLogo team={team} size={32} /><span className="font-display text-sm font-bold">{team.abbrev}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {error && <p className="rounded-2xl border border-rule bg-paper-2 p-5 text-sm text-error">{error}</p>}
      {!rows && !error && <p className="text-sm text-muted">Loading standings…</p>}

      <div className="grid gap-10 xl:grid-cols-2">
        {divisions.map(division => (
          <section key={division.name}>
            <SectionTitle action={<span className="text-sm text-muted">{division.conference}</span>}>{division.name}</SectionTitle>
            <div className="overflow-x-auto rounded-xl border border-rule">
              <table className="bb-box w-full min-w-[600px]">
                <thead><tr><th className="text-left">Team</th>{['GP', 'W', 'L', 'OTL', 'PTS', 'GF', 'GA', 'Diff', 'L10', 'Strk'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{division.list.map(team => (
                  <tr key={team.abbrev}>
                    <td className="text-left"><Link href={`/nhl-teams/${team.abbrev}`} className="flex items-center gap-2.5 font-semibold hover:text-accent">
                      <span className="w-4 font-display text-muted">{team.divisionRank}</span><TeamLogo team={team} size={24} />{team.city ? `${team.city} ${team.name}` : team.name}</Link></td>
                    {[team.gp, team.w, team.l, team.otl].map((v, i) => <td key={i}>{v}</td>)}
                    <td className="font-bold">{team.pts}</td><td>{team.gf}</td><td>{team.ga}</td>
                    <td className={team.diff > 0 ? 'text-success' : team.diff < 0 ? 'text-error' : ''}>{team.diff > 0 ? `+${team.diff}` : team.diff}</td>
                    <td>{team.l10}</td><td>{team.streak}</td>
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
