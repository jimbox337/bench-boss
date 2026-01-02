'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '@/lib/DataContext';
import PlayerDetailModal from '@/components/PlayerDetailModal';
import { Player } from '@/lib/calculator';

export default function MyTeam() {
  const router = useRouter();
  const { players, myTeam, addToMyTeam, removeFromMyTeam } = useData();
  const [search, setSearch] = useState('');
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  // Show empty state if no team
  if (myTeam.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-2xl w-full text-center">
          <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-12">
            {/* Icon */}
            <div className="w-24 h-24 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>

            {/* Title */}
            <h2 className="text-3xl font-bold text-slate-100 mb-3">
              No Team Yet
            </h2>

            {/* Description */}
            <p className="text-slate-400 mb-8 text-lg">
              Get started by adding your fantasy hockey team. Connect your ESPN league or build a custom team.
            </p>

            {/* Action Button */}
            <button
              onClick={() => router.push('/teams/new')}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl text-lg inline-flex items-center gap-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Your First Team
            </button>

            {/* Help Text */}
            <p className="text-slate-500 mt-6 text-sm">
              You can always add more teams later from the settings page
            </p>
          </div>
        </div>
      </div>
    );
  }

  const availablePlayers = players.filter(p => !myTeam.some(tp => tp.id === p.id));

  const filteredAvailable = availablePlayers.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.nhlTeam.toLowerCase().includes(search.toLowerCase())
  );

  const groupedByPosition = {
    C: myTeam.filter(p => p.positions.includes('C')),
    LW: myTeam.filter(p => p.positions.includes('LW')),
    RW: myTeam.filter(p => p.positions.includes('RW')),
    D: myTeam.filter(p => p.positions.includes('D')),
    G: myTeam.filter(p => p.isGoalie),
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-100">My Team</h2>
          <p className="text-slate-400 mt-1">{myTeam.length} players on roster</p>
        </div>
        <button
          onClick={() => setShowAddPlayer(!showAddPlayer)}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          {showAddPlayer ? 'Close' : '+ Add Player'}
        </button>
      </div>

      {/* Add Player Section */}
      {showAddPlayer && (
        <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-6 mb-6">
          <h3 className="text-xl font-bold mb-4">Add Player to Roster</h3>

          <input
            type="text"
            placeholder="Search players..."
            className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-4 py-2 mb-4 focus:border-blue-500 focus:outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="max-h-96 overflow-y-auto">
            <table className="w-full">
              <thead className="bg-slate-750 border-b border-slate-700 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Player</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Team</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Pos</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-300 uppercase">PTS</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-300 uppercase">G</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-300 uppercase">A</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-300 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredAvailable.slice(0, 50).map((player) => (
                  <tr key={player.id} className="hover:bg-slate-750 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-100">
                      {player.name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300">
                      {player.nhlTeam}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300">
                      {player.positions.join('/')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-blue-400">
                      {player.seasonStats?.PTS || 0}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-slate-300">
                      {player.seasonStats?.G || 0}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-slate-300">
                      {player.seasonStats?.A || 0}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <button
                        onClick={() => {
                          addToMyTeam(player);
                          setSearch('');
                        }}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                      >
                        Add
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Roster by Position */}
      <div className="grid grid-cols-1 gap-6">
        {Object.entries(groupedByPosition).map(([position, posPlayers]) => (
          <div key={position} className="bg-slate-800 rounded-xl shadow-lg border border-slate-700">
            <div className="p-4 border-b border-slate-700">
              <h3 className="text-lg font-bold text-slate-100">
                {position === 'G' ? 'Goalies' :
                 position === 'D' ? 'Defensemen' :
                 position === 'C' ? 'Centers' :
                 position === 'LW' ? 'Left Wings' : 'Right Wings'}
                <span className="text-sm text-slate-400 ml-2">({posPlayers.length})</span>
              </h3>
            </div>

            {posPlayers.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                No {position} players on roster
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-750">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Player</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Team</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-300 uppercase">GP</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-300 uppercase">PTS</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-300 uppercase">G</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-300 uppercase">A</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-300 uppercase">PPP</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-300 uppercase">SOG</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-300 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {posPlayers.map((player) => (
                      <tr key={player.id} className="hover:bg-slate-750 transition-colors cursor-pointer" onClick={() => setSelectedPlayer(player)}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-medium text-slate-100 hover:text-blue-400 transition-colors">{player.name}</div>
                          <div className="text-xs text-slate-400">{player.positions.join('/')}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300">
                          {player.nhlTeam}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-slate-300">
                          {player.gamesPlayed || 0}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-bold text-blue-400">
                          {player.seasonStats?.PTS || 0}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-slate-300">
                          {player.seasonStats?.G || 0}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-slate-300">
                          {player.seasonStats?.A || 0}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-slate-300">
                          {player.seasonStats?.PPP || 0}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-slate-300">
                          {player.seasonStats?.SOG || 0}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <button
                            onClick={() => removeFromMyTeam(player.id)}
                            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
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
  );
}
