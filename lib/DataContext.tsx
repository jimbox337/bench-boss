'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Player, Projection, LeagueSettings } from './calculator';
import { ESPNLeagueConfig, ESPNLeagueInfo } from './espnFantasyApi';

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
  espnConfig: ESPNLeagueConfig | null;
  espnLeagueInfo: ESPNLeagueInfo | null;
  espnTeams: any[];
  setESPNConfig: (config: ESPNLeagueConfig | null) => void;
  syncESPNLeague: (config: ESPNLeagueConfig) => Promise<void>;
  selectESPNTeam: (teamId: number) => void;
  leagueSettings: LeagueSettings;
  setLeagueSettings: (settings: LeagueSettings) => void;
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
  espnConfig: null,
  espnLeagueInfo: null,
  espnTeams: [],
  setESPNConfig: () => {},
  syncESPNLeague: async () => {},
  selectESPNTeam: () => {},
  leagueSettings: {} as LeagueSettings,
  setLeagueSettings: () => {},
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

  // ESPN integration state
  const [espnConfig, setESPNConfigState] = useState<ESPNLeagueConfig | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('benchBossESPNConfig');
      if (saved) {
        return JSON.parse(saved);
      }
    }
    return null;
  });

  const [espnLeagueInfo, setESPNLeagueInfo] = useState<ESPNLeagueInfo | null>(null);
  const [espnTeams, setESPNTeams] = useState<any[]>([]);

  // League settings state - load from default calculator settings
  const [leagueSettings, setLeagueSettingsState] = useState<LeagueSettings>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('benchBossLeagueSettings');
      if (saved) {
        return JSON.parse(saved);
      }
    }
    // Import default settings from calculator
    const { defaultLeagueSettings } = require('./calculator');
    return defaultLeagueSettings;
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

  const setESPNConfig = (config: ESPNLeagueConfig | null) => {
    setESPNConfigState(config);
    if (typeof window !== 'undefined') {
      if (config) {
        localStorage.setItem('benchBossESPNConfig', JSON.stringify(config));
      } else {
        localStorage.removeItem('benchBossESPNConfig');
      }
    }
  };

  const syncESPNLeague = async (config: ESPNLeagueConfig) => {
    try {
      setIsLoading(true);
      console.log('Syncing ESPN Fantasy League...');

      const response = await fetch('/api/espn-league', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to sync ESPN league');
      }

      // Update league info and settings
      setESPNLeagueInfo(data.leagueInfo);
      setLeagueSettingsState(data.leagueInfo.settings);

      // Store all teams for user selection
      if (data.teams && data.teams.length > 0) {
        setESPNTeams(data.teams);
        console.log(`✅ Found ${data.teams.length} teams in league`);

        // Don't auto-select team - let user choose
        // Unless they've already selected one before
        const savedTeamId = typeof window !== 'undefined'
          ? localStorage.getItem('benchBossESPNTeamId')
          : null;

        if (savedTeamId) {
          const savedTeam = data.teams.find((t: any) => t.id === parseInt(savedTeamId));
          if (savedTeam) {
            const { mapESPNPlayersToNHL } = await import('./espnFantasyApi');
            const mappedPlayers = mapESPNPlayersToNHL(savedTeam.roster, players);
            setMyTeam(mappedPlayers);
            console.log(`✅ Auto-loaded saved team: ${savedTeam.name}`);
          }
        }
      }

      // Save config
      setESPNConfig(config);

      console.log(`✅ ESPN league "${data.leagueInfo.name}" connected successfully!`);
    } catch (error) {
      console.error('❌ Error syncing ESPN league:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const selectESPNTeam = async (teamId: number) => {
    const team = espnTeams.find(t => t.id === teamId);
    if (!team) {
      console.error('Team not found');
      return;
    }

    console.log(`Selecting team: ${team.name}`);
    const { mapESPNPlayersToNHL } = await import('./espnFantasyApi');
    const mappedPlayers = mapESPNPlayersToNHL(team.roster, players);

    setMyTeam(mappedPlayers);

    // Save selection
    if (typeof window !== 'undefined') {
      localStorage.setItem('benchBossESPNTeamId', teamId.toString());
    }

    console.log(`✅ Loaded ${mappedPlayers.length} players from ${team.name}`);
  };

  const setLeagueSettings = (settings: LeagueSettings) => {
    setLeagueSettingsState(settings);
    if (typeof window !== 'undefined') {
      localStorage.setItem('benchBossLeagueSettings', JSON.stringify(settings));
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
      setMyTeam,
      espnConfig,
      espnLeagueInfo,
      espnTeams,
      setESPNConfig,
      syncESPNLeague,
      selectESPNTeam,
      leagueSettings,
      setLeagueSettings,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
