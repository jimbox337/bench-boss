'use client';

import { useState } from 'react';
import { useData } from '@/lib/DataContext';
import { Player } from '@/lib/calculator';
import PlayerDetailModal from '@/components/PlayerDetailModal';

export default function PlayerExplorer() {
  const { players, myTeam } = useData();
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState('all');
  const [sortBy, setSortBy] = useState('proj_pts');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortDirection('desc');
    }
  };

  const filteredPlayers = players
    .filter(p => {
      const matchesSearch = p.name?.toLowerCase().includes(search.toLowerCase()) ?? false;
      const matchesPosition = position === 'all' || (p.positions?.includes(position) ?? false);
      return matchesSearch && matchesPosition;
    })
    .map(p => {
      const isMyPlayer = myTeam.some(mp => mp.id === p.id);
      return { player: p, isMyPlayer };
    })
    .sort((a, b) => {
      let result = 0;

      if (sortBy === 'proj_pts') result = (b.player.seasonStats?.PTS || 0) - (a.player.seasonStats?.PTS || 0);
      else if (sortBy === 'proj_g') result = (b.player.seasonStats?.G || 0) - (a.player.seasonStats?.G || 0);
      else if (sortBy === 'proj_a') result = (b.player.seasonStats?.A || 0) - (a.player.seasonStats?.A || 0);
      else if (sortBy === 'proj_ppp') result = (b.player.seasonStats?.PPP || 0) - (a.player.seasonStats?.PPP || 0);
      else if (sortBy === 'proj_sog') result = (b.player.seasonStats?.SOG || 0) - (a.player.seasonStats?.SOG || 0);
      else if (sortBy === 'proj_hit') result = (b.player.seasonStats?.HIT || 0) - (a.player.seasonStats?.HIT || 0);
      else if (sortBy === 'proj_blk') result = (b.player.seasonStats?.BLK || 0) - (a.player.seasonStats?.BLK || 0);
      else if (sortBy === 'name') result = a.player.name.localeCompare(b.player.name);
      else if (sortBy === 'team') result = a.player.nhlTeam.localeCompare(b.player.nhlTeam);
      else if (sortBy === 'gp') result = (b.player.gamesPlayed || 0) - (a.player.gamesPlayed || 0);

      return sortDirection === 'desc' ? result : -result;
    });

  return (
    <>
    <div className="bb-page">
      <header className="bb-page-header"><div><h1>Player Explorer</h1><p>Explore the NHL player pool. Compare season stats and find your next roster move.</p></div></header>

      {/* Search & Filters */}
      <div className="bb-toolbar mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_180px] gap-4">
          <div className="min-w-0">
            <label htmlFor="player-search" className="block text-sm font-medium text-ink-2 mb-2">Search player</label>
            <input
              id="player-search"
              type="text"
              placeholder="Search by name..."
              className="bb-field w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="player-position" className="block text-sm font-medium text-ink-2 mb-2">Position</label>
            <select id="player-position"
              className="bb-field w-full"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            >
              <option value="all">All Positions</option>
              <option value="C">C</option>
              <option value="LW">LW</option>
              <option value="RW">RW</option>
              <option value="D">D</option>
              <option value="G">G</option>
            </select>
          </div>
        </div>
        <div className="mt-4 text-sm text-muted">
          Showing {filteredPlayers.length} players
        </div>
      </div>

      {/* Player Table */}
      <div className="bb-panel overflow-hidden">
        <p className="border-b border-rule px-4 py-3 text-xs text-muted md:hidden">Swipe across the table for all stats.</p>
        <div className="overflow-x-auto">
          <table className="bb-table w-full">
            <thead className="bg-paper-3 border-b border-rule">
              <tr>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-ink-2 cursor-pointer hover:text-accent-2 transition-colors"
                  tabIndex={0}
                  aria-sort={sortBy === 'name' ? (sortDirection === 'desc' ? 'descending' : 'ascending') : 'none'}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('name'); } }}
                  onClick={() => handleSort('name')}
                >
                  Player {sortBy === 'name' && (sortDirection === 'desc' ? '↓' : '↑')}
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-ink-2 cursor-pointer hover:text-accent-2 transition-colors"
                  tabIndex={0}
                  aria-sort={sortBy === 'proj_pts' ? (sortDirection === 'desc' ? 'descending' : 'ascending') : 'none'}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('proj_pts'); } }}
                  onClick={() => handleSort('proj_pts')}
                >
                  PTS {sortBy === 'proj_pts' && (sortDirection === 'desc' ? '↓' : '↑')}
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-ink-2 cursor-pointer hover:text-accent-2 transition-colors"
                  tabIndex={0}
                  aria-sort={sortBy === 'team' ? (sortDirection === 'desc' ? 'descending' : 'ascending') : 'none'}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('team'); } }}
                  onClick={() => handleSort('team')}
                >
                  Team {sortBy === 'team' && (sortDirection === 'desc' ? '↓' : '↑')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-ink-2">Pos</th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-ink-2 cursor-pointer hover:text-accent-2 transition-colors"
                  tabIndex={0}
                  aria-sort={sortBy === 'gp' ? (sortDirection === 'desc' ? 'descending' : 'ascending') : 'none'}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('gp'); } }}
                  onClick={() => handleSort('gp')}
                >
                  GP {sortBy === 'gp' && (sortDirection === 'desc' ? '↓' : '↑')}
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-ink-2 cursor-pointer hover:text-accent-2 transition-colors"
                  tabIndex={0}
                  aria-sort={sortBy === 'proj_g' ? (sortDirection === 'desc' ? 'descending' : 'ascending') : 'none'}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('proj_g'); } }}
                  onClick={() => handleSort('proj_g')}
                >
                  G {sortBy === 'proj_g' && (sortDirection === 'desc' ? '↓' : '↑')}
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-ink-2 cursor-pointer hover:text-accent-2 transition-colors"
                  tabIndex={0}
                  aria-sort={sortBy === 'proj_a' ? (sortDirection === 'desc' ? 'descending' : 'ascending') : 'none'}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('proj_a'); } }}
                  onClick={() => handleSort('proj_a')}
                >
                  A {sortBy === 'proj_a' && (sortDirection === 'desc' ? '↓' : '↑')}
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-ink-2 cursor-pointer hover:text-accent-2 transition-colors"
                  tabIndex={0}
                  aria-sort={sortBy === 'proj_ppp' ? (sortDirection === 'desc' ? 'descending' : 'ascending') : 'none'}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('proj_ppp'); } }}
                  onClick={() => handleSort('proj_ppp')}
                >
                  PPP {sortBy === 'proj_ppp' && (sortDirection === 'desc' ? '↓' : '↑')}
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-ink-2 cursor-pointer hover:text-accent-2 transition-colors"
                  tabIndex={0}
                  aria-sort={sortBy === 'proj_sog' ? (sortDirection === 'desc' ? 'descending' : 'ascending') : 'none'}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('proj_sog'); } }}
                  onClick={() => handleSort('proj_sog')}
                >
                  SOG {sortBy === 'proj_sog' && (sortDirection === 'desc' ? '↓' : '↑')}
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-ink-2 cursor-pointer hover:text-accent-2 transition-colors"
                  tabIndex={0}
                  aria-sort={sortBy === 'proj_hit' ? (sortDirection === 'desc' ? 'descending' : 'ascending') : 'none'}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('proj_hit'); } }}
                  onClick={() => handleSort('proj_hit')}
                >
                  HIT {sortBy === 'proj_hit' && (sortDirection === 'desc' ? '↓' : '↑')}
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-ink-2 cursor-pointer hover:text-accent-2 transition-colors"
                  tabIndex={0}
                  aria-sort={sortBy === 'proj_blk' ? (sortDirection === 'desc' ? 'descending' : 'ascending') : 'none'}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('proj_blk'); } }}
                  onClick={() => handleSort('proj_blk')}
                >
                  BLK {sortBy === 'proj_blk' && (sortDirection === 'desc' ? '↓' : '↑')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {filteredPlayers.map(({ player, isMyPlayer }) => (
                <tr
                  key={player.id}
                  className={`hover:bg-paper-3 transition-colors cursor-pointer ${isMyPlayer ? 'bg-paper-3' : ''}`}
                  tabIndex={0}
                  aria-label={`View ${player.name}`}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedPlayer(player); } }}
                  onClick={() => setSelectedPlayer(player)}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      {player.headshotUrl ? (
                        <img
                          src={player.headshotUrl}
                          alt={player.name}
                          className="h-10 w-10 bg-paper-3 object-cover mr-3"
                          onError={(e) => {
                            // Fallback to initials if image fails to load
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`h-10 w-10  bg-paper-3 flex items-center justify-center text-ink-2 font-medium mr-3 ${player.headshotUrl ? 'hidden' : ''}`}>
                        {player.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-ink">{player.name}</div>
                        {isMyPlayer && (
                          <span className="inline-block px-2 py-0.5 bg-success/10 text-success text-xs font-medium mt-0.5">
                            My team
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium text-accent-2">{player.seasonStats?.PTS || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-ink-2">{player.nhlTeam}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-ink-2">{player.positions?.join('/') ?? ''}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-ink-2">{player.gamesPlayed || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-ink-2">{player.seasonStats?.G || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-ink-2">{player.seasonStats?.A || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-ink-2">{player.seasonStats?.PPP || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-ink-2">{player.seasonStats?.SOG || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-ink-2">{player.seasonStats?.HIT || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-ink-2">{player.seasonStats?.BLK || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Player Detail Modal */}
      {selectedPlayer && (
        <PlayerDetailModal
          player={selectedPlayer}
          isOpen={!!selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
    </>
  );
}
