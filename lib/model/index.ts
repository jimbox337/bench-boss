import type { Player, Projection } from '../calculator';

export type ProjectionSources = {
  model: (players: Player[]) => Promise<Projection[]>;
  baseline: (players: Player[]) => Promise<Projection[]>;
  timeoutMs?: number;
  log?: (message: string, error?: unknown) => void;
};

/**
 * Model projections where available, schedule-aware baseline for everyone else. The model is
 * optional: an error, a timeout or an ineligible artifact returns the baseline unchanged.
 */
export async function combineProjections(players: Player[], sources: ProjectionSources): Promise<Projection[]> {
  const baseline = (await sources.baseline(players)).map(p => ({ ...p, source: p.source ?? ('baseline' as const) }));
  let model: Projection[] = [];
  try {
    model = await Promise.race([
      sources.model(players),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('model projection timed out')), sources.timeoutMs ?? 20_000)),
    ]);
  } catch (error) {
    sources.log?.('Model projections unavailable; using the schedule-aware baseline.', error);
    return baseline;
  }
  const byId = new Map(model.map(p => [p.playerId, p]));
  const merged = baseline.map(p => byId.get(p.playerId) ?? p);
  const known = new Set(merged.map(p => p.playerId));
  return [...merged, ...model.filter(p => !known.has(p.playerId))];
}

let cache: { at: number; key: string; value: Projection[] } | null = null;
const CACHE_MS = 30 * 60 * 1000;

/** Server-side model projections from the committed artifact (if it passed the promotion gate). */
export async function modelProjections(players: Player[]): Promise<Projection[]> {
  const key = `${players.length}`;
  if (cache && cache.key === key && Date.now() - cache.at < CACHE_MS) return cache.value;
  const [{ default: artifact }, { loadRuntimeData }, { projectAll }, { getCurrentNHLSeason }] = await Promise.all([
    import('./artifacts/bench-boss-model.json'),
    import('./runtimeData'),
    import('./project'),
    import('../nhlSeason'),
  ]);
  const typed = artifact as unknown as import('./project').ModelArtifact;
  if (!typed.promotion?.eligible) throw new Error(`Artifact ${typed.modelVersion} did not pass the promotion gate`);
  const data = await loadRuntimeData(await getCurrentNHLSeason());
  const value = projectAll(players, typed, data);
  if (value.length === 0) throw new Error('Model produced no projections');
  cache = { at: Date.now(), key, value };
  return value;
}
