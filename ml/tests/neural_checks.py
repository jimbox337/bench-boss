"""BenchBoss AI (neural network) checks: starts at the shrunk baseline, learns, exports reproducible weights.

Run through tests/test_neural.py in a fresh interpreter: PyTorch and LightGBM must not share
a process on macOS (OpenMP conflict), and other test modules import LightGBM.
"""
import math

import numpy as np
import pandas as pd
import pytest

torch = pytest.importorskip("torch")

from benchboss_ml import neural  # noqa: E402
from benchboss_ml.features import SKATER_TARGETS  # noqa: E402


def frame(n: int, seed: int) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    data = {f: rng.normal(size=n) for f in neural.SKATER_FEATURES}
    data["std_toi"] = np.where(rng.random(n) < 0.1, np.nan, rng.normal(size=n))  # some missing values
    df = pd.DataFrame(data)
    for t in SKATER_TARGETS:
        df[f"shr_{t}"] = rng.uniform(0.1, 2.0, n)
        # True rate depends on one feature, so there is something to learn beyond the baseline.
        df[t] = rng.poisson(df[f"shr_{t}"] * np.exp(0.4 * np.tanh(df["home"])))
    return neural.add_inputs(df)


def numpy_forward(export: dict, x: list, offset: list) -> list[float]:
    p = export["preprocess"]
    v = np.array([np.nan if a is None else a for a in x], float)
    missing = np.isnan(v)
    h = np.clip((np.where(missing, p["median"], v) - np.array(p["mean"])) / np.array(p["std"]), -p["clip"], p["clip"])
    h = np.concatenate([h, missing[p["flagged"]].astype(float)])
    for i, layer in enumerate(export["layers"]):
        h = np.array(layer["weight"]) @ h + np.array(layer["bias"])
        if i < len(export["layers"]) - 1:
            h = np.maximum(h, 0)
    return list(np.exp(h + np.log(np.maximum(offset, 1e-3))))


def test_untrained_network_is_the_shrunk_baseline():
    train = frame(500, 1)
    prep = neural.Preprocess.fit(train, neural.NEURAL_FEATURES)
    net = neural.build_network(prep.transform(train).shape[1], seed=3).eval()
    preds = neural.predict_network({"net": net, "prep": prep}, train)
    np.testing.assert_allclose(preds, train[[f"shr_{t}" for t in SKATER_TARGETS]].to_numpy(), rtol=1e-5)


def test_training_improves_validation_loss_and_export_matches():
    train, valid = frame(6000, 1), frame(2000, 2)
    model = neural.train_network(train, valid, seed=3)
    assert model["bestEpoch"] >= 1
    assert min(model["validationLoss"]) < model["validationLoss"][0] + 1e-9
    base_mae = float(np.mean(np.abs(valid["goals"] - valid["shr_goals"])))
    pred = neural.predict_network(model, valid)
    assert float(np.mean(np.abs(valid["goals"] - pred[:, 0]))) < base_mae
    export = neural.export_network(model, valid, n_parity=10)
    for sample in export["parity"]:
        got = numpy_forward(export, sample["x"], sample["offset"])
        for a, b in zip(got, sample["y"]):
            assert math.isclose(a, b, rel_tol=1e-4)


def test_same_seed_same_weights():
    train = frame(2000, 5)
    a = neural.export_network(neural.train_network(train, None, seed=9, epochs=2), train, n_parity=3)
    b = neural.export_network(neural.train_network(train, None, seed=9, epochs=2), train, n_parity=3)
    assert a["layers"][0]["weight"] == b["layers"][0]["weight"]


def test_isolated_run():
    """The child-process path train.py uses: predictions per frame plus the exported network."""
    train, valid = frame(3000, 1), frame(1000, 2)
    result = neural.run_isolated(train, valid, pd.concat([train, valid]), {"validation": valid, "live": valid}, seed=3, export_sample="validation")
    assert result["predictions"]["validation"].shape == (1000, len(SKATER_TARGETS))
    assert result["export"]["parity"] and result["bestEpoch"] >= 1
