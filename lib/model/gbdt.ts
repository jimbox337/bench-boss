/** Evaluator for the compact LightGBM tree format written by ml/benchboss_ml/export.py. */

export type CompactTree = { f: number[]; t: number[]; l: number[]; r: number[]; d: number[]; m: number[]; v: number[] };
export type CompactBooster = { objective: string; trees: CompactTree[]; parity?: { x: (number | null)[]; y: number }[] };

const ZERO_THRESHOLD = 1e-35;

/** Mirrors LightGBM's NumericalDecision, including missing-value routing. */
function leafValue(tree: CompactTree, x: ArrayLike<number>): number {
  if (tree.f.length === 0) return tree.v[0] ?? 0;
  let node = 0;
  for (;;) {
    let value = x[tree.f[node]];
    const missing = tree.m[node];
    if (Number.isNaN(value) && missing !== 2) value = 0;
    const toDefault = (missing === 1 && Math.abs(value) <= ZERO_THRESHOLD) || (missing === 2 && Number.isNaN(value));
    const next = toDefault ? (tree.d[node] === 1 ? tree.l[node] : tree.r[node]) : value <= tree.t[node] ? tree.l[node] : tree.r[node];
    if (next < 0) return tree.v[~next];
    node = next;
  }
}

export function rawScore(booster: CompactBooster, x: ArrayLike<number>): number {
  let sum = 0;
  for (const tree of booster.trees) sum += leafValue(tree, x);
  return sum;
}

export function predict(booster: CompactBooster, x: ArrayLike<number>): number {
  const raw = rawScore(booster, x);
  if (booster.objective === 'poisson') return Math.exp(raw);
  if (booster.objective === 'binary') return 1 / (1 + Math.exp(-raw));
  return raw;
}

/** Dense vector in feature order; undefined/null/non-finite become NaN (LightGBM missing). */
export function toVector(names: string[], values: Record<string, number | null | undefined>): Float64Array {
  const out = new Float64Array(names.length);
  names.forEach((name, i) => {
    const v = values[name];
    out[i] = typeof v === 'number' && Number.isFinite(v) ? v : NaN;
  });
  return out;
}
