'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, Star } from 'lucide-react';
import { useData } from '@/lib/DataContext';
import { calculateFantasyPoints, type GoalieStats, type Player, type Projection, type SkaterStats } from '@/lib/calculator';
import { usePlayerCard } from '@/components/player/PlayerCardProvider';
import { pointsScoring } from '@/components/gamecenter/shared';
import './players.css';
import { displayPositions, hasPosition } from '@/lib/positions';

const PAGE_SIZE = 25;
const POSITIONS = [
  ['skaters', 'All skaters'],
  ['C', 'C'],
  ['LW', 'LW'],
  ['RW', 'RW'],
  ['D', 'D'],
  ['G', 'G'],
] as const;
type PositionTab = (typeof POSITIONS)[number][0];
type StatView = 'season' | 'per_game' | 'next_7';
type Status = 'all' | 'available' | 'mine' | 'injured';

type SkaterKey = 'GP' | keyof Pick<SkaterStats, 'G' | 'A' | 'PTS' | 'plusMinus' | 'PPP' | 'SOG' | 'HIT' | 'BLK'>;
type GoalieKey = 'GP' | keyof Pick<GoalieStats, 'W' | 'GA' | 'SV' | 'SV_PCT' | 'GAA' | 'SO'>;
const SKATER_COLS: [SkaterKey, string, string][] = [
  ['GP', 'GP', 'Games played'], ['G', 'G', 'Goals'], ['A', 'A', 'Assists'], ['PTS', 'P', 'Points'], ['plusMinus', '+/-', 'Plus/minus'],
  ['PPP', 'PPP', 'Power-play points'], ['SOG', 'SOG', 'Shots on goal'], ['HIT', 'HIT', 'Hits'], ['BLK', 'BLK', 'Blocked shots'],
];
const GOALIE_COLS: [GoalieKey, string, string][] = [
  ['GP', 'GP', 'Games'], ['W', 'W', 'Wins'], ['GA', 'GA', 'Goals against'], ['SV', 'SV', 'Saves'],
  ['SV_PCT', 'SV%', 'Save percentage'], ['GAA', 'GAA', 'Goals-against average'], ['SO', 'SO', 'Shutouts'],
];

type Row = {
  player: Player;
  stats: Partial<Record<string, number>> | null;
  fpts: number | null;
  rank: number | null;
  mine: boolean;
};

const INJURY_SHORT: Record<string, string> = { 'Day-to-Day': 'DTD', Questionable: 'Q', IR: 'IR', Out: 'O' };

function perGame(stats: SkaterStats, games: number): SkaterStats {
  const g = Math.max(1, games);
  return { G: stats.G / g, A: stats.A / g, PTS: stats.PTS / g, plusMinus: stats.plusMinus / g, PPP: stats.PPP / g, SOG: stats.SOG / g, HIT: stats.HIT / g, BLK: stats.BLK / g, PIM: stats.PIM / g };
}

function formatStat(key: string, value: number | undefined, view: StatView): string {
  if (value === undefined || !Number.isFinite(value)) return '–';
  if (key === 'SV_PCT') return value.toFixed(3).replace(/^0/, '');
  if (key === 'GAA') return value.toFixed(2);
  if (key === 'GP') return String(Math.round(value));
  if (view === 'season') return String(Math.round(value));
  return value.toFixed(view === 'per_game' ? 2 : 1);
}

function SortHeader({ k, label, title, className, sort, onSort }: {
  k: string; label: string; title?: string; className?: string;
  sort: { key: string; dir: 'desc' | 'asc' }; onSort: (key: string) => void;
}) {
  const active = sort.key === k;
  return (
    <th scope="col" aria-sort={active ? (sort.dir === 'desc' ? 'descending' : 'ascending') : 'none'} className={className}>
      <button type="button" onClick={() => onSort(k)} title={title} className={active ? 'is-sorted' : undefined}>
        {label}{active && <span aria-hidden="true">{sort.dir === 'desc' ? '▼' : '▲'}</span>}
      </button>
    </th>
  );
}

export default function PlayerExplorer() {
  const { players, projections, myTeam, leagueSettings, isLoading } = useData();
  const { openPlayer } = usePlayerCard();
  const scoring = useMemo(() => pointsScoring(leagueSettings), [leagueSettings]);

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<PositionTab>('skaters');
  const [status, setStatus] = useState<Status>('all');
  const [view, setView] = useState<StatView>('season');
  const [sort, setSort] = useState<{ key: string; dir: 'desc' | 'asc' }>({ key: 'fpts', dir: 'desc' });
  const [page, setPage] = useState(0);

  const goalies = tab === 'G';
  // Season goalie stats are not loaded, so the goalie tab uses projections.
  const effectiveView: StatView = goalies ? 'next_7' : view;

  const projectionById = useMemo(
    () => new Map(projections.filter((p) => p.timeframe === 'next_7').map((p) => [p.playerId, p])),
    [projections],
  );
  const myIds = useMemo(() => new Set(myTeam.map((p) => p.id)), [myTeam]);

  // Stats, fantasy points and an overall rank for every player in the group, before filters.
  const groupRows = useMemo<Row[]>(() => {
    const rows = players
      .filter((p) => (goalies ? p.isGoalie : !p.isGoalie))
      .map((player): Row => {
        let stats: Row['stats'] = null;
        let projection: Projection | null = null;
        if (effectiveView === 'next_7') {
          const p = projectionById.get(player.id);
          if (p) {
            projection = p;
            stats = { GP: Math.round(p.gamesPlayed), ...(goalies ? p.goalieStats : p.skaterStats) };
          }
        } else if (player.seasonStats) {
          const base = effectiveView === 'per_game' ? perGame(player.seasonStats, player.gamesPlayed ?? 0) : player.seasonStats;
          stats = { GP: player.gamesPlayed ?? 0, ...base };
          projection = { playerId: player.id, timeframe: 'per_game', gamesPlayed: player.gamesPlayed ?? 0, skaterStats: base };
        }
        let fpts: number | null = null;
        if (projection) {
          try { fpts = calculateFantasyPoints(projection, scoring.settings); } catch { fpts = null; }
        }
        return { player, stats, fpts, rank: null, mine: myIds.has(player.id) };
      });
    rows
      .filter((r) => r.fpts !== null)
      .sort((a, b) => (b.fpts ?? 0) - (a.fpts ?? 0))
      .forEach((r, i) => { r.rank = i + 1; });
    return rows;
  }, [players, goalies, effectiveView, projectionById, scoring.settings, myIds]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = groupRows.filter(({ player, mine }) => {
      if (q && !player.name.toLowerCase().includes(q) && !player.nhlTeam.toLowerCase().includes(q)) return false;
      if (!goalies && tab !== 'skaters' && !hasPosition(player, tab)) return false;
      if (status === 'mine' && !mine) return false;
      if (status === 'available' && mine) return false;
      if (status === 'injured' && (!player.injuryStatus || player.injuryStatus === 'Healthy')) return false;
      return true;
    });
    const value = (r: Row): number | string | null => {
      if (sort.key === 'name') return r.player.name;
      if (sort.key === 'fpts' || sort.key === 'rank') return r.fpts;
      return r.stats?.[sort.key] ?? null;
    };
    // "Best first" is the default (desc) direction for every column.
    const lowerIsBetter = sort.key === 'GA' || sort.key === 'GAA' || sort.key === 'rank';
    return filtered.sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      if (va === null && vb === null) return a.player.name.localeCompare(b.player.name);
      if (va === null) return 1;
      if (vb === null) return -1;
      let result = typeof va === 'string' ? va.localeCompare(vb as string) : (vb as number) - va;
      if (lowerIsBetter && sort.key !== 'rank') result = -result;
      return (sort.dir === 'desc' ? result : -result) || a.player.name.localeCompare(b.player.name);
    });
  }, [groupRows, search, tab, goalies, status, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const columns = goalies ? GOALIE_COLS : SKATER_COLS;
  const first = rows.length ? current * PAGE_SIZE + 1 : 0;
  const last = Math.min(rows.length, (current + 1) * PAGE_SIZE);

  const onSort = (key: string) => { setPage(0); setSort((s) => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' })); };

  const pager = (
    <div className="pl-pager">
      <span className="pl-count">{first}–{last} of {rows.length}</span>
      <div className="pl-pager-buttons">
        <button type="button" onClick={() => setPage(current - 1)} disabled={current === 0}><ChevronLeft size={15} aria-hidden="true" /> Prev {PAGE_SIZE}</button>
        <button type="button" onClick={() => setPage(current + 1)} disabled={current >= pages - 1}>Next {PAGE_SIZE} <ChevronRight size={15} aria-hidden="true" /></button>
      </div>
    </div>
  );

  return (
    <div className="bb-page pl-page">
      <header className="bb-page-header"><div><h1>Players</h1><p>Search the NHL player pool, compare stats and fantasy points, and find your next add.</p></div></header>

      <section className="bb-panel pl-filters" aria-label="Player filters">
        <div className="pl-filter-row">
          <div className="pl-tabs" role="tablist" aria-label="Position">
            {POSITIONS.map(([value, label]) => (
              <button key={value} type="button" role="tab" aria-selected={tab === value} className={tab === value ? 'is-active' : undefined} onClick={() => { setTab(value); setPage(0); }}>{label}</button>
            ))}
          </div>
          <label className="pl-search">
            <span className="sr-only">Search players</span>
            <input type="search" placeholder="Search player or team" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
            <Search size={16} aria-hidden="true" />
          </label>
        </div>
        <div className="pl-filter-row pl-filter-row-2">
          <label className="pl-select">
            <span>Status</span>
            <select value={status} onChange={(e) => { setStatus(e.target.value as Status); setPage(0); }}>
              <option value="all">All players</option>
              <option value="available">Not on my team</option>
              <option value="mine">My team</option>
              <option value="injured">Injured</option>
            </select>
          </label>
          <label className="pl-select">
            <span>Stats</span>
            <select value={effectiveView} onChange={(e) => { setView(e.target.value as StatView); setPage(0); }}>
              {!goalies && <option value="season">Season (total)</option>}
              {!goalies && <option value="per_game">Season (per game)</option>}
              <option value="next_7">Projected (next 7 days)</option>
            </select>
          </label>
          <p className="pl-scoring">Fan Pts use {scoring.label}.{goalies && ' Goalies show model projections.'}</p>
        </div>
      </section>

      <section className="bb-panel pl-results" aria-label="Players">
        {pager}
        <div className="pl-table-wrap">
          <table className="pl-table">
            <thead>
              <tr className="pl-group-row">
                <th scope="colgroup" className="pl-sticky pl-left">{goalies ? 'Goalies' : 'Skaters'}</th>
                <th scope="colgroup" colSpan={2} className="pl-group">Fantasy</th>
                <th scope="colgroup" colSpan={columns.length} className="pl-group">
                  {effectiveView === 'season' ? 'Season stats' : effectiveView === 'per_game' ? 'Per game' : 'Projected, next 7 days'}
                </th>
              </tr>
              <tr>
                <SortHeader k="name" label="Player" className="pl-sticky pl-left" sort={sort} onSort={onSort} />
                <SortHeader k="rank" label="Rank" title="Rank by fantasy points in this view" sort={sort} onSort={onSort} />
                <SortHeader k="fpts" label="Fan Pts" title="Fantasy points" className="pl-fpts" sort={sort} onSort={onSort} />
                {columns.map(([key, label, title]) => (
                  <SortHeader key={key} k={key} label={label} title={title} className={key === 'GP' ? 'pl-divider' : undefined} sort={sort} onSort={onSort} />
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(({ player, stats, fpts, rank, mine }) => {
                const injury = player.injuryStatus && player.injuryStatus !== 'Healthy' ? INJURY_SHORT[player.injuryStatus] ?? player.injuryStatus : null;
                return (
                  <tr key={player.id} className={mine ? 'is-mine' : undefined}>
                    <th scope="row" className="pl-sticky pl-left">
                      <div className="pl-player">
                        <span className="pl-headshot">
                          {player.headshotUrl
                            ? <img src={player.headshotUrl} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                            : player.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}
                        </span>
                        <span className="min-w-0">
                          <span className="pl-name-line">
                            <a href={`/players?player=${player.id}`} className="pl-name" onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); openPlayer(player.id); }}>{player.name}</a>
                            {injury && <span className="pl-injury" title={player.injuryStatus}>{injury}</span>}
                            {mine && <Star size={12} className="pl-mine" aria-label="On my team" />}
                          </span>
                          <span className="pl-meta">{player.nhlTeam} - {displayPositions(player.positions).join(',') || (player.isGoalie ? 'G' : '')}</span>
                        </span>
                      </div>
                    </th>
                    <td className="pl-rank">{rank ?? '–'}</td>
                    <td className="pl-fpts">{fpts === null ? '–' : fpts.toFixed(1)}</td>
                    {columns.map(([key]) => <td key={key} className={key === 'GP' ? 'pl-divider' : undefined}>{formatStat(key, stats?.[key], effectiveView)}</td>)}
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr><td colSpan={3 + columns.length} className="pl-empty">{isLoading ? 'Loading players…' : 'No players match these filters.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {pager}
      </section>
    </div>
  );
}
