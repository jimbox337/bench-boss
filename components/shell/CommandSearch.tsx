'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { useData } from '@/lib/DataContext';
import type { StandingRow } from '@/lib/nhlGameCenter';
import { TeamLogo } from '@/components/gamecenter/shared';
import { usePlayerCard } from '@/components/player/PlayerCardProvider';

type Result = { id: string; group: 'Pages' | 'Teams' | 'Players'; label: string; detail: string; href: string; team?: string; playerId?: string };

const PAGES: Result[] = [
  ['Home', '/'], ['Scores', '/games'], ['NHL Teams', '/nhl-teams'], ['My Team', '/myteam'], ['Lineup Optimizer', '/lineup'],
  ['Start / Sit', '/startsit'], ['Trade Analyzer', '/trades'], ['Waiver Wire', '/waivers'], ['Players and rankings', '/players'], ['Help center', '/support'],
].map(([label, href]) => ({ id: `page:${href}`, group: 'Pages' as const, label, detail: 'Page', href }));

/** Inline search field in the top bar. Suggestions drop down under it while you type. */
export default function SearchBar() {
  const router = useRouter();
  const { players } = useData();
  const { openPlayer } = usePlayerCard();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [teams, setTeams] = useState<StandingRow[]>([]);
  const [cursor, setCursor] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/nhl-teams').then(r => r.json()).then(data => { if (active && data.success) setTeams(data.standings); }).catch(() => {});
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); inputRef.current?.focus(); }
    };
    const onDown = (event: MouseEvent) => { if (!wrapRef.current?.contains(event.target as Node)) setFocused(false); };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { active = false; window.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, []);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const pages = PAGES.filter(p => p.label.toLowerCase().includes(q)).slice(0, 3);
    const teamHits = teams.filter(t => t.name.toLowerCase().includes(q) || t.abbrev.toLowerCase() === q)
      .slice(0, 3).map(t => ({ id: `team:${t.abbrev}`, group: 'Teams' as const, label: t.name, detail: `${t.abbrev} · ${t.w}-${t.l}-${t.otl}`, href: `/nhl-teams/${t.abbrev}`, team: t.abbrev }));
    const playerHits = q.length < 2 ? [] : players.filter(p => p.name.toLowerCase().includes(q))
      // Names whose first or last name starts with the query first, then by season points.
      .map(p => ({ p, starts: p.name.toLowerCase().split(' ').some(part => part.startsWith(q)) || p.name.toLowerCase().startsWith(q) }))
      .sort((a, b) => Number(b.starts) - Number(a.starts) || (b.p.seasonStats?.PTS || 0) - (a.p.seasonStats?.PTS || 0))
      .map(({ p }) => p).slice(0, 6)
      .map(p => ({ id: `player:${p.id}`, group: 'Players' as const, label: p.name, detail: `${p.positions.join('/')} · ${p.nhlTeam}`, href: `/players?player=${p.id}`, team: p.nhlTeam, playerId: p.id }));
    return [...playerHits, ...teamHits, ...pages];
  }, [query, teams, players]);

  const choose = (result: Result | undefined) => {
    if (!result) return;
    setFocused(false);
    setQuery('');
    inputRef.current?.blur();
    if (result.playerId) openPlayer(result.playerId);
    else router.push(result.href);
  };

  const open = focused && query.trim().length > 0;

  return (
    <form ref={wrapRef} role="search" className="bb-search" onSubmit={event => { event.preventDefault(); choose(results[Math.max(cursor, 0)]); }}>
      <Search className="bb-search-icon" aria-hidden />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={e => { setQuery(e.target.value); setCursor(-1); }}
        onFocus={() => setFocused(true)}
        onKeyDown={event => {
          if (event.key === 'Escape') { setFocused(false); inputRef.current?.blur(); }
          else if (event.key === 'ArrowDown') { event.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)); }
          else if (event.key === 'ArrowUp') { event.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
        }}
        placeholder="Search players, teams and tools"
        aria-label="Search players, teams and tools"
        role="combobox"
        aria-expanded={open}
        aria-controls="bb-search-results"
        aria-activedescendant={cursor >= 0 ? results[cursor]?.id : undefined}
        autoComplete="off"
      />
      {query && <button type="button" className="bb-search-clear" onClick={() => { setQuery(''); inputRef.current?.focus(); }} aria-label="Clear search"><X className="h-4 w-4" /></button>}
      {open && (
        <ul id="bb-search-results" role="listbox" className="bb-search-results">
          {results.length === 0 && <li className="px-4 py-4 text-sm text-muted">No matches for “{query}”.</li>}
          {results.map((result, index) => {
            const header = index === 0 || results[index - 1].group !== result.group ? result.group : null;
            return (
              <li key={result.id} role="presentation">
                {header && <p className="bb-search-group">{header}</p>}
                <button type="button" id={result.id} role="option" aria-selected={index === cursor} className="bb-search-option" onMouseEnter={() => setCursor(index)} onClick={() => choose(result)}>
                  {result.team ? <TeamLogo team={{ abbrev: result.team }} size={22} /> : <span className="bb-search-page-icon" aria-hidden>↗</span>}
                  <span className="min-w-0 flex-1 text-left"><span className="block truncate font-medium">{result.label}</span><span className="block truncate text-xs text-muted">{result.detail}</span></span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </form>
  );
}
