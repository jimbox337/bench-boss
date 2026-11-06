import math

import lightgbm as lgb
import numpy as np
import pandas as pd

from benchboss_ml.export import compact_booster


def evaluate(tree, x):
    """Reference walk of the compact format (mirrors LightGBM NumericalDecision)."""
    if not tree["f"]:
        return tree["v"][0]
    node = 0
    while True:
        value = x[tree["f"][node]]
        missing = tree["m"][node]
        if math.isnan(value) and missing != 2:
            value = 0.0
        if (missing == 1 and abs(value) <= 1e-35) or (missing == 2 and math.isnan(value)):
            nxt = tree["l"][node] if tree["d"][node] else tree["r"][node]
        else:
            nxt = tree["l"][node] if value <= tree["t"][node] else tree["r"][node]
        if nxt < 0:
            return tree["v"][~nxt]
        node = nxt


def test_compact_trees_reproduce_lightgbm_predictions_with_missing_values():
    rng = np.random.default_rng(3)
    x = pd.DataFrame({"a": rng.normal(size=3000), "b": rng.uniform(size=3000), "c": rng.integers(0, 3, 3000).astype(float)})
    x.loc[rng.uniform(size=3000) < 0.2, "a"] = np.nan
    y = rng.poisson(np.exp(0.3 * np.nan_to_num(x["a"]) + x["b"]))
    booster = lgb.train({"objective": "poisson", "num_leaves": 7, "verbose": -1, "seed": 1}, lgb.Dataset(x, y), 40)
    compact = compact_booster(booster, ("a", "b", "c"), x)
    assert compact["objective"] == "poisson"
    for sample in compact["parity"]:
        row = [np.nan if v is None else v for v in sample["x"]]
        prediction = math.exp(sum(evaluate(tree, row) for tree in compact["trees"]))
        assert math.isclose(prediction, sample["y"], rel_tol=1e-6)
