/** Mirrors skater_baseline / player_prior / current_season_blend / shrunk_baseline in features.py. */

export type ShrinkReference = { perMinute: Record<string, number>; toi: Record<string, number> };
const PRIOR_GAMES = 20;
const finite = (v: number | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

/** Production blend: 45/25/20/10 over existing windows, else last season, else position mean. */
export function productionBaseline(f: Record<string, number>, stat: string, position: string, fallback: Record<string, number>): number {
  const parts: [number | undefined, number][] = [[f[`std_${stat}`], 0.45], [f[`l20_${stat}`], 0.25], [f[`l10_${stat}`], 0.2], [f[`l5_${stat}`], 0.1]];
  const present = parts.filter(([v]) => finite(v)) as [number, number][];
  if (present.length) return present.reduce((s, [v, w]) => s + v * w, 0) / present.reduce((s, [, w]) => s + w, 0);
  if (finite(f[`prev_${stat}`])) return f[`prev_${stat}`];
  return fallback[position] ?? 0;
}

export function playerPrior(f: Record<string, number>, stat: string, position: string, ref: ShrinkReference): number {
  const toi = finite(f.l10_toi) ? f.l10_toi : finite(f.prev_toi) ? f.prev_toi : ref.toi[position];
  const toiPrior = (ref.perMinute[position] ?? 0) * (toi ?? 0);
  const prevGp = finite(f.prev_gp) ? f.prev_gp : 0;
  const prev = finite(f[`prev_${stat}`]) ? f[`prev_${stat}`] : 0;
  return (prevGp * prev + PRIOR_GAMES * toiPrior) / (prevGp + PRIOR_GAMES);
}

function currentSeasonBlend(f: Record<string, number>, stat: string, seasonWeight: number): number {
  const parts: [number | undefined, number][] = [[f[`std_${stat}`], seasonWeight], [f[`l20_${stat}`], 0.25], [f[`l10_${stat}`], 0.2], [f[`l5_${stat}`], 0.1]];
  const present = parts.filter(([v]) => finite(v)) as [number, number][];
  const total = present.reduce((s, [, w]) => s + w, 0);
  return present.length && total > 0 ? present.reduce((s, [v, w]) => s + v * w, 0) / total : NaN;
}

export type ShrinkParams = { k: number; priorWeight: number; seasonWeight: number; reference: ShrinkReference };

export function shrunkBaseline(f: Record<string, number>, stat: string, position: string, params: ShrinkParams): number {
  const prior = playerPrior(f, stat, position, params.reference);
  const gp = finite(f.std_gp) ? f.std_gp : 0;
  const blendRaw = currentSeasonBlend(f, stat, params.seasonWeight);
  const blend = Number.isFinite(blendRaw) ? blendRaw : prior;
  const inner = (gp * blend + params.k * prior) / (gp + params.k);
  const value = params.priorWeight * prior + (1 - params.priorWeight) * inner;
  return Number.isFinite(value) ? Math.max(value, 0) : 0;
}
