'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Player, Projection } from './calculator';

interface DataContextType {
  players: Player[];
  projections: Projection[];
  isLoading: boolean;
  isLiveData: boolean;
  syncLiveData: () => Promise<void>;
  lastSyncTime: Date | null;
  myTeam: Player[];
  addToMyTeam: (player: Player) => void;
  removeFromMyTeam: (playerId: string) => void;
  setMyTeam: (players: Player[]) => void;
}

const DataContext = createContext<DataContextType>({
  players: [],
  projections: [],
  isLoading: true,
  isLiveData: false,
  syncLiveData: async () => {},
  lastSyncTime: null,
  myTeam: [],
  addToMyTeam: () => {},
  removeFromMyTeam: () => {},
  setMyTeam: () => {},
});

export function DataProvider({ children }: { children: ReactNode }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [projections, setProjections] = useState<Projection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLiveData, setIsLiveData] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [myTeam, setMyTeamState] = useState<Player[]>(() => {
    // Load from localStorage if available
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('benchBossMyTeam');
      if (saved) {
        return JSON.parse(saved);
      }
    }
    return [];
  });

  useEffect(() => {
    // Auto-load real NHL data using fast API
    async function loadInitialData() {
      try {
        setIsLoading(true);
        console.log('Loading real NHL data...');
        const { loadLiveData } = await import('./liveData');
        const data = await loadLiveData();

        if (data.players.length > 0) {
          setPlayers(data.players);
          setProjections(data.projections);
          setIsLiveData(true);
          setLastSyncTime(new Date());
          console.log(`✅ Real NHL data loaded! ${data.players.length} players.`);
        } else {
          console.warn('⚠️ No players loaded from API');
          setIsLiveData(false);
        }
      } catch (error) {
        console.error('❌ Error loading NHL data:', error);
        setIsLiveData(false);
      } finally {
        setIsLoading(false);
      }
    }

    loadInitialData();
  }, []);

  const syncLiveData = async () => {
    try {
      setIsLoading(true);
      console.log('Manually syncing NHL data...');
      const { loadLiveData } = await import('./liveData');
      const data = await loadLiveData();

      if (data.players.length > 0) {
        setPlayers(data.players);
        setProjections(data.projections);
        setIsLiveData(true);
        setLastSyncTime(new Date());
        console.log(`✅ Live NHL data synced successfully! ${data.players.length} players loaded.`);
      } else {
        console.warn('⚠️ No players loaded from live data, keeping current data');
      }
    } catch (error) {
      console.error('❌ Error syncing live data:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const addToMyTeam = (player: Player) => {
    const newTeam = [...myTeam, player];
    setMyTeamState(newTeam);
    if (typeof window !== 'undefined') {
      localStorage.setItem('benchBossMyTeam', JSON.stringify(newTeam));
    }
  };

  const removeFromMyTeam = (playerId: string) => {
    const newTeam = myTeam.filter(p => p.id !== playerId);
    setMyTeamState(newTeam);
    if (typeof window !== 'undefined') {
      localStorage.setItem('benchBossMyTeam', JSON.stringify(newTeam));
    }
  };

  const setMyTeam = (players: Player[]) => {
    setMyTeamState(players);
    if (typeof window !== 'undefined') {
      localStorage.setItem('benchBossMyTeam', JSON.stringify(players));
    }
  };

  return (
    <DataContext.Provider value={{
      players,
      projections,
      isLoading,
      isLiveData,
      syncLiveData,
      lastSyncTime,
      myTeam,
      addToMyTeam,
      removeFromMyTeam,
      setMyTeam
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
