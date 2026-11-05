'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CornerDownLeft, Search } from 'lucide-react';
import { useData } from '@/lib/DataContext';
import type { StandingRow } from '@/lib/nhlGameCenter';
import { TeamLogo } from '@/components/gamecenter/shared';

type Result = { id: string; group: 'Pages' | 'Teams' | 'Players'; label: string; detail: string; href: string; team?: string };

const PAGES: Result[] = [
  ['Home', '/'], ['Scores', '/games'], ['NHL Teams', '/nhl-teams'], ['My Team', '/myteam'], ['Lineup Optimizer', '/lineup'],
  ['Start / Sit', '/startsit'], ['Trade Analyzer', '/trades'], ['Waiver Wire', '/waivers'], ['Players and rankings', '/players'], ['Help center', '/support'],
].map(([label, href]) => ({ id: `page:${href}`, group: 'Pages' as const, label, detail: 'Page', href }));

export function useSearchShortcut(open: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); open(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
}

export default function CommandSearch({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { players } = useData();
  const [query, setQuery] = useState('');
  const [teams, setTeams] = useState<StandingRow[]>([]);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    let active = true;
    fetch('/api/nhl-teams').then(r => r.json()).then(data => { if (active && data.success) setTeams(data.standings); }).catch(() => {});
    return () => { active = false; };
  }, []);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PAGES.slice(0, 6);
    const pages = PAGES.filter(p => p.label.toLowerCase().includes(q));
    const teamHits = teams.filter(t => t.name.toLowerCase().includes(q) || t.abbrev.toLowerCase() === q)
      .slice(0, 4).map(t => ({ id: `team:${t.abbrev}`, group: 'Teams' as const, label: t.name, detail: `${t.abbrev} · ${t.w}-${t.l}-${t.otl}`, href: `/nhl-teams/${t.abbrev}`, team: t.abbrev }));
    const playerHits = q.length < 2 ? [] : players.filter(p => p.name.toLowerCase().includes(q)).slice(0, 8)
      .map(p => ({ id: `player:${p.id}`, group: 'Players' as const, label: p.name, detail: `${p.positions.join('/')} · ${p.nhlTeam}`, href: `/players?player=${p.id}`, team: p.nhlTeam }));
    return [...playerHits, ...teamHits, ...pages];
  }, [query, teams, players]);

  const choose = (result: Result | undefined) => { if (!result) return; onClose(); router.push(result.href); };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') onClose();
    else if (event.key === 'ArrowDown') { event.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    else if (event.key === 'Enter') { event.preventDefault(); choose(results[cursor]); }
  };

  return (
    <div className="bb-search-backdrop" onMouseDown={onClose}>
      <div className="bb-search-dialog" role="dialog" aria-modal="true" aria-label="Search" onMouseDown={e => e.stopPropagation()} onKeyDown={onKeyDown}>
        <div className="bb-search-input">
          <Search className="h-5 w-5 text-muted" aria-hidden />
          <input ref={inputRef} value={query} onChange={e => { setQuery(e.target.value); setCursor(0); }} placeholder="Search players, teams and tools"
            aria-label="Search players, teams and tools" aria-controls="bb-search-results" aria-activedescendant={results[cursor]?.id} />
          <kbd>Esc</kbd>
        </div>
        <ul id="bb-search-results" role="listbox" className="bb-search-results">
          {results.length === 0 && <li className="px-5 py-6 text-sm text-muted">No matches for “{query}”.</li>}
          {results.map((result, index) => {
            const header = index === 0 || results[index - 1].group !== result.group ? result.group : null;
            return (
              <li key={result.id} role="presentation">
                {header && <p className="bb-search-group">{header}</p>}
                <button id={result.id} role="option" aria-selected={index === cursor} className="bb-search-option" onMouseEnter={() => setCursor(index)} onClick={() => choose(result)}>
                  {result.team ? <TeamLogo team={{ abbrev: result.team }} size={22} /> : <span className="bb-search-page-icon" aria-hidden>↗</span>}
                  <span className="min-w-0 flex-1 text-left"><span className="block truncate font-medium">{result.label}</span><span className="block truncate text-xs text-muted">{result.detail}</span></span>
                  {index === cursor && <CornerDownLeft className="h-4 w-4 text-muted" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
