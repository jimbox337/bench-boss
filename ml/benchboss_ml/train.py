"""Train, evaluate and export Bench Boss candidate models (offline only).

Time-based splits (never random):
  train      : all completed seasons before the validation season
  validation : second-to-last completed season (early stopping, selection, calibration)
  test       : last completed season (reported only; never used for any decision)
  live       : the in-progress season (unseen by every fit; checks the exported fit)

Skater candidates per statistic:
  baseline : the production schedule-aware blend (lib/projectionEngine.ts)
  direct   : LightGBM Poisson on all pre-game features
  residual : LightGBM Poisson with log(baseline) as init score and context/usage features only

Per-statistic selection uses validation *weekly* RMSE of that statistic, because the app
projects fantasy weeks, not single games. A promotion gate then compares the combined
weekly fantasy-point projection with the production baseline. Passing the gate makes a
model *eligible*; this script never changes the application.

Usage: python -m benchboss_ml.train
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
from dataclasses import dataclass
from typing import Any

import lightgbm as lgb
import numpy as np
import pandas as pd
from scipy.optimize import nnls
from scipy.stats import spearmanr

from . import FEATURE_SCHEMA_VERSION, PIPELINE_VERSION
from .availability import AVAILABILITY_FEATURES, availability_rows
from .dataset import load_processed
from .export import compact_booster
from .features import (GOALIE_FEATURES, PRIOR_WEIGHT_GRID, RESIDUAL_FEATURES, XG_FEATURES, SEASON_WEIGHT_GRID, SHRINK_K_GRID, SKATER_FEATURES, SKATER_TARGETS, goalie_features,
                       season_average_baseline, shrinkage_reference, shrunk_baseline, skater_baseline, skater_features)
from .paths import ARTIFACT_DIR, MANIFEST_PATH, REPORTS_DIR

# BenchBoss AI, the neural challenger (benchboss_ml.neural). On by default when PyTorch is installed; it only
# ships to the app if it passes NEURAL_GATE below, and even then stays behind a feature flag.
# PyTorch is only imported in a child process (see neural.run_isolated).
import importlib.util
NEURAL_AVAILABLE = importlib.util.find_spec("torch") is not None
USE_NEURAL = NEURAL_AVAILABLE
# A challenger must not cost more than this relative weekly MAE for forwards or defencemen.
NEURAL_POSITION_TOLERANCE = 0.005

SEED = 20261104
# Matches defaultLeagueSettings in lib/calculator.ts; used only for evaluation summaries.
DEFAULT_SKATER_SCORING = {"goals": 2.0, "assists": 1.0, "ppPoints": 1.0, "shots": 0.1, "hits": 0.1, "blocks": 0.5}
DEFAULT_GOALIE_SCORING = {"win": 2.0, "saves": 0.1, "shutout": 5.0, "ga": -1.0}
INTERVAL_Z = 1.2816  # 80% central interval
TOP_K = 50
# Promotion gate tolerances for secondary decision metrics (absolute).
GATE_RANKING_TOLERANCE = 0.005


@dataclass
class Split:
    train: list[str]
    validation: str
    test: str
    live: str | None


def choose_split(seasons: list[str], today: dt.date) -> Split:
    seasons = sorted(seasons)
    completed = [s for s in seasons if dt.date(int(s[4:]), 6, 30) < today]
    live = next((s for s in seasons if s not in completed), None)
    if len(completed) < 3:
        raise SystemExit("Need at least three completed seasons for train/validation/test.")
    return Split(train=completed[:-2], validation=completed[-2], test=completed[-1], live=live)


DIRECT_PARAMS = {"learning_rate": 0.08, "num_leaves": 15, "min_data_in_leaf": 200}
RESIDUAL_PARAMS = {"learning_rate": 0.05, "num_leaves": 7, "min_data_in_leaf": 2000}


def lgb_params(objective: str, **overrides: Any) -> dict[str, Any]:
    params = {
        "objective": objective, **DIRECT_PARAMS,
        "feature_fraction": 0.8, "bagging_fraction": 0.8, "bagging_freq": 1, "lambda_l2": 1.0,
        "seed": SEED, "deterministic": True, "force_row_wise": True, "verbose": -1, "num_threads": 4,
    }
    params.update(overrides)
    return params


def fit(frame: pd.DataFrame, features: tuple[str, ...], target: str, objective: str,
        valid: pd.DataFrame | None = None, rounds: int | None = None, init_col: str | None = None,
        params: dict[str, Any] | None = None) -> lgb.Booster:
    def dataset(df: pd.DataFrame, reference: lgb.Dataset | None = None) -> lgb.Dataset:
        init = np.log(df[init_col].clip(lower=1e-3)) if init_col else None
        return lgb.Dataset(df[list(features)], df[target], init_score=init, reference=reference, free_raw_data=False)
    config = lgb_params(objective, **(params or {}))
    data = dataset(frame)
    if valid is not None:
        return lgb.train(config, data, num_boost_round=2000, valid_sets=[dataset(valid, data)],
                         callbacks=[lgb.early_stopping(60, verbose=False)])
    return lgb.train(config, data, num_boost_round=max(1, rounds or 200))


def predict(booster: lgb.Booster, frame: pd.DataFrame, features: tuple[str, ...], init_col: str | None = None,
            num_iteration: int | None = None) -> np.ndarray:
    if init_col is None:
        return booster.predict(frame[list(features)], num_iteration=num_iteration)
    raw = booster.predict(frame[list(features)], num_iteration=num_iteration, raw_score=True)
    return frame[init_col].clip(lower=1e-3).to_numpy(float) * np.exp(raw)


# ---------------------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------------------

def regression_metrics(y: np.ndarray, p: np.ndarray) -> dict[str, float]:
    y = np.asarray(y, float)
    p = np.clip(np.asarray(p, float), 1e-9, None)
    with np.errstate(divide="ignore", invalid="ignore"):
        dev = 2 * np.mean(np.where(y > 0, y * np.log(y / p), 0) - (y - p))
    rho = spearmanr(y, p).statistic if np.std(p) > 0 and np.std(y) > 0 else float("nan")
    return {"mae": float(np.mean(np.abs(y - p))), "rmse": float(math.sqrt(np.mean((y - p) ** 2))),
            "poissonDeviance": float(dev), "spearman": float(rho), "bias": float(np.mean(p - y)), "n": int(len(y))}


def probability_metrics(y: np.ndarray, p: np.ndarray, bins: int = 10) -> dict[str, Any]:
    y = np.asarray(y, float)
    p = np.clip(np.asarray(p, float), 1e-6, 1 - 1e-6)
    brier = float(np.mean((p - y) ** 2))
    log_loss = float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))
    edges = np.linspace(0, 1, bins + 1)
    table, ece = [], 0.0
    for lo, hi in zip(edges[:-1], edges[1:]):
        mask = (p >= lo) & (p < hi if hi < 1 else p <= hi)
        if mask.sum() == 0:
            continue
        mean_p, rate = float(p[mask].mean()), float(y[mask].mean())
        ece += mask.mean() * abs(mean_p - rate)
        table.append({"bin": f"{lo:.1f}-{hi:.1f}", "n": int(mask.sum()), "predicted": round(mean_p, 4), "observed": round(rate, 4)})
    return {"brier": brier, "logLoss": log_loss, "ece": float(ece), "n": int(len(y)), "reliability": table}


def week_key(dates: pd.Series) -> pd.Series:
    return dates.dt.to_period("W-SUN").astype(str)


def weekly_stat_rmse(frame: pd.DataFrame, actual: str, pred: str) -> float:
    weekly = frame.assign(week=week_key(frame["gameDate"])).groupby(["playerId", "week"])[[actual, pred]].sum()
    return float(math.sqrt(np.mean((weekly[actual] - weekly[pred]) ** 2)))


def weekly_table(frame: pd.DataFrame, pred_cols: dict[str, str], actual_cols: dict[str, str], scoring: dict[str, float],
                 var_col: str | None = None) -> pd.DataFrame:
    data = pd.DataFrame({"playerId": frame["playerId"], "week": week_key(frame["gameDate"]), "group": frame["positionGroup"]})
    data["pred_fp"] = sum(frame[pred_cols[s]] * w for s, w in scoring.items())
    data["actual_fp"] = sum(frame[actual_cols[s]] * w for s, w in scoring.items())
    agg: dict[str, str] = {"pred_fp": "sum", "actual_fp": "sum", "group": "first"}
    if var_col:
        data["pred_var"] = frame[var_col]
        agg["pred_var"] = "sum"
    return data.groupby(["playerId", "week"]).agg(agg).reset_index()


def ranking_metrics(weekly: pd.DataFrame, pred: str, actual: str, seed: int) -> dict[str, float]:
    rng = np.random.default_rng(seed)  # same pairs for every projection being compared
    rhos, precisions = [], []
    for _, week in weekly.groupby("week"):
        if len(week) < TOP_K * 2:
            continue
        rhos.append(spearmanr(week[pred], week[actual]).statistic)
        top_pred = set(week.nlargest(TOP_K, pred)["playerId"])
        top_actual = set(week.nlargest(TOP_K, actual)["playerId"])
        precisions.append(len(top_pred & top_actual) / TOP_K)
    # Start/sit: random same-week, same-position-group pairs; correct when the higher
    # projection also scored more. Ties in actual or projected points are excluded.
    correct = total = 0
    for _, bucket in weekly.groupby(["week", "group"]):
        if len(bucket) < 2:
            continue
        n_pairs = min(200, len(bucket) * 2)
        a = rng.integers(0, len(bucket), n_pairs)
        b = rng.integers(0, len(bucket), n_pairs)
        pa, pb = bucket[pred].to_numpy()[a], bucket[pred].to_numpy()[b]
        ya, yb = bucket[actual].to_numpy()[a], bucket[actual].to_numpy()[b]
        valid = (a != b) & (ya != yb) & (pa != pb)
        correct += int(((pa > pb) == (ya > yb))[valid].sum())
        total += int(valid.sum())
    return {
        "weeklySpearman": float(np.nanmean(rhos)) if rhos else float("nan"),
        f"top{TOP_K}Precision": float(np.mean(precisions)) if precisions else float("nan"),
        "startSitAccuracy": correct / total if total else float("nan"),
        "startSitPairs": total, "weeks": len(rhos),
    }


def weekly_metrics(weekly: pd.DataFrame) -> dict[str, Any]:
    metrics = regression_metrics(weekly["actual_fp"], weekly["pred_fp"])
    metrics.pop("poissonDeviance")
    metrics.update(ranking_metrics(weekly, "pred_fp", "actual_fp", SEED))
    metrics["byPositionMae"] = {g: float(np.mean(np.abs(w["actual_fp"] - w["pred_fp"]))) for g, w in weekly.groupby("group")}
    return metrics


def nb_dispersion(y: np.ndarray, mu: np.ndarray) -> float:
    """Method-of-moments negative-binomial alpha: Var = mu + alpha * mu^2."""
    denom = float(np.sum(mu ** 2))
    if denom <= 0:
        return 0.0
    return max(0.0, float(np.sum((y - mu) ** 2 - mu) / denom))


def interval_scale(weekly: pd.DataFrame) -> float:
    """Scale on the analytic weekly sd so the 80% interval covers 80% on validation."""
    sd = np.sqrt(np.clip(weekly["pred_var"], 1e-9, None))
    z = np.abs(weekly["actual_fp"] - weekly["pred_fp"]) / sd
    return float(np.quantile(z, 0.8) / INTERVAL_Z)


def interval_coverage(weekly: pd.DataFrame, scale: float) -> float:
    sd = np.sqrt(np.clip(weekly["pred_var"], 1e-9, None)) * scale
    lo = weekly["pred_fp"] - INTERVAL_Z * sd
    hi = weekly["pred_fp"] + INTERVAL_Z * sd
    return float(np.mean((weekly["actual_fp"] >= lo) & (weekly["actual_fp"] <= hi)))


def promotion_gate(candidate: dict[str, Any], baseline: dict[str, Any]) -> dict[str, Any]:
    checks = {
        "weeklyMaeImproves": candidate["mae"] < baseline["mae"],
        "weeklyRmseImproves": candidate["rmse"] < baseline["rmse"],
        "startSitNotWorse": candidate["startSitAccuracy"] >= baseline["startSitAccuracy"] - GATE_RANKING_TOLERANCE,
        "top50NotWorse": candidate[f"top{TOP_K}Precision"] >= baseline[f"top{TOP_K}Precision"] - GATE_RANKING_TOLERANCE,
    }
    return {"passed": all(checks.values()), "checks": checks}


# ---------------------------------------------------------------------------------------
# Skaters
# ---------------------------------------------------------------------------------------

SKATER_CANDIDATES = {
    "direct": {"features": SKATER_FEATURES, "init": None, "params": DIRECT_PARAMS, "servable": True},
    "residual": {"features": RESIDUAL_FEATURES, "init": "base", "params": RESIDUAL_PARAMS, "servable": True},
    "residualShrunk": {"features": RESIDUAL_FEATURES, "init": "shr", "params": RESIDUAL_PARAMS, "servable": True},
    # Needs per-game play-by-play at serving time (hundreds of requests), so it is evaluated
    # offline but never exported to the app.
    "residualXg": {"features": RESIDUAL_FEATURES + XG_FEATURES, "init": "shr", "params": RESIDUAL_PARAMS, "servable": False},
}
BLEND_GRID = (1.0, 0.75, 0.5)
LAST_SKATER_FRAMES: dict[str, pd.DataFrame] = {}
INIT_LABELS = {"base": "log(productionBaseline)", "shr": "log(shrunkBaseline)"}


def prediction_column(name: str, target: str) -> str:
    return {"baseline": f"base_{target}", "shrunk": f"shr_{target}"}.get(name, f"{name}_{target}")


STACK_MIN_WEIGHT = 0.02


def stack_weights(frame: pd.DataFrame, target: str, names: list[str]) -> dict[str, float]:
    """Non-negative weights over servable projections that minimise weekly squared error.

    Weekly sums are linear in the weights, so this is NNLS on player-week sums. Components
    under STACK_MIN_WEIGHT are dropped and the rest refitted, which keeps the artifact small.
    """
    names = list(names)
    weekly = frame.assign(week=week_key(frame["gameDate"])).groupby(["playerId", "week"])[
        [prediction_column(n, target) for n in names] + [target]].sum()
    while True:
        weights, _ = nnls(weekly[[prediction_column(n, target) for n in names]].to_numpy(float), weekly[target].to_numpy(float))
        keep = [n for n, w in zip(names, weights) if w >= STACK_MIN_WEIGHT]
        if len(keep) == len(names) or not keep:
            return {n: float(w) for n, w in zip(names, weights) if w > 0}
        names = keep


def choose_blend(valid: pd.DataFrame, prefix: str, actual_cols: dict[str, str]) -> tuple[float, dict[float, dict[str, Any]]]:
    """Model weight against the production baseline: best validation start/sit + top-50
    among blends within 0.5% of the best weekly RMSE."""
    scores = {}
    for alpha in BLEND_GRID:
        cols = {}
        for s in actual_cols:
            valid[f"_b_{s}"] = alpha * valid[f"{prefix}_{s}"] + (1 - alpha) * valid[f"base_{s}"]
            cols[s] = f"_b_{s}"
        scores[alpha] = weekly_metrics(weekly_table(valid, cols, actual_cols, DEFAULT_SKATER_SCORING))
    best_rmse = min(m["rmse"] for m in scores.values())
    eligible = {a: m for a, m in scores.items() if m["rmse"] <= best_rmse * 1.005}
    return max(eligible, key=lambda a: (eligible[a]["startSitAccuracy"] + eligible[a][f"top{TOP_K}Precision"], a)), scores


NEURAL_RULE = ("The LightGBM + BenchBoss AI ensemble must beat the current LightGBM projection on weekly fantasy-point MAE and RMSE, "
               f"not reduce start/sit accuracy or top-{TOP_K} precision, and not raise forward or defence weekly MAE by more than "
               f"{NEURAL_POSITION_TOLERANCE:.1%}, on both the validation and the untouched test season of the week-start backtest; and validation must give BenchBoss AI a non-zero weight.")


def neural_gate(candidate: dict[str, Any], incumbent: dict[str, Any]) -> dict[str, Any]:
    checks = {
        "weeklyMaeImproves": candidate["mae"] < incumbent["mae"],
        "weeklyRmseImproves": candidate["rmse"] < incumbent["rmse"],
        "startSitNotWorse": candidate["startSitAccuracy"] >= incumbent["startSitAccuracy"],
        "top50NotWorse": candidate[f"top{TOP_K}Precision"] >= incumbent[f"top{TOP_K}Precision"],
        **{f"{g}MaeNotWorse": candidate["byPositionMae"][g] <= incumbent["byPositionMae"][g] * (1 + NEURAL_POSITION_TOLERANCE)
           for g in ("F", "D")},
    }
    return {"passed": all(checks.values()), "checks": checks}


def apply_stack(frame: pd.DataFrame, target: str, weights: dict[str, float]) -> pd.Series:
    return sum(w * frame[prediction_column(n, target)] for n, w in weights.items())


# Week-start ("serving-faithful") backtest. The app projects a fantasy week once, from data
# through the day before: lib/model/project.ts calls skaterFeatures(date) for every scheduled
# game with player and team history frozen at that point. The per-game backtest instead updates
# features before every game, so a later game in a week "knows" earlier results of that week.
# week_start_frame rebuilds each player-week the way the app sees it:
#   frozen at the player's first game of the calendar week: every player-history and own-team
#     feature (season/L5/L10/L20/previous-season rates, games played, availability, deployment)
#   advanced per game: days_since_last_game (week-start gap + days elapsed, capped)
#   per game, as the app computes them from the schedule: home, rest, back-to-back, team games
#     in the next 7 days, position flags; opponent rates stay per game (an approximation: they
#     describe the opponent, not the player)
WEEK_GAME_CONTEXT = ("home", "rest_days", "b2b", "team_games_next7", "pos_C", "pos_W", "pos_D",
                     "opp_ga_pg", "opp_ga_l10", "opp_sa_pg", "opp_sv_pct")
GAP_CAP_DAYS = 30


def week_start_frame(frame: pd.DataFrame) -> pd.DataFrame:
    frozen = [c for c in dict.fromkeys(SKATER_FEATURES + RESIDUAL_FEATURES + XG_FEATURES)
              if c in frame and c not in WEEK_GAME_CONTEXT and c != "days_since_last_game"]
    f = frame.sort_values(["playerId", "gameDate", "gameId"], kind="stable")
    group = f.groupby(["playerId", week_key(f["gameDate"])], sort=False).ngroup().to_numpy()
    first = f.groupby(group, sort=False).cumcount().to_numpy() == 0
    firsts = pd.DataFrame(f.loc[first, frozen].to_numpy(), index=group[first], columns=frozen)
    out = f.copy()
    out[frozen] = firsts.loc[group].to_numpy(dtype=float)
    first_date = pd.Series(f.loc[first, "gameDate"].to_numpy(), index=group[first]).loc[group].to_numpy()
    first_gap = pd.Series(f.loc[first, "days_since_last_game"].to_numpy(float), index=group[first]).loc[group].to_numpy()
    elapsed = (f["gameDate"].to_numpy() - first_date) / np.timedelta64(1, "D")
    out["days_since_last_game"] = np.minimum(first_gap + elapsed, GAP_CAP_DAYS)
    return out.loc[frame.index]


def train_skaters(feats: pd.DataFrame, split: Split) -> tuple[dict, dict]:
    feats = feats.copy()
    feats["positionGroup"] = feats["position"].map({"C": "F", "W": "F", "D": "D"})
    train_rows = feats["season"].isin(split.train)
    fallback = {t: feats[train_rows].groupby("position")[t].mean().to_dict() for t in SKATER_TARGETS}
    for target in SKATER_TARGETS:
        feats[f"base_{target}"] = skater_baseline(feats, target, fallback[target])
        feats[f"avg_{target}"] = season_average_baseline(feats, target, fallback[target])
    # Shrinkage strength per stat, tuned on the validation season only.
    shrinkage: dict[str, Any] = {}
    validation_rows = feats["season"] == split.validation
    for target in SKATER_TARGETS:
        reference = shrinkage_reference(feats[train_rows], target)
        grid = {}
        for k in SHRINK_K_GRID:
            for prior_weight in PRIOR_WEIGHT_GRID:
                for season_weight in SEASON_WEIGHT_GRID:
                    candidate = feats[validation_rows].assign(_p=shrunk_baseline(feats[validation_rows], target, k, reference, prior_weight, season_weight))
                    grid[f"{k}|{prior_weight}|{season_weight}"] = weekly_stat_rmse(candidate, target, "_p")
        best_key = min(grid, key=grid.get)
        k_best, weight_best, season_best = (float(v) for v in best_key.split("|"))
        feats[f"shr_{target}"] = shrunk_baseline(feats, target, k_best, reference, weight_best, season_best)
        shrinkage[target] = {"k": k_best, "priorWeight": weight_best, "seasonWeight": season_best, "reference": reference, "validationGrid": grid}

    if USE_NEURAL:
        from .neural import add_inputs
        feats = add_inputs(feats)
    train = feats[train_rows]
    full = feats[feats["season"].isin(split.train + [split.validation, split.test])]
    frames = {"validation": feats[feats["season"] == split.validation].copy(),
              "test": feats[feats["season"] == split.test].copy(),
              "live": feats[feats["season"] == split.live].copy() if split.live else feats.iloc[0:0].copy()}
    frames = {k: v for k, v in frames.items() if not v.empty}
    ws = {k: week_start_frame(v) for k, v in frames.items()}
    for f in ws.values():
        for t in SKATER_TARGETS:
            sh = shrinkage[t]
            f[f"base_{t}"] = skater_baseline(f, t, fallback[t])
            f[f"shr_{t}"] = shrunk_baseline(f, t, sh["k"], sh["reference"], sh["priorWeight"], sh["seasonWeight"])
    if USE_NEURAL:
        ws = {k: add_inputs(v) for k, v in ws.items()}

    neural: dict[str, Any] = {}
    if USE_NEURAL:
        from .neural import run_isolated
        print("  BenchBoss AI: training on train seasons, early stopping on validation (separate process)...", flush=True)
        neural["run"] = run_isolated(train, frames["validation"], full, {**frames, **{f"{k}_ws": v for k, v in ws.items()}}, SEED)
        for split_name, frame in [*frames.items(), *((f"{k}_ws", v) for k, v in ws.items())]:
            preds = neural["run"]["predictions"][split_name]
            for i, t in enumerate(SKATER_TARGETS):
                frame[f"neural_{t}"] = preds[:, i]
        neural["stacks"] = {}

    artifact: dict[str, Any] = {"targets": {}, "positionFallback": fallback,
                                "baselineWeights": {"std": 0.45, "l20": 0.25, "l10": 0.20, "l5": 0.10}}
    report: dict[str, Any] = {"targets": {}}

    for target in SKATER_TARGETS:
        base_col = f"base_{target}"
        candidates: dict[str, dict[str, Any]] = {}
        for name, spec in SKATER_CANDIDATES.items():
            init = f"{spec['init']}_{target}" if spec["init"] else None
            model = fit(train, spec["features"], target, "poisson", valid=frames["validation"], init_col=init, params=spec["params"])
            best = model.best_iteration or model.current_iteration()
            export_model = fit(full, spec["features"], target, "poisson", rounds=best, init_col=init, params=spec["params"])
            for split_name, frame in [*frames.items(), *ws.items()]:
                booster, iteration = (export_model, None) if split_name == "live" else (model, best)
                frame[f"{name}_{target}"] = predict(booster, frame, spec["features"], init, iteration)
            candidates[name] = {"best": int(best), "export": export_model, "spec": spec}

        valid = frames["validation"]
        # Stack every servable projection with weights fitted on validation weekly sums; the
        # test and live seasons stay untouched for the gate.
        stack_names = ["baseline", "shrunk"] + [n for n, c in candidates.items() if c["spec"]["servable"]]
        stack = stack_weights(valid, target, stack_names)
        for frame in [*frames.values(), *ws.values()]:
            frame[f"stack_{target}"] = apply_stack(frame, target, stack)
        weekly_rmse = {name: weekly_stat_rmse(valid, target, f"{name}_{target}") for name in candidates}
        weekly_rmse["stack"] = weekly_stat_rmse(valid, target, f"stack_{target}")
        if USE_NEURAL:
            # Challenger: the same stack with the network as one more component; validation
            # chooses its weight (it may be zero).
            neural["stacks"][target] = stack_weights(valid, target, stack_names + ["neural"])
            for frame in [*frames.values(), *ws.values()]:
                frame[f"stackNN_{target}"] = apply_stack(frame, target, neural["stacks"][target])
            neural.setdefault("weeklyRmse", {})[target] = {"neural": weekly_stat_rmse(valid, target, f"neural_{target}"),
                                                           "stackWithNeural": weekly_stat_rmse(valid, target, f"stackNN_{target}")}
        weekly_rmse["baseline"] = weekly_stat_rmse(valid, target, base_col)
        weekly_rmse["shrunk"] = weekly_stat_rmse(valid, target, f"shr_{target}")
        servable = {k: v for k, v in weekly_rmse.items() if k not in candidates or candidates[k]["spec"]["servable"]}
        selected = min(servable, key=servable.get)
        selected_any = min(weekly_rmse, key=weekly_rmse.get)

        for frame in ws.values():
            frame[f"final_{target}"] = frame[prediction_column(selected, target)]
        scores: dict[str, Any] = {}
        for split_name, frame in frames.items():
            frame[f"final_{target}"] = frame[prediction_column(selected, target)]
            frame[f"finalXg_{target}"] = frame[prediction_column(selected_any, target)]
            scores[split_name] = {
                **{name: regression_metrics(frame[target], frame[f"{name}_{target}"]) for name in candidates},
                "productionBaseline": regression_metrics(frame[target], frame[base_col]),
                "shrunkBaseline": regression_metrics(frame[target], frame[f"shr_{target}"]),
                "seasonAverageBaseline": regression_metrics(frame[target], frame[f"avg_{target}"]),
                "weeklyRmse": {**{name: weekly_stat_rmse(frame, target, f"{name}_{target}") for name in candidates},
                               "productionBaseline": weekly_stat_rmse(frame, target, base_col),
                               "shrunkBaseline": weekly_stat_rmse(frame, target, f"shr_{target}")},
                "byPosition": {
                    pos: {"selectedMae": float(np.mean(np.abs(group[target] - group[f"final_{target}"]))),
                          "baselineMae": float(np.mean(np.abs(group[target] - group[base_col]))), "n": int(len(group))}
                    for pos, group in frame.groupby("position")
                },
            }
        dispersion = nb_dispersion(valid[target].to_numpy(float), valid[f"final_{target}"].to_numpy(float))
        entry: dict[str, Any] = {"selected": selected, "objective": "poisson", "dispersion": dispersion,
                                 "validationWeeklyRmse": weekly_rmse,
                                 "shrinkage": {k: v for k, v in shrinkage[target].items() if k != "validationGrid"}}
        def booster_entry(chosen: dict[str, Any]) -> dict[str, Any]:
            importance = dict(zip(chosen["export"].feature_name(), chosen["export"].feature_importance("gain").tolist()))
            return {"features": list(chosen["spec"]["features"]), "initScore": INIT_LABELS.get(chosen["spec"]["init"]),
                    "bestIteration": chosen["best"], "topFeatures": sorted(importance, key=importance.get, reverse=True)[:8],
                    "booster": compact_booster(chosen["export"], chosen["spec"]["features"], frames.get("test", full))}
        if selected == "stack":
            entry["stack"] = stack
            entry["components"] = {n: booster_entry(candidates[n]) for n in stack if n in candidates}
        elif selected in candidates:
            chosen = candidates[selected]
            importance = dict(zip(chosen["export"].feature_name(), chosen["export"].feature_importance("gain").tolist()))
            entry.update({
                "features": list(chosen["spec"]["features"]),
                "initScore": INIT_LABELS.get(chosen["spec"]["init"]),
                "bestIteration": chosen["best"],
                "topFeatures": sorted(importance, key=importance.get, reverse=True)[:8],
                "booster": compact_booster(chosen["export"], chosen["spec"]["features"], frames.get("test", full)),
            })
        artifact["targets"][target] = entry
        report["targets"][target] = {"selected": selected, "selectedIncludingXg": selected_any, "stackWeights": stack, "dispersion": dispersion, "validationWeeklyRmse": weekly_rmse,
                                     "shrinkK": shrinkage[target]["k"], "priorWeight": shrinkage[target]["priorWeight"], "seasonWeight": shrinkage[target]["seasonWeight"], "shrinkGrid": shrinkage[target]["validationGrid"],
                                     "trees": {n: c["best"] for n, c in candidates.items()},
                                     "topFeatures": entry.get("topFeatures", []), "scores": scores}
        print(f"  skater {target}: selected={selected} weekly rmse " + " ".join(f"{k}={v:.4f}" for k, v in weekly_rmse.items()))

    report["calibration"] = {
        split_name: {
            "anyGoal_selected": probability_metrics((frame["goals"] > 0).astype(float), 1 - np.exp(-frame["final_goals"])),
            "anyGoal_baseline": probability_metrics((frame["goals"] > 0).astype(float), 1 - np.exp(-frame["base_goals"])),
        } for split_name, frame in frames.items()
    }

    # Rank-aware blend: lineup decisions are rankings, so choose how much of the selected
    # projection to blend with the production baseline using validation start/sit accuracy
    # and top-50 precision, among blends whose weekly RMSE is within 0.5% of the best.
    actual_cols = {s: s for s in DEFAULT_SKATER_SCORING}
    valid = frames["validation"]
    alpha, blend_scores = choose_blend(valid, "final", actual_cols)
    for frame in [*frames.values(), *ws.values()]:
        for s in actual_cols:
            frame[f"final_{s}"] = alpha * frame[f"final_{s}"] + (1 - alpha) * frame[f"base_{s}"]
    if USE_NEURAL:
        neural["alpha"], _ = choose_blend(valid, "stackNN", actual_cols)
        for frame in [*frames.values(), *ws.values()]:
            for s in actual_cols:
                frame[f"ensembleNN_{s}"] = neural["alpha"] * frame[f"stackNN_{s}"] + (1 - neural["alpha"]) * frame[f"base_{s}"]
    artifact["blendWithProductionBaseline"] = 1 - alpha
    report["blend"] = {"chosenModelWeight": alpha, "validation": {str(a): {k: m[k] for k in ("mae", "rmse", "startSitAccuracy", f"top{TOP_K}Precision")} for a, m in blend_scores.items()}}
    print(f"  blend: model weight {alpha} (validation start/sit + top-50 among RMSE-eligible blends)")

    report["weekly"], report["gate"] = {}, {}
    for split_name, frame in frames.items():
        frame["pred_var"] = sum((w ** 2) * (frame[f"final_{s}"] + artifact["targets"][s]["dispersion"] * frame[f"final_{s}"] ** 2)
                                for s, w in DEFAULT_SKATER_SCORING.items())
        tables = {
            "benchBossSelected": weekly_table(frame, {s: f"final_{s}" for s in actual_cols}, actual_cols, DEFAULT_SKATER_SCORING, "pred_var"),
            "directModelOnly": weekly_table(frame, {s: f"direct_{s}" for s in actual_cols}, actual_cols, DEFAULT_SKATER_SCORING),
            "residualModelOnly": weekly_table(frame, {s: f"residual_{s}" for s in actual_cols}, actual_cols, DEFAULT_SKATER_SCORING),
            "shrunkBaselineOnly": weekly_table(frame, {s: f"shr_{s}" for s in actual_cols}, actual_cols, DEFAULT_SKATER_SCORING),
            "residualOnShrunkOnly": weekly_table(frame, {s: f"residualShrunk_{s}" for s in actual_cols}, actual_cols, DEFAULT_SKATER_SCORING),
            "withXgOffline": weekly_table(frame, {s: f"finalXg_{s}" for s in actual_cols}, actual_cols, DEFAULT_SKATER_SCORING),
            "productionBaseline": weekly_table(frame, {s: f"base_{s}" for s in actual_cols}, actual_cols, DEFAULT_SKATER_SCORING),
            "seasonAverageBaseline": weekly_table(frame, {s: f"avg_{s}" for s in actual_cols}, actual_cols, DEFAULT_SKATER_SCORING),
        }
        if USE_NEURAL:
            tables["neuralOnly"] = weekly_table(frame, {s: f"neural_{s}" for s in actual_cols}, actual_cols, DEFAULT_SKATER_SCORING)
            tables["lightgbmNeuralEnsemble"] = weekly_table(frame, {s: f"ensembleNN_{s}" for s in actual_cols}, actual_cols, DEFAULT_SKATER_SCORING)
        if split_name == "validation":
            artifact["intervalScale"] = interval_scale(tables["benchBossSelected"])
        result = {label: weekly_metrics(table) for label, table in tables.items()}
        result["benchBossSelected"]["interval80Coverage"] = interval_coverage(tables["benchBossSelected"], artifact["intervalScale"])
        report["weekly"][split_name] = result
        report["gate"][split_name] = promotion_gate(result["benchBossSelected"], result["productionBaseline"])
    artifact["intervalZ"] = INTERVAL_Z

    # Week-start backtest: the same models and weights, on features frozen the way the app sees them.
    report["weeklyWeekStart"], report["gateWeekStart"] = {}, {}
    for split_name, frame in ws.items():
        tables = {
            "benchBossSelected": weekly_table(frame, {s: f"final_{s}" for s in actual_cols}, actual_cols, DEFAULT_SKATER_SCORING),
            "shrunkBaselineOnly": weekly_table(frame, {s: f"shr_{s}" for s in actual_cols}, actual_cols, DEFAULT_SKATER_SCORING),
            "productionBaseline": weekly_table(frame, {s: f"base_{s}" for s in actual_cols}, actual_cols, DEFAULT_SKATER_SCORING),
        }
        if USE_NEURAL:
            tables["neuralOnly"] = weekly_table(frame, {s: f"neural_{s}" for s in actual_cols}, actual_cols, DEFAULT_SKATER_SCORING)
            tables["lightgbmNeuralEnsemble"] = weekly_table(frame, {s: f"ensembleNN_{s}" for s in actual_cols}, actual_cols, DEFAULT_SKATER_SCORING)
        report["weeklyWeekStart"][split_name] = {label: weekly_metrics(table) for label, table in tables.items()}
        report["gateWeekStart"][split_name] = promotion_gate(report["weeklyWeekStart"][split_name]["benchBossSelected"],
                                                             report["weeklyWeekStart"][split_name]["productionBaseline"])
    print("  week-start backtest (test): " + " ".join(f"{k}={m['mae']:.4f}" for k, m in report["weeklyWeekStart"].get("test", {}).items()))

    if USE_NEURAL:
        # The challenger is judged on the week-start backtest: a model that only wins when it
        # can see earlier results from the same week would not win in the app.
        gate = {name: neural_gate(report["weeklyWeekStart"][name]["lightgbmNeuralEnsemble"], report["weeklyWeekStart"][name]["benchBossSelected"])
                for name in ("validation", "test") if name in report["weeklyWeekStart"]}
        daily = {}
        for split_name, frame in frames.items():
            fp = lambda prefix: sum(frame[f"{prefix}_{s}"] * w for s, w in DEFAULT_SKATER_SCORING.items())  # noqa: E731
            actual_fp = sum(frame[s] * w for s, w in DEFAULT_SKATER_SCORING.items())
            daily[split_name] = {
                label: {"poissonDevianceSum": float(sum(regression_metrics(frame[t], frame[f"{prefix}_{t}"])["poissonDeviance"] for t in SKATER_TARGETS)),
                        "fpMae": float(np.mean(np.abs(actual_fp - fp(prefix)))),
                        "fpSpearman": float(spearmanr(actual_fp, fp(prefix)).statistic)}
                for label, prefix in (("benchBossSelected", "final"), ("neuralOnly", "neural"), ("lightgbmNeuralEnsemble", "ensembleNN"), ("productionBaseline", "base"))
            }
        promoted = bool(gate) and all(g["passed"] for g in gate.values()) and any(neural["stacks"][t].get("neural", 0) > 0 for t in SKATER_TARGETS)
        artifact["neural"] = {
            **neural["run"]["export"],
            "stack": neural["stacks"], "blendWithProductionBaseline": 1 - neural["alpha"], "promoted": promoted,
        }
        report["neural"] = {"bestEpoch": neural["run"]["bestEpoch"], "validationLoss": neural["run"]["validationLoss"],
                            "stackWeights": neural["stacks"], "modelWeight": neural["alpha"], "validationWeeklyRmse": neural["weeklyRmse"],
                            "gate": gate, "gateBasis": "weekStart", "daily": daily, "promoted": promoted, "rule": NEURAL_RULE}
        print(f"  BenchBoss AI: {'PROMOTED (still behind the feature flag)' if promoted else 'not promoted'}; "
              + " ".join(f"{t}={neural['stacks'][t].get('neural', 0):.2f}" for t in SKATER_TARGETS))
    LAST_SKATER_FRAMES.clear(); LAST_SKATER_FRAMES.update(frames)  # for offline experiments
    gate = report["gate"]
    report["promotion"] = {
        "eligible": gate["validation"]["passed"] and gate.get("test", {"passed": False})["passed"],
        "rule": "Selected projection must beat the production baseline on weekly fantasy-point MAE and RMSE, "
                f"and not lose more than {GATE_RANKING_TOLERANCE:.3f} in start/sit accuracy or top-{TOP_K} precision, "
                "on both the validation and the untouched test season.",
    }
    return artifact, report


# ---------------------------------------------------------------------------------------
# Goalies
# ---------------------------------------------------------------------------------------

GOALIE_TARGETS = {"started": "binary", "saves": "poisson", "ga": "poisson", "win": "binary", "shutout": "binary"}
MIN_GOALIE_ROWS = 2000
SHRINK_STARTS = 5.0  # empirical-Bayes prior strength for per-start goalie baselines


def pick_accuracy(frame: pd.DataFrame, score_col: str, tiebreak: str = "share_l20") -> dict[str, float]:
    """Share of team-games where the top-scored candidate is the goalie who actually started.
    Only team-games whose starter was among the candidates are counted (a fresh call-up
    cannot be picked by anyone)."""
    games = frame.groupby(["gameId", "team"]).filter(lambda g: g["started"].sum() == 1)
    if games.empty:
        return {"accuracy": float("nan"), "teamGames": 0}
    ranked = games.sort_values([score_col, tiebreak], ascending=False).groupby(["gameId", "team"]).head(1)
    return {"accuracy": float(ranked["started"].mean()), "teamGames": int(len(ranked))}


def goalie_baseline(frame: pd.DataFrame, target: str, league: dict[str, float]) -> pd.Series:
    """Usage share for starts; per-start season averages shrunk toward the league mean."""
    if target == "started":
        return frame["share_l10"].fillna(frame["share_l20"]).fillna(0.5)
    starts = frame["cum_starts"].fillna(0.0)
    totals = {"saves": frame["cum_saves"], "ga": frame["cum_ga"], "win": frame["cum_win"]}.get(target)
    if totals is None:  # shutouts are not tracked cumulatively; league rate
        return pd.Series(league[target], index=frame.index)
    return (totals.fillna(0.0) + SHRINK_STARTS * league[target]) / (starts + SHRINK_STARTS)


def train_goalies(feats: pd.DataFrame, split: Split) -> tuple[dict, dict]:
    train_all = feats[feats["season"].isin(split.train)]
    league = {t: float(train_all.loc[train_all["started"] == 1, t].mean()) for t in ("saves", "ga", "win", "shutout")}
    artifact: dict[str, Any] = {"features": list(GOALIE_FEATURES), "targets": {}, "leagueMeans": league}
    report: dict[str, Any] = {"targets": {}}
    seasons = {"validation": [split.validation], "test": [split.test], "live": [split.live] if split.live else []}
    candidates = {name: feats[feats["season"].isin(s)].copy() for name, s in seasons.items()}
    candidates = {k: v for k, v in candidates.items() if not v.empty}
    full_all = feats[feats["season"].isin(split.train + [split.validation, split.test])]

    for target, objective in GOALIE_TARGETS.items():
        def subset(frame: pd.DataFrame) -> pd.DataFrame:
            frame = frame if target == "started" else frame[frame["started"] == 1]
            return frame.dropna(subset=[target])
        train, valid, full = subset(train_all), subset(candidates["validation"]), subset(full_all)
        if len(train) < MIN_GOALIE_ROWS or valid.empty:
            artifact["targets"][target] = {"selected": "baseline", "objective": objective, "reason": "insufficient data"}
            continue
        model = fit(train, GOALIE_FEATURES, target, objective, valid=valid)
        best = model.best_iteration or model.current_iteration()
        export_model = fit(full, GOALIE_FEATURES, target, objective, rounds=best)
        metric = probability_metrics if objective == "binary" else regression_metrics
        scores = {}
        for name, frame in candidates.items():
            booster, iteration = (export_model, None) if name == "live" else (model, best)
            # Predict for every candidate row (needed for weekly expected fantasy points).
            frame[f"model_{target}"] = booster.predict(frame[list(GOALIE_FEATURES)], num_iteration=iteration)
            frame[f"base_{target}"] = goalie_baseline(frame, target, league).to_numpy(float)
            rows = subset(frame)
            scores[name] = {"model": metric(rows[target].to_numpy(float), rows[f"model_{target}"].to_numpy(float)),
                            "productionBaseline": metric(rows[target].to_numpy(float), rows[f"base_{target}"].to_numpy(float))}
            if target == "started":
                scores[name]["pickAccuracy"] = {"model": pick_accuracy(frame, "model_started"), "usageBaseline": pick_accuracy(frame, "share_l10")}
        key = "logLoss" if objective == "binary" else "rmse"
        selected = "model" if scores["validation"]["model"][key] < scores["validation"]["productionBaseline"][key] else "baseline"
        for frame in candidates.values():
            frame[f"final_{target}"] = frame[f"model_{target}"] if selected == "model" else frame[f"base_{target}"]
        dispersion = nb_dispersion(valid[target].to_numpy(float), candidates["validation"].loc[valid.index, f"final_{target}"].to_numpy(float)) if objective == "poisson" else 0.0
        artifact["targets"][target] = {
            "selected": selected, "objective": objective, "dispersion": dispersion, "bestIteration": int(best),
            "booster": compact_booster(export_model, GOALIE_FEATURES, subset(candidates.get("test", full_all))),
        }
        report["targets"][target] = {"selected": selected, "bestIteration": int(best), "scores": scores,
                                     "rows": {"train": len(train), "validation": len(valid)}}
        print(f"  goalie {target}: selected={selected} trees={best} val {key} model={scores['validation']['model'][key]:.4f} "
              f"base={scores['validation']['productionBaseline'][key]:.4f}")

    # Expected weekly goalie fantasy points per candidate: P(start) * E[points | start].
    report["weekly"] = {}
    for name, frame in candidates.items():
        frame["positionGroup"] = "G"
        actual = sum(frame[s].fillna(0) * w for s, w in DEFAULT_GOALIE_SCORING.items()) * frame["started"]
        frame["actual_fp_game"] = actual
        out = {}
        frame["confirmed_started"] = frame["started"].astype(float)
        # "confirmedStarter" = the selected conditional models when the starter is known,
        # i.e. what the official NHL lineup flag adds once it is posted.
        variants = (("benchBossSelected", "final", "final"), ("usageBaseline", "base", "base"), ("confirmedStarter", "confirmed", "final"))
        for label, start_prefix, prefix in variants:
            frame["pred_fp_game"] = frame[f"{start_prefix}_started"] * sum(frame[f"{prefix}_{s}"] * w for s, w in DEFAULT_GOALIE_SCORING.items())
            table = frame.assign(week=week_key(frame["gameDate"])).groupby(["playerId", "week"]).agg(
                pred_fp=("pred_fp_game", "sum"), actual_fp=("actual_fp_game", "sum"), group=("positionGroup", "first")).reset_index()
            metrics = regression_metrics(table["actual_fp"], table["pred_fp"].clip(lower=1e-9))
            metrics.pop("poissonDeviance")
            out[label] = metrics
        report["weekly"][name] = out
    return artifact, report


# ---------------------------------------------------------------------------------------
# Availability (scratches / injuries / absences)
# ---------------------------------------------------------------------------------------

def train_availability(rows: pd.DataFrame, skater_feats: pd.DataFrame, split: Split) -> dict[str, Any]:
    """Score weekly fantasy points *including* games a player missed (actual = 0)."""
    train_rows = skater_feats["season"].isin(split.train)
    per_game = skater_feats[["playerId", "gameId", "gameDate", "position"]].copy()
    per_game["base_fp"] = 0.0
    per_game["actual_fp"] = 0.0
    for stat, weight in DEFAULT_SKATER_SCORING.items():
        fallback = skater_feats[train_rows].groupby("position")[stat].mean().to_dict()
        per_game["base_fp"] += weight * skater_baseline(skater_feats, stat, fallback)
        per_game["actual_fp"] += weight * skater_feats[stat]
    # Per-game projection if he plays: the baseline as of that game, or as of his last game
    # when he missed it (slightly stale for misses; documented).
    rows = pd.merge_asof(rows.sort_values("gameDate"), per_game[["playerId", "gameDate", "base_fp"]].sort_values("gameDate"),
                         on="gameDate", by="playerId", direction="backward")
    rows = rows.merge(per_game[["playerId", "gameId", "actual_fp"]], on=["playerId", "gameId"], how="left")
    rows["actual_fp"] = rows["actual_fp"].fillna(0.0)
    rows = rows.dropna(subset=["base_fp"])

    train = rows[rows["season"].isin(split.train)]
    valid = rows[rows["season"] == split.validation].copy()
    frames = {"validation": valid, "test": rows[rows["season"] == split.test].copy()}
    if split.live:
        frames["live"] = rows[rows["season"] == split.live].copy()
    full = rows[rows["season"].isin(split.train + [split.validation, split.test])]
    model = fit(train, AVAILABILITY_FEATURES, "played", "binary", valid=valid)
    best = model.best_iteration or model.current_iteration()
    export_model = fit(full, AVAILABILITY_FEATURES, "played", "binary", rounds=best)

    report: dict[str, Any] = {"bestIteration": int(best), "rows": {k: len(v) for k, v in frames.items()},
                              "playRate": {k: float(v["played"].mean()) for k, v in frames.items()}, "splits": {}}
    for name, frame in frames.items():
        booster, iteration = (export_model, None) if name == "live" else (model, best)
        frame["p_model"] = booster.predict(frame[list(AVAILABILITY_FEATURES)], num_iteration=iteration)
        frame["p_share"] = frame["played_share_l10"]
        frame["p_one"] = 1.0
        frame["week"] = week_key(frame["gameDate"])
        out: dict[str, Any] = {
            "probability": {"availabilityModel": probability_metrics(frame["played"], frame["p_model"]),
                            "recentShare": probability_metrics(frame["played"], frame["p_share"])},
            "assumesPlaysBrier": float(np.mean((1 - frame["played"]) ** 2)),
            "weekly": {},
        }
        for label, column in (("assumesPlaysEveryGame", "p_one"), ("recentShare", "p_share"), ("availabilityModel", "p_model")):
            weekly = frame.assign(pred_games=frame[column], pred_fp=frame[column] * frame["base_fp"]).groupby(["playerId", "week"]).agg(
                pred_games=("pred_games", "sum"), games=("played", "sum"), pred_fp=("pred_fp", "sum"), actual_fp=("actual_fp", "sum"))
            out["weekly"][label] = {
                "gamesMae": float(np.mean(np.abs(weekly["games"] - weekly["pred_games"]))),
                "fpMae": float(np.mean(np.abs(weekly["actual_fp"] - weekly["pred_fp"]))),
                "fpRmse": float(math.sqrt(np.mean((weekly["actual_fp"] - weekly["pred_fp"]) ** 2))),
                "fpBias": float(np.mean(weekly["pred_fp"] - weekly["actual_fp"])),
            }
        report["splits"][name] = out
    importance = dict(zip(export_model.feature_name(), export_model.feature_importance("gain").tolist()))
    report["topFeatures"] = sorted(importance, key=importance.get, reverse=True)[:6]
    report["artifact"] = {"features": list(AVAILABILITY_FEATURES), "booster": compact_booster(export_model, AVAILABILITY_FEATURES, frames["test"])}
    print(f"  availability: trees={best} val logloss model={report['splits']['validation']['probability']['availabilityModel']['logLoss']:.4f} "
          f"share={report['splits']['validation']['probability']['recentShare']['logLoss']:.4f}")
    return report


# ---------------------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--today", help="Override today's date (YYYY-MM-DD) for reproducible splits")
    parser.add_argument("--no-neural", action="store_true", help="Skip BenchBoss AI (the neural challenger)")
    args = parser.parse_args(argv)
    global USE_NEURAL
    USE_NEURAL = NEURAL_AVAILABLE and not args.no_neural
    today = dt.date.fromisoformat(args.today) if args.today else dt.date.today()

    tables = load_processed()
    split = choose_split(sorted(tables["skater_games"]["season"].unique()), today)
    print(f"Split: train={split.train} validation={split.validation} test={split.test} live={split.live}")
    trained_at = dt.datetime.now(dt.timezone.utc)
    model_version = f"bench-boss-lgbm-{trained_at:%Y%m%d}"
    manifest = json.loads(MANIFEST_PATH.read_text()) if MANIFEST_PATH.exists() else {}
    meta = {
        "modelVersion": model_version, "pipelineVersion": PIPELINE_VERSION,
        "featureSchemaVersion": FEATURE_SCHEMA_VERSION, "trainedAt": trained_at.isoformat(),
        "dataThrough": str(tables["skater_games"]["gameDate"].max().date()), "split": split.__dict__,
        "source": "NHL public stats REST API (api.nhle.com/stats/rest)", "sourceUpdatedAt": manifest.get("updatedAt"),
    }

    from .xg import attach_xg, load_shots, player_game_xg, train_xg
    skater_games = tables["skater_games"]
    xg_report: dict[str, Any] = {"available": False}
    shots = load_shots()
    if not shots.empty and shots["season"].isin(split.train).any():
        print(f"Training xG on {shots['season'].isin(split.train).sum():,} pre-validation shots...")
        xg_model, xg_report = train_xg(shots, split.train, {"validation": split.validation, "test": split.test, **({"live": split.live} if split.live else {})})
        xg_report["available"] = True
        xg_report["seasons"] = sorted(shots["season"].unique().tolist())
        skater_games = attach_xg(skater_games, player_game_xg(shots, xg_model), set(shots["gameId"].unique()))
    else:
        print("No play-by-play shots collected for training seasons; skipping xG.")
    print("Building skater features...")
    skater_feats = skater_features(skater_games, tables["team_games"])
    skater_artifact, skater_report = train_skaters(skater_feats, split)
    print("Building goalie features...")
    goalie_feats = goalie_features(tables["goalie_games"], tables["team_games"])
    goalie_artifact, goalie_report = train_goalies(goalie_feats, split)
    print("Building availability rows...")
    availability_report = train_availability(availability_rows(tables["skater_games"], tables["team_games"]), skater_feats, split)

    promotion = skater_report["promotion"]
    artifact = {**meta, "promotion": promotion, "skater": skater_artifact, "goalie": goalie_artifact}
    artifact["availability"] = availability_report.pop("artifact", None)
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    artifact_path = ARTIFACT_DIR / f"{model_version}.json"
    artifact_path.write_text(json.dumps(artifact, separators=(",", ":")))
    print(f"Wrote {artifact_path} ({artifact_path.stat().st_size / 1024:.0f} KB)")

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    full_report = {**meta, "skater": skater_report, "goalie": goalie_report, "availability": availability_report, "xg": xg_report,
                   "rows": {"skaterGames": len(skater_feats), "goalieCandidates": len(goalie_feats)}}
    (REPORTS_DIR / "evaluation.json").write_text(json.dumps(full_report, indent=2, default=float))
    from .report import render_markdown
    (REPORTS_DIR / "evaluation.md").write_text(render_markdown(full_report))
    print(f"Promotion gate: {'ELIGIBLE' if promotion['eligible'] else 'NOT eligible'} — the app is unchanged either way.")
    print(f"Wrote {REPORTS_DIR / 'evaluation.md'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
