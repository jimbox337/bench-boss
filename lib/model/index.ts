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

const cache = new Map<string, { at: number; value: Projection[] }>();
const CACHE_MS = 30 * 60 * 1000;
const CACHE_ENTRIES = 16;

/** Identifies a player set by id, team and goalie flag, independent of order. */
export function projectionCacheKey(players: Player[]): string {
  return players.map(p => `${p.id}:${p.nhlTeam}:${p.isGoalie ? 'G' : 'S'}`).sort().join(',');
}

/** Server-side model projections from the committed artifact (if it passed the promotion gate). */
export async function modelProjections(players: Player[]): Promise<Projection[]> {
  const key = `${process.env.BENCHBOSS_NEURAL === '1' ? 'neural|' : ''}${projectionCacheKey(players)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const [{ default: artifact }, { loadRuntimeData }, { projectAll }, { getCurrentNHLSeason }] = await Promise.all([
    import('./artifacts/bench-boss-model.json'),
    import('./runtimeData'),
    import('./project'),
    import('../nhlSeason'),
  ]);
  const typed = artifact as unknown as import('./project').ModelArtifact;
  if (!typed.promotion?.eligible) throw new Error(`Artifact ${typed.modelVersion} did not pass the promotion gate`);
  const data = await loadRuntimeData(await getCurrentNHLSeason());
  // Feature flag for the neural challenger; it is used only if its artifact also passed the gate.
  const neural = process.env.BENCHBOSS_NEURAL === '1';
  const value = projectAll(players, typed, data, { neural });
  if (value.length === 0) throw new Error('Model produced no projections');
  cache.delete(key);
  cache.set(key, { at: Date.now(), value });
  // Map keeps insertion order, so the first key is the least recently stored.
  while (cache.size > CACHE_ENTRIES) cache.delete(cache.keys().next().value as string);
  return value;
}
