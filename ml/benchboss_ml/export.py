"""Convert LightGBM boosters into a compact JSON tree format evaluated by lib/model/gbdt.ts.

Per tree:
  f: split feature index per internal node      t: threshold per internal node
  l/r: child index; >= 0 internal node, < 0 leaf (~leafIndex)
  d: 1 when missing values go left              m: missing type (0 None, 1 Zero, 2 NaN)
  v: leaf values (raw score)
Raw scores are summed over trees; poisson -> exp(raw), binary -> sigmoid(raw).

`parity` holds sample feature vectors and LightGBM's own predictions so the TypeScript
evaluator is tested against the reference implementation.
"""
from __future__ import annotations

import math
from typing import Any

import lightgbm as lgb
import numpy as np
import pandas as pd

MISSING_TYPES = {"None": 0, "Zero": 1, "NaN": 2}


def _round(value: float, digits: int = 8) -> float:
    if value == 0 or not math.isfinite(value):
        return value
    return float(f"{value:.{digits}g}")


def _compact_tree(structure: dict[str, Any]) -> dict[str, list]:
    tree = {"f": [], "t": [], "l": [], "r": [], "d": [], "m": [], "v": []}
    if "leaf_value" in structure and "split_feature" not in structure:
        tree["v"].append(_round(structure["leaf_value"]))
        return tree

    def visit(node: dict[str, Any]) -> int:
        if "split_feature" not in node:
            tree["v"].append(_round(node["leaf_value"]))
            return ~(len(tree["v"]) - 1)
        if node.get("decision_type", "<=") != "<=":
            raise ValueError("Only numerical '<=' splits are supported by the TypeScript evaluator")
        index = len(tree["f"])
        tree["f"].append(int(node["split_feature"]))
        tree["t"].append(float(node["threshold"]))
        tree["d"].append(1 if node.get("default_left", True) else 0)
        tree["m"].append(MISSING_TYPES[node.get("missing_type", "None")])
        tree["l"].append(0)
        tree["r"].append(0)
        tree["l"][index] = visit(node["left_child"])
        tree["r"][index] = visit(node["right_child"])
        return index

    visit(structure)
    return tree


def compact_booster(booster: lgb.Booster, features: tuple[str, ...], sample: pd.DataFrame, n_parity: int = 25) -> dict[str, Any]:
    dump = booster.dump_model()
    if dump["feature_names"] != list(features):
        raise ValueError("Booster feature order does not match the feature schema")
    objective = str(dump.get("objective", "regression")).split()[0]
    trees = [_compact_tree(info["tree_structure"]) for info in dump["tree_info"]]
    rows = sample[list(features)].sample(n=min(n_parity, len(sample)), random_state=11)
    predictions = booster.predict(rows)
    parity = [
        {"x": [None if (v is None or (isinstance(v, float) and math.isnan(v))) else float(v) for v in row], "y": float(y)}
        for row, y in zip(rows.to_numpy(dtype=float).tolist(), np.asarray(predictions).tolist())
    ]
    return {"objective": objective, "trees": trees, "parity": parity}
