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


def test_week_loss_is_poisson_nll_on_weekly_totals():
    log_rate = torch.log(torch.tensor([[0.5], [1.0], [2.0]]))
    y = torch.tensor([[1.0], [0.0], [3.0]])
    group = torch.tensor([0, 0, 1])
    got = float(neural._week_loss(torch, log_rate, y, torch.ones(1), group, 2))
    want = ((1.5 - 1 * math.log(1.5)) + (2.0 - 3 * math.log(2.0))) / 2
    assert math.isclose(got, want, rel_tol=1e-6)


def test_weekly_training_learns_and_runs_isolated():
    train, valid = frame(6000, 1), frame(2000, 2)
    for f in (train, valid):
        f[neural.GROUP] = np.arange(len(f)) // 3  # three games per player-week
    model = neural.train_network(train, valid, seed=3, loss="week")
    assert model["loss"] == "week" and min(model["validationLoss"]) < model["validationLoss"][0] + 1e-9
    base_mae = float(np.mean(np.abs(valid["goals"] - valid["shr_goals"])))
    assert float(np.mean(np.abs(valid["goals"] - neural.predict_network(model, valid)[:, 0]))) < base_mae
    result = neural.run_isolated(train, valid, pd.concat([train, valid]), {"validation": valid}, seed=3,
                                 export_sample="validation", loss="week")
    assert result["loss"] == "week" and result["predictions"]["validation"].shape == (2000, len(SKATER_TARGETS))
    with pytest.raises(ValueError):
        neural.train_network(train, None, seed=3, epochs=1, loss="season")


def test_calibration_is_folded_into_the_exported_bias():
    train = frame(2000, 4)
    model = neural.train_network(train, None, seed=9, epochs=2, dropout=0.0)
    assert model["dropout"] == 0.0
    export = neural.export_network(model, train, n_parity=4)
    factors = [1.1, 0.9, 1.0, 1.25, 1.05, 0.8]
    calibrated = neural.calibrate_export(export, factors)
    assert calibrated["calibration"] == factors and "calibration" not in export
    for raw, cal in zip(export["parity"], calibrated["parity"]):
        got = numpy_forward(calibrated, cal["x"], cal["offset"])
        for a, y, c in zip(got, raw["y"], factors):
            assert math.isclose(a, y * c, rel_tol=1e-4)


def test_recency_weights_halve_per_season_and_train():
    f = pd.DataFrame({"season": ["20212022", "20222023", "20232024"]})
    np.testing.assert_allclose(neural.recency_weights(f, 1.0), [0.25, 0.5, 1.0])
    assert neural.recency_weights(f, None) is None
    train, valid = frame(4000, 1), frame(1000, 2)
    train["season"] = np.where(np.arange(len(train)) < 2000, "20222023", "20232024")
    model = neural.train_network(train, valid, seed=3, half_life=2.0)
    assert model["halfLife"] == 2.0 and min(model["validationLoss"]) < model["validationLoss"][0] + 1e-9
    log_rate, y = torch.zeros(4, 1), torch.tensor([[0.0], [2.0], [1.0], [1.0]])
    rw = torch.tensor([1.0, 1.0, 0.5, 0.5])
    group = torch.tensor([0, 0, 1, 1])
    got = float(neural._week_loss(torch, log_rate, y, torch.ones(1), group, 2, rw))
    want = (1.0 * (2 - 2 * math.log(2)) + 0.5 * (2 - 2 * math.log(2))) / 1.5
    assert math.isclose(got, want, rel_tol=1e-6)
