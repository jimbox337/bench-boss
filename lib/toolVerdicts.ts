// Plain-language calls for the fantasy tools, from projected fantasy points.

export type Tone = 'win' | 'loss' | 'even';

/** Trade call from my share (0–1) of the combined projected value. */
export function tradeVerdict(share: number): { title: string; tone: Tone } {
  if (share >= 0.62) return { title: "You're robbing them!", tone: 'win' };
  if (share >= 0.53) return { title: 'You win this trade', tone: 'win' };
  if (share > 0.47) return { title: 'Fair trade', tone: 'even' };
  if (share > 0.38) return { title: 'They win this trade', tone: 'loss' };
  return { title: 'They are robbing you!', tone: 'loss' };
}

export type StartSitConfidence = 'Easy call' | 'Lean' | 'Coin flip';

/** Who to start among compared players, and how clear the call is (gap to the runner-up). */
export function startSitCall(players: { id: string; fpts: number | null }[]): { winnerId: string; confidence: StartSitConfidence; gap: number } | null {
  const ranked = players.filter((p) => p.fpts !== null).sort((a, b) => (b.fpts ?? 0) - (a.fpts ?? 0));
  if (ranked.length < 2) return null;
  const [best, next] = ranked;
  const gap = (best.fpts ?? 0) - (next.fpts ?? 0);
  const relative = (best.fpts ?? 0) > 0 ? gap / (best.fpts ?? 1) : 0;
  const confidence: StartSitConfidence = relative >= 0.25 ? 'Easy call' : relative >= 0.08 ? 'Lean' : 'Coin flip';
  return { winnerId: best.id, confidence, gap };
}
