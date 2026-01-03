'use client';

import { useState } from 'react';
import { useData } from '@/lib/DataContext';
import { Player } from '@/lib/calculator';
import PlayerDetailModal from '@/components/PlayerDetailModal';
import ProtectedRoute from '@/components/ProtectedRoute';

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
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchesPosition = position === 'all' || p.positions.includes(position);
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
    <ProtectedRoute requiresTeam={true}>
    <div className="p-8">
      <h2 className="text-3xl font-bold text-slate-100 mb-6">Player Explorer</h2>

      {/* Search & Filters */}
      <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-300 mb-2">Search Player</label>
            <input
              type="text"
              placeholder="Search by name..."
              className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 py-2 focus:border-blue-500 focus:outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Position</label>
            <select
              className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 py-2 focus:border-blue-500 focus:outline-none"
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
        <div className="mt-4 text-sm text-slate-400">
          Showing {filteredPlayers.length} players
        </div>
      </div>

      {/* Player Table */}
      <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-750 border-b border-slate-700">
              <tr>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-blue-400 transition-colors"
                  onClick={() => handleSort('name')}
                >
                  Player {sortBy === 'name' && (sortDirection === 'desc' ? '↓' : '↑')}
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-blue-400 transition-colors"
                  onClick={() => handleSort('team')}
                >
                  Team {sortBy === 'team' && (sortDirection === 'desc' ? '↓' : '↑')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Pos</th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-blue-400 transition-colors"
                  onClick={() => handleSort('gp')}
                >
                  GP {sortBy === 'gp' && (sortDirection === 'desc' ? '↓' : '↑')}
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-blue-400 transition-colors"
                  onClick={() => handleSort('proj_pts')}
                >
                  PTS {sortBy === 'proj_pts' && (sortDirection === 'desc' ? '↓' : '↑')}
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-blue-400 transition-colors"
                  onClick={() => handleSort('proj_g')}
                >
                  G {sortBy === 'proj_g' && (sortDirection === 'desc' ? '↓' : '↑')}
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-blue-400 transition-colors"
                  onClick={() => handleSort('proj_a')}
                >
                  A {sortBy === 'proj_a' && (sortDirection === 'desc' ? '↓' : '↑')}
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-blue-400 transition-colors"
                  onClick={() => handleSort('proj_ppp')}
                >
                  PPP {sortBy === 'proj_ppp' && (sortDirection === 'desc' ? '↓' : '↑')}
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-blue-400 transition-colors"
                  onClick={() => handleSort('proj_sog')}
                >
                  SOG {sortBy === 'proj_sog' && (sortDirection === 'desc' ? '↓' : '↑')}
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-blue-400 transition-colors"
                  onClick={() => handleSort('proj_hit')}
                >
                  HIT {sortBy === 'proj_hit' && (sortDirection === 'desc' ? '↓' : '↑')}
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-blue-400 transition-colors"
                  onClick={() => handleSort('proj_blk')}
                >
                  BLK {sortBy === 'proj_blk' && (sortDirection === 'desc' ? '↓' : '↑')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredPlayers.map(({ player, isMyPlayer }) => (
                <tr
                  key={player.id}
                  className={`hover:bg-slate-750 transition-colors cursor-pointer ${isMyPlayer ? 'bg-blue-900/20' : ''}`}
                  onClick={() => setSelectedPlayer(player)}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      {player.headshotUrl ? (
                        <img
                          src={player.headshotUrl}
                          alt={player.name}
                          className="h-10 w-10 rounded-full bg-slate-700 object-cover mr-3"
                          onError={(e) => {
                            // Fallback to initials if image fails to load
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold mr-3 ${player.headshotUrl ? 'hidden' : ''}`}>
                        {player.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-100">{player.name}</div>
                        {isMyPlayer && (
                          <span className="inline-block px-2 py-0.5 bg-green-900/30 text-green-400 text-xs font-medium rounded mt-0.5">
                            MY TEAM
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300">{player.nhlTeam}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300">{player.positions.join('/')}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-slate-300">{player.gamesPlayed || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-bold text-blue-400">{player.seasonStats?.PTS || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-slate-300">{player.seasonStats?.G || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-slate-300">{player.seasonStats?.A || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-slate-300">{player.seasonStats?.PPP || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-slate-300">{player.seasonStats?.SOG || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-slate-300">{player.seasonStats?.HIT || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-slate-300">{player.seasonStats?.BLK || '-'}</td>
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
    </ProtectedRoute>
  );
}