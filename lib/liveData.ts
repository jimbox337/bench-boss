import { Player, Projection } from './calculator';

let cachedPlayers: Player[] | null = null;
let cachedProjections: Projection[] | null = null;

export async function loadLiveData() {
  if (cachedPlayers && cachedProjections) {
    return { players: cachedPlayers, projections: cachedProjections };
  }

  try {
    console.log('Fetching live NHL data from API...');
    const response = await fetch('/api/nhl-data');

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch NHL data');
    }

    cachedPlayers = data.players;
    cachedProjections = data.projections;

    return { players: data.players, projections: data.projections };
  } catch (error) {
    console.error('Failed to load live data:', error);
    // Fallback to mock data
    const { mockPlayers, mockProjections } = await import('./mockdata');
    return { players: mockPlayers, projections: mockProjections };
  }
}

export function clearCache() {
  cachedPlayers = null;
  cachedProjections = null;
}