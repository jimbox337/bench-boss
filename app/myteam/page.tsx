'use client';

import { useState } from 'react';
import { useSession } from '@/lib/AuthContext';
import { TriangleAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useData } from '@/lib/DataContext';
import { PlayerLink, usePlayerCard } from '@/components/player/PlayerCardProvider';

export default function MyTeam() {
  const router = useRouter();
  const { status } = useSession();
  const { players, myTeam, addToMyTeam, removeFromMyTeam, setMyTeam, refreshTeam, setESPNConfig } = useData();
  const [search, setSearch] = useState('');
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const { openPlayer } = usePlayerCard();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteTeam = async () => {
    setIsDeleting(true);
    try {
      if (status === 'authenticated') {
        const response = await fetch('/api/team', { method: 'DELETE' });
        if (!response.ok) throw new Error('Unable to delete team');
      }
      if (status === 'authenticated') await refreshTeam();
      else setMyTeam([]);
      setESPNConfig(null);
      router.push('/');
    } catch {
      // silently fail
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const availablePlayers = players.filter(p => !myTeam.some(tp => tp.id === p.id));

  const filteredAvailable = availablePlayers.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.nhlTeam?.toLowerCase().includes(search.toLowerCase())
  );

  const groupedByPosition = {
    C: myTeam.filter(p => p.positions?.includes('C')),
    LW: myTeam.filter(p => p.positions?.includes('LW')),
    RW: myTeam.filter(p => p.positions?.includes('RW')),
    D: myTeam.filter(p => p.positions?.includes('D')),
    G: myTeam.filter(p => p.isGoalie),
  };

  return (
    <>
    <div className="bb-page">
      <div className="bb-page-header">
        <div>
          <h1>{status === 'unauthenticated' ? 'Guest Roster' : 'My Team'}</h1>
          {status === 'unauthenticated' && <p className="text-muted mt-1">Build a roster to use every tool. Kept in this browser tab; sign in to save a personal team.</p>}
          <p className="text-muted mt-1">{myTeam.length} players on roster</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowAddPlayer(!showAddPlayer)}
            className="bb-button"
          >
            {showAddPlayer ? 'Close' : '+ Add Player'}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 bg-paper-3 text-error font-medium hover:bg-error/10 hover:text-error transition-colors border border-rule hover:border-error"
          >
            {status === 'unauthenticated' ? 'Clear Roster' : 'Delete Team'}
          </button>
        </div>
      </div>

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper/85 p-4">
          <div className="bb-panel p-8 max-w-sm w-full text-center">
            <TriangleAlert className="mx-auto mb-4 h-8 w-8 text-error" aria-hidden="true" />
            <h3 className="text-xl font-medium text-ink mb-2">Delete Team?</h3>
            <p className="text-muted text-sm mb-6">This will remove your team and all roster data. You can reconnect your league any time.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-paper-3 text-ink-2 hover:bg-paper-3 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTeam}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-error/10 text-error hover:bg-error/10 transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Player Section */}
      {showAddPlayer && (
        <div className="bb-panel p-6 mb-6">
          <h3 className="text-xl font-medium mb-4">Add Player to Roster</h3>

          <input
            type="text"
            placeholder="Search players..."
            aria-label="Search players" className="bb-field w-full mb-4"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="max-h-96 overflow-auto">
            <table className="bb-table w-full">
              <thead className="bg-paper-3 border-b border-rule sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-ink-2">Player</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-ink-2">Team</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-ink-2">Pos</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-ink-2">PTS</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-ink-2">G</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-ink-2">A</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-ink-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {filteredAvailable.slice(0, 50).map((player) => (
                  <tr key={player.id} className="hover:bg-paper-3 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-ink">
                      <PlayerLink id={player.id} className="bb-player-link">{player.name}</PlayerLink>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-ink-2">
                      {player.nhlTeam}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-ink-2">
                      {player.positions?.join('/') ?? ''}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-accent-2">
                      {player.seasonStats?.PTS || 0}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-ink-2">
                      {player.seasonStats?.G || 0}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-ink-2">
                      {player.seasonStats?.A || 0}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <button
                        onClick={() => {
                          addToMyTeam(player);
                          setSearch('');
                        }}
                        className="bb-button-secondary text-sm"
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
          <div key={position} className="bb-panel">
            <div className="p-4 border-b border-rule">
              <h3 className="text-lg font-medium text-ink">
                {position === 'G' ? 'Goalies' :
                 position === 'D' ? 'Defensemen' :
                 position === 'C' ? 'Centers' :
                 position === 'LW' ? 'Left Wings' : 'Right Wings'}
                <span className="text-sm text-muted ml-2">({posPlayers.length})</span>
              </h3>
            </div>

            {posPlayers.length === 0 ? (
              <div className="p-8 text-center text-muted">
                No {position} players on roster
              </div>
            ) : (
              <div className="overflow-x-auto">
            <p className="mb-3 text-xs text-muted md:hidden">Swipe across the table for all stats.</p>
                <table className="bb-table w-full">
                  <thead className="bg-paper-3">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-ink-2">Player</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-ink-2">Team</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-ink-2">GP</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-ink-2">PTS</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-ink-2">G</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-ink-2">A</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-ink-2">PPP</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-ink-2">SOG</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-ink-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule">
                    {posPlayers.map((player) => (
                      <tr key={player.id} tabIndex={0} aria-label={`View ${player.name}`} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openPlayer(player.id); } }} className="hover:bg-paper-3 transition-colors cursor-pointer" onClick={() => openPlayer(player.id)}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-medium text-ink hover:text-accent-2 transition-colors">{player.name}</div>
                          <div className="text-xs text-muted">{player.positions?.join('/') ?? ''}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-ink-2">
                          {player.nhlTeam}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-ink-2">
                          {player.gamesPlayed || 0}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium text-accent-2">
                          {player.seasonStats?.PTS || 0}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-ink-2">
                          {player.seasonStats?.G || 0}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-ink-2">
                          {player.seasonStats?.A || 0}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-ink-2">
                          {player.seasonStats?.PPP || 0}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-ink-2">
                          {player.seasonStats?.SOG || 0}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <button
                            onClick={(e) => { e.stopPropagation(); removeFromMyTeam(player.id); }}
                            className="bb-button-secondary text-error text-sm"
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
    </div>
    </>
  );
}
