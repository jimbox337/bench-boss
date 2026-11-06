/**
 * Forward pass of the neural challenger (ml/benchboss_ml/neural.py) from exported weights.
 * Plain arithmetic, no ML runtime: impute → standardise → clip → missing flags → dense
 * ReLU layers → six log-rates, each offset by log(shrunk baseline). Parity samples in the
 * artifact check this against PyTorch.
 */

export type NeuralArtifact = {
  targets: string[];
  activation: 'relu';
  preprocess: { features: string[]; median: number[]; mean: number[]; std: number[]; flagged: number[]; clip: number };
  layers: { weight: number[][]; bias: number[] }[];
  /** Per stat: stack weights over 'baseline', 'shrunk', booster components and 'neural'. */
  stack: Record<string, Record<string, number>>;
  blendWithProductionBaseline: number;
  /** True only if the challenger passed its promotion gate on validation and test. */
  promoted: boolean;
  bestEpoch?: number;
  parity?: { x: (number | null)[]; offset: (number | null)[]; y: number[] }[];
};

const MIN_RATE = 1e-3;

/** Expected per-game value of each target stat (artifact.targets order). */
export function neuralForward(net: NeuralArtifact, x: ArrayLike<number>, offsets: ArrayLike<number>): number[] {
  const p = net.preprocess;
  let h: number[] = [];
  for (let i = 0; i < p.features.length; i++) {
    const v = Number.isFinite(x[i]) ? x[i] : p.median[i];
    h.push(Math.min(p.clip, Math.max(-p.clip, (v - p.mean[i]) / p.std[i])));
  }
  for (const i of p.flagged) h.push(Number.isFinite(x[i]) ? 0 : 1);
  net.layers.forEach((layer, l) => {
    const out = new Array<number>(layer.bias.length);
    for (let j = 0; j < layer.bias.length; j++) {
      const w = layer.weight[j];
      let sum = layer.bias[j];
      for (let k = 0; k < h.length; k++) sum += w[k] * h[k];
      out[j] = l < net.layers.length - 1 ? Math.max(0, sum) : sum;
    }
    h = out;
  });
  return h.map((eta, j) => Math.exp(eta + Math.log(Math.max(Number.isFinite(offsets[j]) ? offsets[j] : MIN_RATE, MIN_RATE))));
}
