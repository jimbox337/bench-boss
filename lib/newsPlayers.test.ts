import { describe, expect, it } from 'vitest';
import { playersInText } from './newsPlayers';

const players = [
  { name: 'Connor McDavid' },
  { name: 'Leon Draisaitl' },
  { name: 'Ivan Demidov' },
  { name: 'Tim Stützle' },
  { name: 'Jack Hughes' },
  { name: 'Quinn Hughes' },
];

describe('playersInText', () => {
  it('finds full names in order of mention, with possessives and accents', () => {
    const text = "Leon Draisaitl and Connor McDavid's line; Tim Stutzle out.";
    expect(playersInText(text, players).map((p) => p.name)).toEqual(['Leon Draisaitl', 'Connor McDavid', 'Tim Stützle']);
  });

  it('ignores last names alone and partial words', () => {
    expect(playersInText('Hughes scores again; McDavidson signs', players)).toEqual([]);
  });

  it('respects the limit', () => {
    expect(playersInText('Connor McDavid, Leon Draisaitl, Ivan Demidov', players, 2)).toHaveLength(2);
  });
});
