import { Player, Projection, LeagueSettings } from './calculator';

// Mock NHL Players
export const mockPlayers: Player[] = [
  {
    id: 'mcdavid-97',
    name: 'Connor McDavid',
    nhlTeam: 'EDM',
    positions: ['C'],
    isGoalie: false,
    gamesPlayed: 35,
    seasonStats: { G: 21, A: 48, PTS: 69, plusMinus: 15, PPP: 35, SOG: 168, HIT: 8, BLK: 6, PIM: 14 },
  },
  {
    id: 'kucherov-86',
    name: 'Nikita Kucherov',
    nhlTeam: 'TBL',
    positions: ['RW'],
    isGoalie: false,
    gamesPlayed: 33,
    seasonStats: { G: 18, A: 42, PTS: 60, plusMinus: 12, PPP: 28, SOG: 140, HIT: 10, BLK: 7, PIM: 18 },
  },
  {
    id: 'mackinnon-29',
    name: 'Nathan MacKinnon',
    nhlTeam: 'COL',
    positions: ['C'],
    isGoalie: false,
    gamesPlayed: 34,
    seasonStats: { G: 24, A: 38, PTS: 62, plusMinus: 18, PPP: 30, SOG: 165, HIT: 18, BLK: 12, PIM: 22 },
  },
  {
    id: 'makar-8',
    name: 'Cale Makar',
    nhlTeam: 'COL',
    positions: ['D'],
    isGoalie: false,
    gamesPlayed: 32,
    seasonStats: { G: 12, A: 35, PTS: 47, plusMinus: 20, PPP: 24, SOG: 125, HIT: 22, BLK: 38, PIM: 16 },
  },
  {
    id: 'panarin-10',
    name: 'Artemi Panarin',
    nhlTeam: 'NYR',
    positions: ['LW'],
    isGoalie: false,
    gamesPlayed: 35,
    seasonStats: { G: 19, A: 38, PTS: 57, plusMinus: 14, PPP: 26, SOG: 138, HIT: 8, BLK: 6, PIM: 18 },
  },
  {
    id: 'zibanejad-93',
    name: 'Mika Zibanejad',
    nhlTeam: 'NYR',
    positions: ['C'],
    isGoalie: false,
    gamesPlayed: 34,
    seasonStats: { G: 14, A: 22, PTS: 36, plusMinus: 5, PPP: 17, SOG: 115, HIT: 10, BLK: 12, PIM: 18 },
  },
  {
    id: 'hughes-43',
    name: 'Quinn Hughes',
    nhlTeam: 'VAN',
    positions: ['D'],
    isGoalie: false,
    gamesPlayed: 36,
    seasonStats: { G: 8, A: 30, PTS: 38, plusMinus: 4, PPP: 16, SOG: 98, HIT: 18, BLK: 35, PIM: 10 },
  },
  {
    id: 'terry-19',
    name: 'Troy Terry',
    nhlTeam: 'ANA',
    positions: ['RW'],
    isGoalie: false,
    gamesPlayed: 33,
    seasonStats: { G: 12, A: 16, PTS: 28, plusMinus: -8, PPP: 10, SOG: 102, HIT: 14, BLK: 8, PIM: 12 },
  },
  {
    id: 'necas-88',
    name: 'Martin Necas',
    nhlTeam: 'CAR',
    positions: ['C', 'RW'],
    isGoalie: false,
    gamesPlayed: 35,
    seasonStats: { G: 14, A: 24, PTS: 38, plusMinus: 9, PPP: 15, SOG: 118, HIT: 12, BLK: 10, PIM: 14 },
  },
  {
    id: 'markstrom-25',
    name: 'Jacob Markstrom',
    nhlTeam: 'NJD',
    positions: ['G'],
    isGoalie: true,
    gamesPlayed: 30,
  },
  {
    id: 'pettersson-40',
    name: 'Elias Pettersson',
    nhlTeam: 'VAN',
    positions: ['C'],
    isGoalie: false,
    gamesPlayed: 34,
    seasonStats: { G: 13, A: 20, PTS: 33, plusMinus: 2, PPP: 14, SOG: 108, HIT: 8, BLK: 9, PIM: 16 },
  },
  {
    id: 'boeser-6',
    name: 'Brock Boeser',
    nhlTeam: 'VAN',
    positions: ['RW'],
    isGoalie: false,
    gamesPlayed: 35,
    seasonStats: { G: 11, A: 17, PTS: 28, plusMinus: 1, PPP: 12, SOG: 95, HIT: 10, BLK: 7, PIM: 14 },
  },
];

// Mock Projections (next 7 days)
export const mockProjections: Projection[] = [
  {
    playerId: 'mcdavid-97',
    timeframe: 'next_7',
    gamesPlayed: 4,
    skaterStats: {
      G: 1.8, A: 3.2, PTS: 5.0, plusMinus: 2, PPP: 2.4,
      SOG: 14.8, HIT: 2.0, BLK: 1.2, PIM: 2,
    },
  },
  {
    playerId: 'kucherov-86',
    timeframe: 'next_7',
    gamesPlayed: 4,
    skaterStats: {
      G: 1.6, A: 3.2, PTS: 4.8, plusMinus: 1, PPP: 2.8,
      SOG: 12.4, HIT: 1.2, BLK: 0.8, PIM: 1,
    },
  },
  {
    playerId: 'mackinnon-29',
    timeframe: 'next_7',
    gamesPlayed: 3,
    skaterStats: {
      G: 1.5, A: 2.7, PTS: 4.2, plusMinus: 2, PPP: 2.1,
      SOG: 11.1, HIT: 2.4, BLK: 1.5, PIM: 1,
    },
  },
  {
    playerId: 'makar-8',
    timeframe: 'next_7',
    gamesPlayed: 3,
    skaterStats: {
      G: 0.9, A: 2.4, PTS: 3.3, plusMinus: 3, PPP: 1.8,
      SOG: 9.0, HIT: 1.5, BLK: 3.6, PIM: 0,
    },
  },
  {
    playerId: 'panarin-10',
    timeframe: 'next_7',
    gamesPlayed: 3,
    skaterStats: {
      G: 1.2, A: 2.4, PTS: 3.6, plusMinus: 0, PPP: 1.8,
      SOG: 8.7, HIT: 0.6, BLK: 0.9, PIM: 0,
    },
  },
  {
    playerId: 'zibanejad-93',
    timeframe: 'next_7',
    gamesPlayed: 3,
    skaterStats: {
      G: 0.9, A: 1.5, PTS: 2.4, plusMinus: -1, PPP: 0.9,
      SOG: 7.8, HIT: 1.8, BLK: 1.2, PIM: 2,
    },
  },
  {
    playerId: 'hughes-43',
    timeframe: 'next_7',
    gamesPlayed: 4,
    skaterStats: {
      G: 0.8, A: 2.8, PTS: 3.6, plusMinus: 2, PPP: 2.0,
      SOG: 10.4, HIT: 1.2, BLK: 3.2, PIM: 0,
    },
  },
  {
    playerId: 'terry-19',
    timeframe: 'next_7',
    gamesPlayed: 4,
    skaterStats: {
      G: 1.2, A: 1.6, PTS: 2.8, plusMinus: 0, PPP: 0.8,
      SOG: 13.6, HIT: 8.4, BLK: 2.0, PIM: 2,
    },
  },
  {
    playerId: 'necas-88',
    timeframe: 'next_7',
    gamesPlayed: 4,
    skaterStats: {
      G: 0.8, A: 2.0, PTS: 2.8, plusMinus: 1, PPP: 1.2,
      SOG: 10.4, HIT: 4.0, BLK: 1.6, PIM: 1,
    },
  },
  {
    playerId: 'markstrom-25',
    timeframe: 'next_7',
    gamesPlayed: 3,
    goalieStats: {
      W: 2.1, SV: 82.5, GA: 7.5, GAA: 2.45, SV_PCT: 0.918, SO: 0.3,
    },
  },
  {
    playerId: 'pettersson-40',
    timeframe: 'next_7',
    gamesPlayed: 3,
    skaterStats: {
      G: 1.0, A: 1.8, PTS: 2.8, plusMinus: 0, PPP: 1.2,
      SOG: 9.6, HIT: 2.4, BLK: 1.2, PIM: 1,
    },
  },
  {
    playerId: 'boeser-6',
    timeframe: 'next_7',
    gamesPlayed: 3,
    skaterStats: {
      G: 1.1, A: 1.2, PTS: 2.3, plusMinus: 1, PPP: 0.9,
      SOG: 10.2, HIT: 1.8, BLK: 0.6, PIM: 0,
    },
  },
];

// My team (first 7 players)
export const myTeam = mockPlayers.slice(0, 7);

// Free agents (remaining players)
export const freeAgents = mockPlayers.slice(7);