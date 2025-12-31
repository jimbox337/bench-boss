'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Player, Projection } from './calculator';
import { mockPlayers, mockProjections } from './mockdata';

interface DataContextType {
  players: Player[];
  projections: Projection[];
  isLoading: boolean;
  isLiveData: boolean;
  syncLiveData: () => Promise<void>;
  lastSyncTime: Date | null;
}

const DataContext = createContext<DataContextType>({
  players: mockPlayers,
  projections: mockProjections,
  isLoading: true,
  isLiveData: false,
  syncLiveData: async () => {},
  lastSyncTime: null,
});

export function DataProvider({ children }: { children: ReactNode }) {
  const [players, setPlayers] = useState<Player[]>(mockPlayers);
  const [projections, setProjections] = useState<Projection[]>(mockProjections);
  const [isLoading, setIsLoading] = useState(false);
  const [isLiveData, setIsLiveData] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        console.log('Auto-loading NHL live data on startup...');
        const { loadLiveData } = await import('./liveData');
        const data = await loadLiveData();

        if (data.players.length > 0) {
          setPlayers(data.players);
          setProjections(data.projections);
          setIsLiveData(true);
          setLastSyncTime(new Date());
          console.log(`✅ Live NHL data loaded successfully! ${data.players.length} players.`);
        } else {
          console.warn('⚠️ No players from live data, using mock data');
          setPlayers(mockPlayers);
          setProjections(mockProjections);
          setIsLiveData(false);
        }
      } catch (error) {
        console.error('❌ Error loading live data, using mock data:', error);
        setPlayers(mockPlayers);
        setProjections(mockProjections);
        setIsLiveData(false);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
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

  return (
    <DataContext.Provider value={{ players, projections, isLoading, isLiveData, syncLiveData, lastSyncTime }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
