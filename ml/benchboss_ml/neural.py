"""BenchBoss AI: one small multi-output neural network for the six skater stats.

Design (kept deliberately small so it trains on a laptop CPU and runs in the website):
  * inputs: the LightGBM skater features plus log(shrunk baseline) per stat; missing values
    are imputed with the training median and flagged with a 0/1 indicator; then standardised
  * two hidden ReLU layers with dropout and weight decay
  * six Poisson outputs, each offset by log(shrunk baseline) of that stat, with the last layer
    initialised at zero, so the untrained network *is* the shrunk baseline and training learns
    multipliers on it
  * loss: Poisson negative log-likelihood, each stat weighted by 1 / its training mean so
    shots and hits do not drown out goals and PP points; per game by default, or on each
    player-week's total (`loss="week"`, which needs a GROUP column and is only safe on
    week-start frames, where no input carries a result from earlier in the same week)
  * early stopping on the validation season; the test season is never used for any decision

`export_network` writes plain weights (no PyTorch needed at serving time) plus parity samples
so lib/model/neural.ts can check that it reproduces the PyTorch forward pass.
"""
from __future__ import annotations

import json
import math
import os
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from .features import SKATER_FEATURES, SKATER_TARGETS

HIDDEN = (128, 64)
DROPOUT = 0.1
WEIGHT_DECAY = 1e-4
LEARNING_RATE = 1e-3
BATCH = 2048
MAX_EPOCHS = 40
PATIENCE = 4
CLIP = 5.0  # standardised inputs are clipped to ±CLIP
MIN_RATE = 1e-3

GROUP = "_week_group"  # player-week id, for the weekly-total loss
OFFSET_COLUMNS = tuple(f"shr_{t}" for t in SKATER_TARGETS)
EXTRA_FEATURES = tuple(f"lshr_{t}" for t in SKATER_TARGETS)
NEURAL_FEATURES: tuple[str, ...] = tuple(SKATER_FEATURES) + EXTRA_FEATURES


def add_inputs(frame: pd.DataFrame) -> pd.DataFrame:
    """log(shrunk baseline) inputs; `shr_<stat>` columns must already exist."""
    return frame.assign(**{f"lshr_{t}": np.log(frame[f"shr_{t}"].clip(lower=MIN_RATE)) for t in SKATER_TARGETS})


@dataclass
class Preprocess:
    features: list[str]
    median: np.ndarray
    mean: np.ndarray
    std: np.ndarray
    flagged: list[int]  # feature indices that get a missing-value indicator

    @classmethod
    def fit(cls, frame: pd.DataFrame, features: tuple[str, ...]) -> "Preprocess":
        x = frame[list(features)].to_numpy(float)
        median = np.nanmedian(x, axis=0)
        median = np.where(np.isnan(median), 0.0, median)
        flagged = [i for i in range(x.shape[1]) if np.isnan(x[:, i]).any()]
        filled = np.where(np.isnan(x), median, x)
        mean, std = filled.mean(axis=0), filled.std(axis=0)
        std = np.where(std < 1e-9, 1.0, std)
        return cls(list(features), median, mean, std, flagged)

    def transform(self, frame: pd.DataFrame) -> np.ndarray:
        x = frame[self.features].to_numpy(float)
        missing = np.isnan(x)
        z = np.clip((np.where(missing, self.median, x) - self.mean) / self.std, -CLIP, CLIP)
        return np.concatenate([z, missing[:, self.flagged].astype(float)], axis=1).astype(np.float32)

    def to_json(self) -> dict[str, Any]:
        return {"features": self.features, "median": self.median.tolist(), "mean": self.mean.tolist(),
                "std": self.std.tolist(), "flagged": self.flagged, "clip": CLIP}


def forward_numpy(export: dict[str, Any], frame: pd.DataFrame) -> np.ndarray:
    """Exported-network forward pass without PyTorch (daily shadow predictions; mirrors
    lib/model/neural.ts). Shape (rows, 6) in export["targets"] order."""
    p = export["preprocess"]
    x = frame[p["features"]].to_numpy(float)
    missing = np.isnan(x)
    h = np.clip((np.where(missing, p["median"], x) - np.array(p["mean"])) / np.array(p["std"]), -p["clip"], p["clip"])
    h = np.concatenate([h, missing[:, p["flagged"]].astype(float)], axis=1)
    for i, layer in enumerate(export["layers"]):
        h = h @ np.array(layer["weight"]).T + np.array(layer["bias"])
        if i < len(export["layers"]) - 1:
            h = np.maximum(h, 0)
    offsets = np.log(frame[[f"shr_{t}" for t in export["targets"]]].clip(lower=MIN_RATE).to_numpy(float))
    return np.exp(h + offsets)


def _torch():
    import torch  # imported lazily so the rest of the pipeline works without PyTorch
    return torch


def build_network(n_in: int, seed: int):
    torch = _torch()
    nn = torch.nn
    torch.manual_seed(seed)
    layers: list[Any] = []
    width = n_in
    for h in HIDDEN:
        layers += [nn.Linear(width, h), nn.ReLU(), nn.Dropout(DROPOUT)]
        width = h
    head = nn.Linear(width, len(SKATER_TARGETS))
    nn.init.zeros_(head.weight)
    nn.init.zeros_(head.bias)
    layers.append(head)
    return nn.Sequential(*layers)


def _offsets(frame: pd.DataFrame) -> np.ndarray:
    return np.log(frame[list(OFFSET_COLUMNS)].clip(lower=MIN_RATE).to_numpy(float)).astype(np.float32)


def _targets(frame: pd.DataFrame) -> np.ndarray:
    return frame[list(SKATER_TARGETS)].to_numpy(float).astype(np.float32)


def _loss(torch, log_rate, y, weights):
    # Poisson NLL without the log(y!) constant: exp(eta) - y * eta.
    return ((torch.exp(log_rate) - y * log_rate) * weights).sum(dim=1).mean()


def _week_loss(torch, log_rate, y, weights, group, n_groups):
    # Poisson NLL on player-week totals: the expected total is the sum of per-game rates.
    mu = torch.zeros(n_groups, log_rate.shape[1]).index_add_(0, group, torch.exp(log_rate))
    total = torch.zeros(n_groups, log_rate.shape[1]).index_add_(0, group, y)
    return ((mu - total * torch.log(mu.clamp_min(1e-6))) * weights).sum(dim=1).mean()


def _dense_groups(frame: pd.DataFrame) -> np.ndarray:
    return pd.factorize(frame[GROUP].to_numpy())[0]


def train_network(train: pd.DataFrame, valid: pd.DataFrame | None, seed: int, epochs: int | None = None,
                  loss: str = "game") -> dict[str, Any]:
    """Fit on `train`; with `valid`, early-stop on its loss. With `epochs`, train exactly that many.
    `loss="week"` fits player-week totals; batches then hold whole player-weeks."""
    torch = _torch()
    torch.set_num_threads(4)
    prep = Preprocess.fit(train, NEURAL_FEATURES)
    x, off, y = (torch.from_numpy(a) for a in (prep.transform(train), _offsets(train), _targets(train)))
    weights = torch.from_numpy((1.0 / np.clip(_targets(train).mean(axis=0), 1e-3, None)).astype(np.float32))
    net = build_network(x.shape[1], seed)
    optimiser = torch.optim.AdamW(net.parameters(), lr=LEARNING_RATE, weight_decay=WEIGHT_DECAY)
    generator = torch.Generator().manual_seed(seed)
    if valid is not None:
        vx, voff, vy = (torch.from_numpy(a) for a in (prep.transform(valid), _offsets(valid), _targets(valid)))
    weekly = loss == "week"
    if weekly:
        groups = _dense_groups(train)
        by_group = np.argsort(groups, kind="stable")
        starts = np.r_[0, np.flatnonzero(np.diff(groups[by_group])) + 1]
        sizes = np.diff(np.r_[starts, len(by_group)])
        per_batch = max(1, int(BATCH / sizes.mean()))
        if valid is not None:
            vgroups = _dense_groups(valid)
            vgroup, n_vgroups = torch.from_numpy(vgroups), int(vgroups.max()) + 1
    elif loss != "game":
        raise ValueError(f"unknown loss {loss!r}")
    history: list[float] = []
    best_state, best_loss, best_epoch, stale = None, math.inf, 0, 0
    for epoch in range(1, (epochs or MAX_EPOCHS) + 1):
        net.train()
        if weekly:
            perm = torch.randperm(len(starts), generator=generator).numpy()
            for b in range(0, len(perm), per_batch):
                chosen = perm[b:b + per_batch]
                rows = np.concatenate([by_group[starts[g]:starts[g] + sizes[g]] for g in chosen])
                local = torch.from_numpy(np.repeat(np.arange(len(chosen)), sizes[chosen]))
                idx = torch.from_numpy(rows)
                optimiser.zero_grad()
                batch_loss = _week_loss(torch, net(x[idx]) + off[idx], y[idx], weights, local, len(chosen))
                batch_loss.backward()
                optimiser.step()
        else:
            order = torch.randperm(len(x), generator=generator)
            for start in range(0, len(x), BATCH):
                idx = order[start:start + BATCH]
                optimiser.zero_grad()
                batch_loss = _loss(torch, net(x[idx]) + off[idx], y[idx], weights)
                batch_loss.backward()
                optimiser.step()
        if valid is None:
            continue
        net.eval()
        with torch.no_grad():
            eta = net(vx) + voff
            v = float(_week_loss(torch, eta, vy, weights, vgroup, n_vgroups) if weekly else _loss(torch, eta, vy, weights))
        history.append(v)
        if v < best_loss - 1e-6:
            best_loss, best_epoch, stale = v, epoch, 0
            best_state = {k: t.clone() for k, t in net.state_dict().items()}
        else:
            stale += 1
            if stale >= PATIENCE:
                break
    if best_state is not None:
        net.load_state_dict(best_state)
    net.eval()
    return {"net": net, "prep": prep, "bestEpoch": best_epoch or (epochs or MAX_EPOCHS), "validationLoss": history,
            "lossWeights": weights.tolist(), "loss": loss}


def predict_network(model: dict[str, Any], frame: pd.DataFrame) -> np.ndarray:
    """Per-game expected value for each stat, shape (rows, 6) in SKATER_TARGETS order."""
    torch = _torch()
    with torch.no_grad():
        eta = model["net"](torch.from_numpy(model["prep"].transform(frame))) + torch.from_numpy(_offsets(frame))
    return np.exp(eta.numpy().astype(float))


def export_network(model: dict[str, Any], sample: pd.DataFrame, n_parity: int = 25, seed: int = 11) -> dict[str, Any]:
    linear = [m for m in model["net"] if m.__class__.__name__ == "Linear"]
    layers = [{"weight": np.round(m.weight.detach().numpy().astype(float), 8).tolist(),
               "bias": np.round(m.bias.detach().numpy().astype(float), 8).tolist()} for m in linear]
    rows = sample.sample(n=min(n_parity, len(sample)), random_state=seed)
    preds = predict_network(model, rows)
    clean = lambda v: None if v is None or (isinstance(v, float) and math.isnan(v)) else float(v)  # noqa: E731
    parity = [{"x": [clean(v) for v in r[list(NEURAL_FEATURES)].tolist()],
               "offset": [clean(v) for v in r[list(OFFSET_COLUMNS)].tolist()],
               "y": [float(v) for v in p]} for (_, r), p in zip(rows.iterrows(), preds)]
    return {"targets": list(SKATER_TARGETS), "activation": "relu", "offset": "log(shrunkBaseline)",
            "preprocess": model["prep"].to_json(), "layers": layers, "bestEpoch": int(model["bestEpoch"]),
            "parity": parity}


# ---------------------------------------------------------------------------------------
# Process isolation. LightGBM (Homebrew libomp) and PyTorch (its own OpenMP) deadlock or
# segfault when both run in one process on macOS, so training runs in a child process that
# never imports LightGBM. The parent exchanges parquet files with it.
# ---------------------------------------------------------------------------------------

COLUMNS = list(NEURAL_FEATURES) + list(OFFSET_COLUMNS) + list(SKATER_TARGETS)


def run_isolated(train: pd.DataFrame, valid: pd.DataFrame, full: pd.DataFrame, frames: dict[str, pd.DataFrame],
                 seed: int, export_sample: str = "test", loss: str = "game") -> dict[str, Any]:
    """Train (early stopping on `valid`), refit on `full` for the best epoch count, predict
    every frame (live with the refit, others with the train-only fit). Returns predictions,
    the exported network and the training history."""
    with tempfile.TemporaryDirectory(prefix="benchboss-neural-") as tmp:
        d = Path(tmp)
        fit_columns = COLUMNS + ([GROUP] if loss == "week" else [])
        train[fit_columns].to_parquet(d / "train.parquet")
        valid[fit_columns].to_parquet(d / "valid.parquet")
        full[fit_columns].to_parquet(d / "full.parquet")
        for name, frame in frames.items():
            frame[COLUMNS].reset_index(drop=True).to_parquet(d / f"frame_{name}.parquet")
        (d / "job.json").write_text(json.dumps({"seed": seed, "frames": list(frames), "exportSample": export_sample, "loss": loss}))
        env = {**os.environ, "PYTHONPATH": str(Path(__file__).resolve().parents[1])}
        subprocess.run([sys.executable, "-m", "benchboss_ml.neural", str(d)], check=True, env=env)
        result = json.loads((d / "result.json").read_text())
        result["predictions"] = {name: pd.read_parquet(d / f"pred_{name}.parquet").to_numpy(float) for name in frames}
    return result


def _child(directory: str) -> None:
    d = Path(directory)
    job = json.loads((d / "job.json").read_text())
    train, valid, full = (pd.read_parquet(d / f"{n}.parquet") for n in ("train", "valid", "full"))
    loss = job.get("loss", "game")
    model = train_network(train, valid, job["seed"], loss=loss)
    print(f"  BenchBoss AI: best epoch {model['bestEpoch']}; refitting on all completed seasons for export...", flush=True)
    export = train_network(full, None, job["seed"], epochs=model["bestEpoch"], loss=loss)
    frames = {name: pd.read_parquet(d / f"frame_{name}.parquet") for name in job["frames"]}
    for name, frame in frames.items():
        preds = predict_network(export if name.startswith("live") else model, frame)
        pd.DataFrame(preds, columns=list(SKATER_TARGETS)).to_parquet(d / f"pred_{name}.parquet")
    sample = frames.get(job["exportSample"], full)
    (d / "result.json").write_text(json.dumps({
        "export": export_network(export, sample), "bestEpoch": int(model["bestEpoch"]),
        "validationLoss": model["validationLoss"], "lossWeights": model["lossWeights"], "loss": loss,
    }))


if __name__ == "__main__":
    _child(sys.argv[1])
