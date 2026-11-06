import { describe, expect, it } from 'vitest';
import { startSitCall, tradeVerdict } from './toolVerdicts';

describe('tradeVerdict', () => {
  it('maps value share to a call', () => {
    expect(tradeVerdict(0.7)).toEqual({ title: "You're robbing them!", tone: 'win' });
    expect(tradeVerdict(0.55).title).toBe('You win this trade');
    expect(tradeVerdict(0.5)).toEqual({ title: 'Fair trade', tone: 'even' });
    expect(tradeVerdict(0.45).title).toBe('They win this trade');
    expect(tradeVerdict(0.2)).toEqual({ title: 'They are robbing you!', tone: 'loss' });
  });
});

describe('startSitCall', () => {
  it('picks the higher projection and grades the gap', () => {
    expect(startSitCall([{ id: 'a', fpts: 6 }, { id: 'b', fpts: 10 }])).toMatchObject({ winnerId: 'b', confidence: 'Easy call' });
    expect(startSitCall([{ id: 'a', fpts: 9 }, { id: 'b', fpts: 10 }])).toMatchObject({ winnerId: 'b', confidence: 'Lean' });
    expect(startSitCall([{ id: 'a', fpts: 9.8 }, { id: 'b', fpts: 10 }])).toMatchObject({ confidence: 'Coin flip' });
  });

  it('needs two players with projections', () => {
    expect(startSitCall([{ id: 'a', fpts: 5 }, { id: 'b', fpts: null }])).toBeNull();
  });
});
