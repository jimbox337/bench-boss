"""Pre-game predictions for one day's NHL games, written to ml/predictions/<date>-<tag>.json.

Uses only data already in data/processed (games before the target date) plus the public
schedule. Likely lineups are the players who dressed in each team's most recent game;
NHL lines and scratches are not published in advance.

Usage: python -m benchboss_ml.predict --date 2026-11-04 --tag v1
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
from typing import Any

import numpy as np
import pandas as pd
import requests

from .dataset import load_processed
from .features import GOALIE_FEATURES, SKATER_TARGETS, goalie_features, shrinkage_reference, shrunk_baseline, skater_baseline, skater_features
from .neural import add_inputs, forward_numpy
from .paths import ML_ROOT, REPORTS_DIR
from .train import DEFAULT_SKATER_SCORING, SKATER_CANDIDATES, fit, predict, prediction_column

PREDICTIONS_DIR = ML_ROOT / "predictions"
# Committed app artifact: Bench Boss Neural's weights for shadow predictions.
APP_ARTIFACT = ML_ROOT.parent / "lib" / "model" / "artifacts" / "bench-boss-model.json"


def shadow_predictions(out: pd.DataFrame, report: dict[str, Any]) -> dict[str, pd.Series] | None:
    """Bench Boss Neural ensemble per stat from the committed artifact, or None when it has no network."""
    if not APP_ARTIFACT.exists():
        return None
    net = json.loads(APP_ARTIFACT.read_text()).get("skater", {}).get("neural")
    if not net:
        return None
    frame = add_inputs(out)
    preds = forward_numpy(net, frame)
    out_cols = {t: preds[:, i] for i, t in enumerate(net["targets"])}
    blend = net["blendWithProductionBaseline"]
    result = {}
    for stat in SKATER_TARGETS:
        ensemble = sum(w * (out_cols[stat] if name == "neural" else out[prediction_column(name, stat)]) for name, w in net["stack"][stat].items())
        result[stat] = (1 - blend) * ensemble + blend * out[f"base_{stat}"]
    return result


def fetch_schedule(date: str) -> list[dict[str, Any]]:
    payload = requests.get(f"https://api-web.nhle.com/v1/schedule/{date}", timeout=20).json()
    games = []
    for day in payload.get("gameWeek", []):
        for game in day.get("games", []):
            if game.get("gameType") == 2:
                games.append({"gameId": game["id"], "date": day["date"], "start": game["startTimeUTC"],
                              "home": game["homeTeam"]["abbrev"], "away": game["awayTeam"]["abbrev"], "state": game.get("gameState")})
    return games


def extend(tables: dict[str, pd.DataFrame], schedule: list[dict[str, Any]], date: str, season: str) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    skaters, goalies, teams = tables["skater_games"], tables["goalie_games"], tables["team_games"]
    target_day = pd.Timestamp(date)
    history = teams[teams["gameDate"] < target_day]
    future_team_rows, tonight_skaters = [], []
    for game in schedule:
        for team, opp, home in ((game["home"], game["away"], 1), (game["away"], game["home"], 0)):
            future_team_rows.append({"gameId": game["gameId"], "season": season, "gameDate": pd.Timestamp(game["date"]), "team": team,
                                     "opp": opp, "home": home, "gf": 0.0, "ga": 0.0, "sf": 0.0, "sa": 0.0, "win": 0})
            if game["date"] != date:
                continue
            last_game = history[history["team"] == team].sort_values("gameDate").iloc[-1]["gameId"]
            dressed = skaters[(skaters["gameId"] == last_game) & (skaters["team"] == team)]
            for row in dressed.itertuples(index=False):
                tonight_skaters.append({**{c: 0.0 for c in ("goals", "assists", "points", "ppPoints", "shots", "hits", "blocks", "pim", "plusMinus", "toi", "ppToi")},
                                        "gameId": game["gameId"], "season": season, "gameDate": target_day, "playerId": row.playerId,
                                        "name": row.name, "position": row.position, "positionCode": row.positionCode,
                                        "team": team, "opp": opp, "home": home})
    teams_ext = pd.concat([history, pd.DataFrame(future_team_rows)], ignore_index=True)
    skaters_ext = pd.concat([skaters[skaters["gameDate"] < target_day], pd.DataFrame(tonight_skaters)], ignore_index=True)
    return skaters_ext, goalies[goalies["gameDate"] < target_day], teams_ext


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--date", required=True)
    parser.add_argument("--tag", required=True)
    parser.add_argument("--games", nargs="*", type=int, help="Only these game ids (e.g. games not yet started)")
    args = parser.parse_args(argv)

    report = json.loads((REPORTS_DIR / "evaluation.json").read_text())
    split = report["split"]
    completed = split["train"] + [split["validation"], split["test"]]
    season = split["live"]
    tables = load_processed()
    schedule = fetch_schedule(args.date)
    tonight = [g for g in schedule if g["date"] == args.date and (not args.games or g["gameId"] in args.games)]
    keep_ids = {g["gameId"] for g in tonight}
    schedule = [g for g in schedule if g["date"] != args.date or g["gameId"] in keep_ids]
    made_at = dt.datetime.now(dt.timezone.utc)
    late = [g for g in tonight if pd.Timestamp(g["start"]) <= made_at]
    if late:
        raise SystemExit(f"Refusing: games already started {[g['gameId'] for g in late]}")

    skaters_ext, goalies_hist, teams_ext = extend(tables, schedule, args.date, season)
    feats = skater_features(skaters_ext, teams_ext)
    fit_rows = feats["season"].isin(completed + [season]) & (feats["gameDate"] < pd.Timestamp(args.date))
    target_rows = feats["gameId"].isin(keep_ids)
    train_frame = feats[fit_rows].copy()
    out = feats[target_rows].copy()
    for stat in SKATER_TARGETS:
        train_seasons = feats[feats["season"].isin(split["train"])]
        fallback = train_seasons.groupby("position")[stat].mean().to_dict()
        info = report["skater"]["targets"][stat]
        reference = shrinkage_reference(train_seasons, stat)
        for frame in (train_frame, out):
            frame[f"base_{stat}"] = skater_baseline(frame, stat, fallback)
            frame[f"shr_{stat}"] = shrunk_baseline(frame, stat, info.get("shrinkK", 10.0), reference, info.get("priorWeight", 0.0), info.get("seasonWeight", 0.45))
        selected = info["selected"]
        components = info.get("stackWeights", {}) if selected == "stack" else {selected: 1.0}
        shadow_stack = report["skater"].get("neural", {}).get("stackWeights", {}).get(stat, {})
        for name in set(components) | set(shadow_stack):
            if name in SKATER_CANDIDATES:
                spec = SKATER_CANDIDATES[name]
                init = f"{spec['init']}_{stat}" if spec["init"] else None
                booster = fit(train_frame, spec["features"], stat, "poisson", rounds=info["trees"][name], init_col=init, params=spec["params"])
                out[f"{name}_{stat}"] = predict(booster, out, spec["features"], init)
        out[f"model_{stat}"] = sum(w * out[prediction_column(name, stat)] for name, w in components.items())
    # Same rank-aware blend with the production baseline that was chosen on validation.
    model_weight = report["skater"].get("blend", {}).get("chosenModelWeight", 1.0)
    for stat in SKATER_TARGETS:
        out[f"model_{stat}"] = model_weight * out[f"model_{stat}"] + (1 - model_weight) * out[f"base_{stat}"]
    # Shadow: the Bench Boss Neural ensemble, recorded for live tracking but never shown.
    shadow = shadow_predictions(out, report)
    if shadow is not None:
        for stat in SKATER_TARGETS:
            out[f"nn_{stat}"] = shadow[stat]
    prefixes = ("base", "model", "nn") if shadow is not None else ("base", "model")
    for prefix in prefixes:
        out[f"{prefix}_fp"] = sum(out[f"{prefix}_{s}"] * w for s, w in DEFAULT_SKATER_SCORING.items())

    gfeats = goalie_features(goalies_hist, teams_ext)
    g_train = gfeats[gfeats["season"].isin(completed + [season]) & (gfeats["gameDate"] < pd.Timestamp(args.date))]
    g_out = gfeats[gfeats["gameId"].isin(keep_ids)].copy()
    for target, info in report["goalie"]["targets"].items():
        objective = "binary" if target in ("started", "win", "shutout") else "poisson"
        rows = g_train if target == "started" else g_train[g_train["started"] == 1]
        booster = fit(rows.dropna(subset=[target]), GOALIE_FEATURES, target, objective, rounds=info["bestIteration"])
        g_out[f"model_{target}"] = booster.predict(g_out[list(GOALIE_FEATURES)])
    total = g_out.groupby(["gameId", "team"])["model_started"].transform("sum")
    g_out["model_start_prob"] = g_out["model_started"] / total
    names = tables["goalie_games"].drop_duplicates("playerId", keep="last").set_index("playerId")["name"]

    payload = {
        "date": args.date, "tag": args.tag, "madeAt": made_at.isoformat(), "modelReport": report["modelVersion"],
        "dataThrough": str(tables["skater_games"]["gameDate"].max().date()),
        "games": tonight,
        "note": "Skater projections are conditional on dressing; lineup = players who dressed in the team's last game.",
        "skaters": [
            {"gameId": int(r.gameId), "playerId": int(r.playerId), "name": r.name, "team": r.team, "opp": r.opp, "position": r.position,
             **{f"model_{s}": round(float(getattr(r, f"model_{s}")), 4) for s in SKATER_TARGETS},
             **{f"base_{s}": round(float(getattr(r, f"base_{s}")), 4) for s in SKATER_TARGETS},
             "model_fp": round(float(r.model_fp), 3), "base_fp": round(float(r.base_fp), 3),
             **({f"nn_{s}": round(float(getattr(r, f"nn_{s}")), 4) for s in [*SKATER_TARGETS, "fp"]} if shadow is not None else {})}
            for r in out.itertuples(index=False)
        ],
        "goalies": [
            {"gameId": int(r.gameId), "playerId": int(r.playerId), "name": names.get(r.playerId, str(r.playerId)), "team": r.team,
             "startProb": round(float(r.model_start_prob), 3), "usageShareL10": round(float(r.share_l10), 3),
             "savesIfStart": round(float(r.model_saves), 2), "gaIfStart": round(float(r.model_ga), 2),
             "winIfStart": round(float(r.model_win), 3), "shutoutIfStart": round(float(r.model_shutout), 3)}
            for r in g_out.itertuples(index=False)
        ],
    }
    PREDICTIONS_DIR.mkdir(parents=True, exist_ok=True)
    path = PREDICTIONS_DIR / f"{args.date}-{args.tag}.json"
    text = json.dumps(payload, indent=2)
    path.write_text(text)
    print(f"Wrote {path}  sha256={hashlib.sha256(text.encode()).hexdigest()}  madeAt={payload['madeAt']}")
    print(f"{len(payload['skaters'])} skaters, {len(payload['goalies'])} goalie candidates")
    top = out.sort_values("model_fp", ascending=False).head(12)
    print(top[["name", "team", "opp", "model_goals", "model_assists", "model_shots", "model_fp", "base_fp"]].round(3).to_string(index=False))
    gshow = g_out.sort_values(["gameId", "model_start_prob"], ascending=[True, False])
    gshow = gshow.assign(name=gshow["playerId"].map(names))
    print(gshow[["team", "name", "model_start_prob", "share_l10", "model_saves", "model_ga", "model_win"]].round(3).to_string(index=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
