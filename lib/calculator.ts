// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Player {
  id: string;
  name: string;
  nhlTeam: string;
  positions: string[]; // ['C', 'LW'], ['D'], etc.
  isGoalie: boolean;
  seasonStats?: SkaterStats; // Actual season stats
  gamesPlayed?: number; // Games played this season
}

export interface SkaterStats {
  G: number;    // Goals
  A: number;    // Assists
  PTS: number;  // Points (usually G + A)
  plusMinus: number;
  PPP: number;  // Power Play Points
  SOG: number;  // Shots on Goal
  HIT: number;  // Hits
  BLK: number;  // Blocks
  PIM: number;  // Penalty Minutes
}

export interface GoalieStats {
  W: number;       // Wins
  SV: number;      // Saves
  GA: number;      // Goals Against
  GAA: number;     // Goals Against Average
  SV_PCT: number;  // Save Percentage (0-1, e.g., 0.915)
  SO: number;      // Shutouts
}

export interface Projection {
  playerId: string;
  timeframe: 'per_game' | 'next_7' | 'next_14' | 'rest_of_season';
  skaterStats?: SkaterStats;
  goalieStats?: GoalieStats;
  gamesPlayed: number;
}

export interface LeagueSettings {
  scoringType: 'H2H_Categories' | 'H2H_Points';
  
  // For category leagues
  skaterCategories?: (keyof SkaterStats)[];
  goalieCategories?: (keyof GoalieStats)[];
  
  // For points leagues
  pointsPerStat?: {
    [key: string]: number; // e.g., { G: 3, A: 2, SOG: 0.2 }
  };
  
  rosterSlots: {
    C: number;
    LW: number;
    RW: number;
    D: number;
    G: number;
    UTIL?: number; // Utility - any skater
    BN: number;    // Bench
    IR?: number;   // Injured Reserve
  };
}

export interface RosterSlot {
  slotType: 'C' | 'LW' | 'RW' | 'D' | 'G' | 'UTIL' | 'BN' | 'IR';
  player: Player | null;
  projection?: Projection;
}

// ============================================================================
// FANTASY POINTS CALCULATOR
// ============================================================================

export function calculateFantasyPoints(
  projection: Projection,
  settings: LeagueSettings
): number {
  if (settings.scoringType !== 'H2H_Points' || !settings.pointsPerStat) {
    throw new Error('Fantasy points calculation requires H2H_Points scoring type');
  }

  let points = 0;
  const weights = settings.pointsPerStat;

  if (projection.skaterStats) {
    const stats = projection.skaterStats;
    points += (stats.G || 0) * (weights.G || 0);
    points += (stats.A || 0) * (weights.A || 0);
    points += (stats.PTS || 0) * (weights.PTS || 0);
    points += (stats.plusMinus || 0) * (weights.plusMinus || 0);
    points += (stats.PPP || 0) * (weights.PPP || 0);
    points += (stats.SOG || 0) * (weights.SOG || 0);
    points += (stats.HIT || 0) * (weights.HIT || 0);
    points += (stats.BLK || 0) * (weights.BLK || 0);
    points += (stats.PIM || 0) * (weights.PIM || 0);
  }

  if (projection.goalieStats) {
    const stats = projection.goalieStats;
    points += (stats.W || 0) * (weights.W || 0);
    points += (stats.SV || 0) * (weights.SV || 0);
    points += (stats.GA || 0) * (weights.GA || 0);
    points += (stats.GAA || 0) * (weights.GAA || 0);
    points += (stats.SO || 0) * (weights.SO || 0);
  }

  return Math.round(points * 10) / 10;
}

// ============================================================================
// CATEGORY SCORE NORMALIZER
// ============================================================================

function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

function calculateStats(values: number[]): { mean: number; stdDev: number } {
  if (values.length === 0) {
    return { mean: 0, stdDev: 0 };
  }
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  return { mean, stdDev };
}

export function calculateCategoryScore(
  projection: Projection,
  allProjections: Projection[],
  settings: LeagueSettings
): number {
  if (settings.scoringType !== 'H2H_Categories') {
    throw new Error('Category scoring only works for H2H_Categories leagues');
  }

  let totalZScore = 0;
  let categoryCount = 0;

  if (projection.skaterStats && settings.skaterCategories) {
    for (const category of settings.skaterCategories) {
      const values = allProjections
        .filter(p => p.skaterStats)
        .map(p => p.skaterStats![category] as number);

      if (values.length === 0) continue;

      const { mean, stdDev } = calculateStats(values);
      const playerValue = projection.skaterStats[category] as number;
      const zScore = calculateZScore(playerValue, mean, stdDev);

      // For skaters, lower is better for PIM (penalty minutes)
      const invertedStats = ['PIM'];
      totalZScore += invertedStats.includes(category) ? -zScore : zScore;
      categoryCount++;
    }
  }

  if (projection.goalieStats && settings.goalieCategories) {
    for (const category of settings.goalieCategories) {
      const values = allProjections
        .filter(p => p.goalieStats)
        .map(p => p.goalieStats![category] as number);

      if (values.length === 0) continue;

      const { mean, stdDev } = calculateStats(values);
      const playerValue = projection.goalieStats[category] as number;
      const zScore = calculateZScore(playerValue, mean, stdDev);

      // For goalies, lower is better for GAA and GA
      const invertedStats = ['GAA', 'GA'];
      totalZScore += invertedStats.includes(category) ? -zScore : zScore;
      categoryCount++;
    }
  }

  return categoryCount > 0 ? totalZScore / categoryCount : 0;
}

// ============================================================================
// LINEUP OPTIMIZER
// ============================================================================

interface OptimizedLineup {
  activeRoster: RosterSlot[];
  bench: RosterSlot[];
  totalProjectedPoints?: number;
  totalCategoryScore?: number;
}

export function optimizeLineup(
  players: Player[],
  projections: Projection[],
  settings: LeagueSettings
): OptimizedLineup {
  const projMap = new Map(projections.map(p => [p.playerId, p]));
  
  const playerValues = players.map(player => {
    const proj = projMap.get(player.id);
    if (!proj) return { player, value: 0, projection: undefined };
    
    const value = settings.scoringType === 'H2H_Points'
      ? calculateFantasyPoints(proj, settings)
      : calculateCategoryScore(proj, projections, settings);
    
    return { player, value, projection: proj };
  });

  playerValues.sort((a, b) => b.value - a.value);

  const activeRoster: RosterSlot[] = [];
  const bench: RosterSlot[] = [];
  const usedPlayers = new Set<string>();

  const slotsRemaining = {
    C: settings.rosterSlots.C,
    LW: settings.rosterSlots.LW,
    RW: settings.rosterSlots.RW,
    D: settings.rosterSlots.D,
    G: settings.rosterSlots.G,
    UTIL: settings.rosterSlots.UTIL ?? 0,
    BN: settings.rosterSlots.BN,
    IR: settings.rosterSlots.IR ?? 0,
  };

  const canFillSlot = (player: Player, slotType: string): boolean => {
    if (slotType === 'G') return player.isGoalie;
    if (slotType === 'UTIL') return !player.isGoalie;
    if (slotType === 'BN' || slotType === 'IR') return true;
    return player.positions.includes(slotType);
  };

  const positionOrder: ('C' | 'LW' | 'RW' | 'D' | 'G' | 'UTIL')[] = ['C', 'LW', 'RW', 'D', 'G'];
  if (settings.rosterSlots.UTIL) positionOrder.push('UTIL');

  for (const position of positionOrder) {
    while (slotsRemaining[position] > 0) {
      const nextPlayer = playerValues.find(
        pv => !usedPlayers.has(pv.player.id) && canFillSlot(pv.player, position)
      );

      if (!nextPlayer) break;

      activeRoster.push({
        slotType: position,
        player: nextPlayer.player,
        projection: nextPlayer.projection,
      });

      usedPlayers.add(nextPlayer.player.id);
      slotsRemaining[position]--;
    }
  }

  for (const pv of playerValues) {
    if (!usedPlayers.has(pv.player.id) && slotsRemaining.BN > 0) {
      bench.push({
        slotType: 'BN',
        player: pv.player,
        projection: pv.projection,
      });
      slotsRemaining.BN--;
    }
  }

  const result: OptimizedLineup = { activeRoster, bench };

  if (settings.scoringType === 'H2H_Points') {
    result.totalProjectedPoints = activeRoster.reduce((sum, slot) => {
      return sum + (slot.projection ? calculateFantasyPoints(slot.projection, settings) : 0);
    }, 0);
  } else {
    result.totalCategoryScore = activeRoster.reduce((sum, slot) => {
      return sum + (slot.projection ? calculateCategoryScore(slot.projection, projections, settings) : 0);
    }, 0);
  }

  return result;
}

// ============================================================================
// TRADE ANALYZER
// ============================================================================

interface TradeAnalysis {
  netGain: number;
  verdict: 'Win' | 'Fair' | 'Loss';
  categoryImpacts?: { [category: string]: number };
  summary: string;
}

export function analyzeTrade(
  playersOut: Player[],
  playersIn: Player[],
  projections: Projection[],
  settings: LeagueSettings,
  winThreshold: number = 5,
): TradeAnalysis {
  const projMap = new Map(projections.map(p => [p.playerId, p]));

  const calculateTotal = (players: Player[]): number => {
    return players.reduce((sum, player) => {
      const proj = projMap.get(player.id);
      if (!proj) return sum;
      
      return sum + (settings.scoringType === 'H2H_Points'
        ? calculateFantasyPoints(proj, settings)
        : calculateCategoryScore(proj, projections, settings));
    }, 0);
  };

  const valueOut = calculateTotal(playersOut);
  const valueIn = calculateTotal(playersIn);
  const netGain = valueIn - valueOut;

  let verdict: 'Win' | 'Fair' | 'Loss';
  if (netGain > winThreshold) verdict = 'Win';
  else if (netGain < -winThreshold) verdict = 'Loss';
  else verdict = 'Fair';

  let categoryImpacts: { [category: string]: number } | undefined;
  if (settings.scoringType === 'H2H_Categories' && settings.skaterCategories) {
    categoryImpacts = {};
    
    for (const category of settings.skaterCategories) {
      const outTotal = playersOut.reduce((sum, p) => {
        const proj = projMap.get(p.id);
        return sum + (proj?.skaterStats?.[category] as number || 0);
      }, 0);
      
      const inTotal = playersIn.reduce((sum, p) => {
        const proj = projMap.get(p.id);
        return sum + (proj?.skaterStats?.[category] as number || 0);
      }, 0);
      
      categoryImpacts[category] = inTotal - outTotal;
    }
  }

  const summary = settings.scoringType === 'H2H_Points'
    ? `You ${verdict === 'Win' ? 'gain' : verdict === 'Loss' ? 'lose' : 'break even with'} ${Math.abs(netGain).toFixed(1)} projected points.`
    : `Overall ${verdict.toLowerCase()} with a net z-score change of ${netGain > 0 ? '+' : ''}${netGain.toFixed(2)}.`;

  return { netGain, verdict, categoryImpacts, summary };
}

// ============================================================================
// WAIVER WIRE RANKER
// ============================================================================

interface WaiverTarget {
  player: Player;
  projection: Projection;
  value: number;
  reasoning: string;
}

export function rankWaiverTargets(
  availablePlayers: Player[],
  projections: Projection[],
  settings: LeagueSettings,
  myTeamProjections?: Projection[],
  fillWeaknesses: boolean = false,
): WaiverTarget[] {
  const projMap = new Map(projections.map(p => [p.playerId, p]));

  const targets: WaiverTarget[] = availablePlayers
    .map(player => {
      const proj = projMap.get(player.id);
      if (!proj) return null;

      let value = settings.scoringType === 'H2H_Points'
        ? calculateFantasyPoints(proj, settings)
        : calculateCategoryScore(proj, projections, settings);

      let reasoning = `${proj.gamesPlayed} games`;
      if (proj.skaterStats) {
        const topStats: string[] = [];
        if (proj.skaterStats.G > 1) topStats.push('Goals');
        if (proj.skaterStats.SOG > 10) topStats.push('SOG');
        if (proj.skaterStats.HIT > 8) topStats.push('Hits');
        if (proj.skaterStats.PPP > 1) topStats.push('PPP');
        reasoning += topStats.length > 0 ? `, strong in ${topStats.join(', ')}` : '';
      }

      return { player, projection: proj, value, reasoning };
    })
    .filter((t): t is WaiverTarget => t !== null);

  targets.sort((a, b) => b.value - a.value);

  return targets;
}

export const defaultLeagueSettings: LeagueSettings = {
  scoringType: 'H2H_Points',
  pointsPerStat: {
    G: 2,
    A: 1,
    PPP: 1,
    SOG: 0.1,
    HIT: 0.1,
    BLK: 0.5,
    W: 2,
    SV: 0.1,
    SO: 5,
    GA: -1,
  },
  rosterSlots: {
    C: 2,
    LW: 2,
    RW: 2,
    D: 4,
    G: 2,
    UTIL: 1,
    BN: 4,
    IR: 2,
  },
};