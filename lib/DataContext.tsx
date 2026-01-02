'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
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
  const { data: session, status } = useSession();
  const [players, setPlayers] = useState<Player[]>([]);
  const [projections, setProjections] = useState<Projection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLiveData, setIsLiveData] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [myTeam, setMyTeamState] = useState<Player[]>([]);
  const [teamDataLoaded, setTeamDataLoaded] = useState(false);

  // ESPN integration state
  const [espnConfig, setESPNConfigState] = useState<ESPNLeagueConfig | null>(null);

  const [espnLeagueInfo, setESPNLeagueInfo] = useState<ESPNLeagueInfo | null>(null);
  const [espnTeams, setESPNTeams] = useState<any[]>([]);

  // League settings state - load from default calculator settings
  const [leagueSettings, setLeagueSettingsState] = useState<LeagueSettings>(() => {
    // Import default settings from calculator
    const { defaultLeagueSettings } = require('./calculator');
    return defaultLeagueSettings;
  });

  // Load team data from database when user logs in
  useEffect(() => {
    async function loadTeamFromDatabase() {
      if (status === 'loading' || teamDataLoaded) return;

      if (status === 'authenticated' && session?.user) {
        try {
          console.log('📦 Loading team data from database...');
          const response = await fetch('/api/team');
          const data = await response.json();

          if (data.team) {
            const team = data.team;
            console.log('✅ Team data loaded from database:', team.name);

            // Restore roster
            if (team.roster && Array.isArray(team.roster)) {
              setMyTeamState(team.roster as Player[]);
            }

            // Restore league settings
            if (team.leagueSettings) {
              setLeagueSettingsState(team.leagueSettings as LeagueSettings);
            }

            // Restore ESPN config
            if (team.espnLeagueId) {
              setESPNConfigState({
                leagueId: team.espnLeagueId,
                seasonId: team.seasonId || new Date().getFullYear(),
                espnS2: team.espnS2 || undefined,
                swid: team.swid || undefined,
              });
            }

            setTeamDataLoaded(true);
          } else {
            console.log('📝 No team data found for user');
            setTeamDataLoaded(true);
          }
        } catch (error) {
          console.error('❌ Error loading team from database:', error);
          setTeamDataLoaded(true);
        }
      } else if (status === 'unauthenticated') {
        // Clear data when logged out
        setMyTeamState([]);
        setESPNConfigState(null);
        const { defaultLeagueSettings } = require('./calculator');
        setLeagueSettingsState(defaultLeagueSettings);
        setTeamDataLoaded(false);
      }
    }

    loadTeamFromDatabase();
  }, [status, session, teamDataLoaded]);

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

  const saveTeamToDatabase = async (roster: Player[]) => {
    if (status !== 'authenticated') return;

    try {
      await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: espnLeagueInfo?.name || 'My Team',
          platform: espnConfig ? 'ESPN' : 'Custom',
          espnLeagueId: espnConfig?.leagueId,
          espnTeamId: localStorage.getItem('benchBossESPNTeamId') || undefined,
          espnS2: espnConfig?.espnS2,
          swid: espnConfig?.swid,
          seasonId: espnConfig?.seasonId,
          roster,
          leagueSettings,
        }),
      });
    } catch (error) {
      console.error('Failed to save team to database:', error);
    }
  };

  const addToMyTeam = (player: Player) => {
    const newTeam = [...myTeam, player];
    setMyTeamState(newTeam);
    saveTeamToDatabase(newTeam);
  };

  const removeFromMyTeam = (playerId: string) => {
    const newTeam = myTeam.filter(p => p.id !== playerId);
    setMyTeamState(newTeam);
    saveTeamToDatabase(newTeam);
  };

  const setMyTeam = (players: Player[]) => {
    setMyTeamState(players);
    saveTeamToDatabase(players);
  };

  const setESPNConfig = (config: ESPNLeagueConfig | null) => {
    setESPNConfigState(config);
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

    // Update local state
    setMyTeamState(mappedPlayers);

    // Save to database
    if (status === 'authenticated' && espnConfig) {
      try {
        await fetch('/api/team', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: team.name,
            platform: 'ESPN',
            logo: team.logo,
            espnLeagueId: espnConfig.leagueId,
            espnTeamId: teamId.toString(),
            espnS2: espnConfig.espnS2,
            swid: espnConfig.swid,
            seasonId: espnConfig.seasonId,
            roster: mappedPlayers,
            leagueSettings,
          }),
        });
        console.log('✅ Team saved to database');
      } catch (error) {
        console.error('Failed to save team to database:', error);
      }
    }

    // Also save teamId to localStorage for backwards compatibility
    if (typeof window !== 'undefined') {
      localStorage.setItem('benchBossESPNTeamId', teamId.toString());
    }

    console.log(`✅ Loaded ${mappedPlayers.length} players from ${team.name}`);
  };

  const setLeagueSettings = (settings: LeagueSettings) => {
    setLeagueSettingsState(settings);
    // Settings will be saved to database when team is saved
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
