"""Score locked pre-game predictions against final NHL results.

Usage: python -m benchboss_ml.score --date 2026-11-04 --tags v1 v2
"""
from __future__ import annotations

import argparse
import json
import math
from urllib.parse import quote

import numpy as np
import pandas as pd
import requests

from .collect import USER_AGENT
from .features import SKATER_TARGETS
from .predict import PREDICTIONS_DIR
from .train import DEFAULT_SKATER_SCORING

BASE = "https://api.nhle.com/stats/rest/en"


def fetch(report: str, date: str) -> pd.DataFrame:
    expression = quote(f'gameDate="{date}" and gameTypeId=2')
    response = requests.get(f"{BASE}/{report}?isAggregate=false&isGame=true&limit=-1&cayenneExp={expression}",
                            headers={"User-Agent": USER_AGENT}, timeout=30)
    response.raise_for_status()
    return pd.DataFrame(response.json().get("data", []))


def actuals(date: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    summary, realtime, goalies = fetch("skater/summary", date), fetch("skater/realtime", date), fetch("goalie/summary", date)
    skaters = summary.merge(realtime[["gameId", "playerId", "hits", "blockedShots"]], on=["gameId", "playerId"], how="left")
    skaters = skaters.rename(columns={"blockedShots": "blocks"})
    skaters = skaters[["gameId", "playerId", "goals", "assists", "ppPoints", "shots", "hits", "blocks"]]
    skaters["fp"] = sum(skaters[s] * w for s, w in DEFAULT_SKATER_SCORING.items())
    return skaters, goalies


def final_game_ids(date: str) -> set[int]:
    """Only games the NHL marks final; in-progress games would be scored on partial stats."""
    games = requests.get(f"https://api-web.nhle.com/v1/score/{date}", headers={"User-Agent": USER_AGENT}, timeout=30).json().get("games", [])
    return {g["id"] for g in games if g.get("gameState") in ("OFF", "FINAL")}


def score(date: str, tag: str, skaters: pd.DataFrame, goalies: pd.DataFrame, final_ids: set[int]) -> dict:
    payload = json.loads((PREDICTIONS_DIR / f"{date}-{tag}.json").read_text())
    final_games = set(skaters["gameId"]) & final_ids
    pred = pd.DataFrame(payload["skaters"])
    pred = pred[pred["gameId"].isin(final_games)]
    merged = pred.merge(skaters, on=["gameId", "playerId"], how="left", indicator=True)
    dressed = merged[merged["_merge"] == "both"]
    out = {"tag": tag, "madeAt": payload["madeAt"], "games": sorted(int(g) for g in pred["gameId"].unique()),
           "predictedSkaters": len(pred), "dressed": len(dressed),
           "notDressed": merged.loc[merged["_merge"] == "left_only", "name"].tolist(), "stats": {}}
    for stat in list(SKATER_TARGETS) + ["fp"]:
        y = dressed[stat].to_numpy(float)
        model, base = dressed[f"model_{stat}"].to_numpy(float), dressed[f"base_{stat}"].to_numpy(float)
        out["stats"][stat] = {
            "actualMean": float(y.mean()), "modelMean": float(model.mean()), "baselineMean": float(base.mean()),
            "modelMae": float(np.mean(np.abs(y - model))), "baselineMae": float(np.mean(np.abs(y - base))),
            "modelRmse": float(math.sqrt(np.mean((y - model) ** 2))), "baselineRmse": float(math.sqrt(np.mean((y - base) ** 2))),
        }
    rank = dressed[["fp", "model_fp", "base_fp"]].rank()
    out["fpSpearman"] = {"model": float(rank["fp"].corr(rank["model_fp"])), "baseline": float(rank["fp"].corr(rank["base_fp"]))}
    out["topPerformers"] = dressed.sort_values("fp", ascending=False).head(8)[["name", "team", "fp", "model_fp", "base_fp"]].round(2).to_dict("records")
    out["biggestMisses"] = dressed.assign(err=dressed["fp"] - dressed["model_fp"]).sort_values("err").iloc[[0, 1, -2, -1]][["name", "team", "fp", "model_fp", "base_fp"]].round(2).to_dict("records")

    gpred = pd.DataFrame(payload["goalies"])
    gpred = gpred[gpred["gameId"].isin(final_games)]
    starters = goalies[goalies["gamesStarted"] > 0][["gameId", "playerId", "teamAbbrev", "saves", "goalsAgainst", "wins", "shutouts"]]
    results = []
    for (game_id, team), group in gpred.groupby(["gameId", "team"]):
        actual = starters[(starters["gameId"] == game_id) & (starters["teamAbbrev"] == team)]
        pick = group.sort_values("startProb", ascending=False).iloc[0]
        usage_pick = group.sort_values("usageShareL10", ascending=False).iloc[0]
        row = {"team": team, "modelPick": pick["name"], "modelProb": float(pick["startProb"]), "usagePick": usage_pick["name"]}
        if not actual.empty:
            starter = actual.iloc[0]
            row.update({"actualStarter": int(starter["playerId"]), "modelCorrect": bool(pick["playerId"] == starter["playerId"]),
                        "usageCorrect": bool(usage_pick["playerId"] == starter["playerId"]),
                        "probOnActualStarter": float(group.loc[group["playerId"] == starter["playerId"], "startProb"].sum())})
            match = group[group["playerId"] == starter["playerId"]]
            if not match.empty:
                row.update({"savesPred": float(match.iloc[0]["savesIfStart"]), "savesActual": float(starter["saves"]),
                            "gaPred": float(match.iloc[0]["gaIfStart"]), "gaActual": float(starter["goalsAgainst"]),
                            "winProb": float(match.iloc[0]["winIfStart"]), "won": int(starter["wins"])})
        results.append(row)
    out["goalies"] = results
    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--date", required=True)
    parser.add_argument("--tags", nargs="+", required=True)
    args = parser.parse_args(argv)
    skaters, goalies = actuals(args.date)
    final_ids = final_game_ids(args.date)
    if skaters.empty or not final_ids:
        raise SystemExit("No final results yet.")
    results = [score(args.date, tag, skaters, goalies, final_ids) for tag in args.tags]
    path = PREDICTIONS_DIR / f"{args.date}-scored.json"
    path.write_text(json.dumps(results, indent=2, default=str))
    for r in results:
        print(f"\n=== {r['tag']} (locked {r['madeAt']}) games={r['games']} dressed {r['dressed']}/{r['predictedSkaters']}")
        print(f"{'stat':10} {'actual':>7} {'model':>7} {'base':>7} | {'MAE model':>9} {'MAE base':>9} | {'RMSE model':>10} {'RMSE base':>9}")
        for stat, m in r["stats"].items():
            print(f"{stat:10} {m['actualMean']:7.3f} {m['modelMean']:7.3f} {m['baselineMean']:7.3f} | {m['modelMae']:9.3f} {m['baselineMae']:9.3f} | {m['modelRmse']:10.3f} {m['baselineRmse']:9.3f}")
        print("FP rank correlation:", {k: round(v, 3) for k, v in r["fpSpearman"].items()})
        print("Not dressed:", r["notDressed"])
        print("Top performers:", r["topPerformers"])
        for g in r["goalies"]:
            print("  goalie", g)
    print(f"\nWrote {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
