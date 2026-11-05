'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

const PlayerCard = dynamic(() => import('./PlayerCard'), { ssr: false });

type PlayerCardContext = { openPlayer: (id: string | number) => void; closePlayer: () => void };
const Context = createContext<PlayerCardContext>({ openPlayer: () => {}, closePlayer: () => {} });

export const usePlayerCard = () => useContext(Context);

/** One player card for the whole app. Any page opens it with openPlayer(id) or a ?player= link. */
export function PlayerCardProvider({ children }: { children: React.ReactNode }) {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const pathname = usePathname();
  const openPlayer = useCallback((id: string | number) => setPlayerId(String(id)), []);
  const closePlayer = useCallback(() => {
    setPlayerId(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has('player')) { url.searchParams.delete('player'); window.history.replaceState(null, '', url); }
  }, []);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('player');
    // Opening from a shared ?player= link is a one-off sync from the URL.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (id && /^\d+$/.test(id)) setPlayerId(id);
  }, [pathname]);

  return (
    <Context.Provider value={{ openPlayer, closePlayer }}>
      {children}
      {playerId && <PlayerCard key={playerId} playerId={playerId} onClose={closePlayer} />}
    </Context.Provider>
  );
}

/** A player's name that opens their card. Keeps a real link so it still works in a new tab. */
export function PlayerLink({ id, children, className = '', title }: { id: string | number; children: React.ReactNode; className?: string; title?: string }) {
  const { openPlayer } = usePlayerCard();
  return (
    <a
      href={`/players?player=${id}`}
      className={className}
      title={title}
      onClick={event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        openPlayer(id);
      }}
    >
      {children}
    </a>
  );
}
