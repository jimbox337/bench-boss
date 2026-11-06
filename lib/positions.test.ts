import { describe, expect, it } from 'vitest';
import { displayPositions, hasPosition, normalizePosition } from './positions';
import { optimizeLineup, defaultLeagueSettings, type Player, type Projection } from './calculator';

describe('positions', () => {
  it('treats L/R and LW/RW as the same', () => {
    expect(normalizePosition('L')).toBe('LW');
    expect(hasPosition({ positions: ['R'] }, 'RW')).toBe(true);
    expect(hasPosition({ positions: ['RW'] }, 'R')).toBe(true);
    expect(hasPosition({ positions: ['C'] }, 'LW')).toBe(false);
    expect(hasPosition({ positions: [], isGoalie: true }, 'G')).toBe(true);
    expect(displayPositions(['L', 'C'])).toEqual(['LW', 'C']);
  });

  it('lets NHL-style wingers fill LW and RW lineup slots', () => {
    const player = (id: string, pos: string): Player => ({ id, name: id, nhlTeam: 'EDM', positions: [pos], isGoalie: false });
    const proj = (id: string, g: number): Projection => ({ playerId: id, timeframe: 'next_7', gamesPlayed: 3, skaterStats: { G: g, A: 0, PTS: g, plusMinus: 0, PPP: 0, SOG: 0, HIT: 0, BLK: 0, PIM: 0 } });
    const team = [player('l1', 'L'), player('r1', 'R')];
    const lineup = optimizeLineup(team, [proj('l1', 2), proj('r1', 2)], defaultLeagueSettings);
    const slotOf = (id: string) => lineup.activeRoster.find((s) => s.player?.id === id)?.slotType;
    expect(slotOf('l1')).toBe('LW');
    expect(slotOf('r1')).toBe('RW');
  });
});
