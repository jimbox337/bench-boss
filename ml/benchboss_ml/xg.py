"""Expected goals (xG) from NHL play-by-play shot locations.

A logistic model of P(goal | unblocked attempt) on distance, angle, shot type, strength
and rebound, trained only on seasons before the validation season. Empty-net attempts are
excluded from fitting and scoring. Per player-game aggregates (individual xG and
high-danger attempts) feed prior-only rolling skater features.
"""
from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import log_loss, roc_auc_score

from .paths import RAW_DIR

SHOT_TYPES = ("wrist", "snap", "slap", "backhand", "tip-in", "deflected", "wrap-around")
HIGH_DANGER_XG = 0.15


def load_shots() -> pd.DataFrame:
    files = sorted((RAW_DIR / "pbp_shots").glob("*.csv.gz"))
    frames = [pd.read_csv(f, compression="gzip").assign(season=f.name.split(".")[0]) for f in files]
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def design(shots: pd.DataFrame) -> np.ndarray:
    distance = shots["distance"].clip(0, 100).to_numpy(float)
    angle = shots["angle"].clip(0, 90).to_numpy(float)
    cols = [distance, np.log1p(distance), angle, (angle / 90) ** 2, shots["rebound"].to_numpy(float),
            (shots["strength"] == "pp").to_numpy(float), (shots["strength"] == "sh").to_numpy(float)]
    cols += [(shots["shotType"] == t).to_numpy(float) for t in SHOT_TYPES]
    return np.column_stack(cols)


def train_xg(shots: pd.DataFrame, train_seasons: list[str], eval_seasons: dict[str, str]) -> tuple[LogisticRegression, dict[str, Any]]:
    usable = shots[shots["emptyNet"] == 0]
    train = usable[usable["season"].isin(train_seasons)]
    model = LogisticRegression(max_iter=2000, C=1.0).fit(design(train), train["goal"])
    dist_only = LogisticRegression(max_iter=1000).fit(np.log1p(train[["distance"]].to_numpy(float)), train["goal"])
    report: dict[str, Any] = {"trainShots": int(len(train)), "goalRate": float(train["goal"].mean()), "splits": {}}
    for name, season in eval_seasons.items():
        rows = usable[usable["season"] == season]
        if rows.empty:
            continue
        p = model.predict_proba(design(rows))[:, 1]
        q = dist_only.predict_proba(np.log1p(rows[["distance"]].to_numpy(float)))[:, 1]
        report["splits"][name] = {
            "shots": int(len(rows)), "goals": int(rows["goal"].sum()), "xgTotal": float(p.sum()),
            "logLoss": float(log_loss(rows["goal"], p)), "auc": float(roc_auc_score(rows["goal"], p)),
            "distanceOnlyLogLoss": float(log_loss(rows["goal"], q)), "distanceOnlyAuc": float(roc_auc_score(rows["goal"], q)),
        }
    return model, report


def player_game_xg(shots: pd.DataFrame, model: LogisticRegression) -> pd.DataFrame:
    """ixg and high-danger attempts per (gameId, playerId); all-strength, empty nets excluded."""
    usable = shots[(shots["emptyNet"] == 0) & shots["shooterId"].notna()].copy()
    usable["xg"] = model.predict_proba(design(usable))[:, 1]
    usable["hd"] = (usable["xg"] >= HIGH_DANGER_XG).astype(float)
    out = usable.groupby(["gameId", "shooterId"]).agg(ixg=("xg", "sum"), hdAtt=("hd", "sum")).reset_index()
    return out.rename(columns={"shooterId": "playerId"}).astype({"playerId": "int64"})


def attach_xg(skaters: pd.DataFrame, per_game: pd.DataFrame, covered_games: set[int]) -> pd.DataFrame:
    """Add ixg/hdAtt to skater games: 0 for covered games without attempts, NaN where no pbp."""
    out = skaters.merge(per_game, on=["gameId", "playerId"], how="left")
    covered = out["gameId"].isin(covered_games)
    for col in ("ixg", "hdAtt"):
        out[col] = out[col].where(~covered | out[col].notna(), 0.0)
        out.loc[~covered, col] = np.nan
    return out
