"""Daily lock-and-score: build a live, out-of-sample track record.

1. Incrementally collect the current season (game stats, and play-by-play shots).
2. Rebuild the processed dataset.
3. Lock predictions for every game today that has not started (predict refuses started games).
4. Score yesterday's locked predictions against final results (only games marked final).
5. Append a one-line summary to ml/predictions/daily-log.jsonl.

Run it any time before the first puck drop, e.g. late morning:
  cd ml && .venv/bin/python -m benchboss_ml.daily
It is safe to re-run: collection is incremental and a date's predictions are only written
once per tag (re-running after puck drop locks nothing new).
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path
from zoneinfo import ZoneInfo

import pandas as pd
import requests

from . import collect, collect_pbp, dataset, predict, score
from .paths import PROCESSED_DIR, REPORTS_DIR
from .predict import PREDICTIONS_DIR, fetch_schedule

LOG_PATH = PREDICTIONS_DIR / "daily-log.jsonl"


def current_season() -> str:
    payload = requests.get("https://api-web.nhle.com/v1/standings/now", timeout=20).json()
    return str(payload["standings"][0]["seasonId"])


def lock_today(date: str, tag: str) -> dict:
    path = PREDICTIONS_DIR / f"{date}-{tag}.json"
    if path.exists():
        return {"locked": False, "reason": "already locked", "file": str(path.name)}
    now = pd.Timestamp.now(tz="UTC")
    upcoming = [g for g in fetch_schedule(date) if g["date"] == date and pd.Timestamp(g["start"]) > now]
    if not upcoming:
        return {"locked": False, "reason": "no games left to predict"}
    predict.main(["--date", date, "--tag", tag, "--games", *[str(g["gameId"]) for g in upcoming]])
    return {"locked": True, "games": len(upcoming), "file": path.name}


def score_day(date: str) -> dict:
    tags = sorted(p.stem.removeprefix(f"{date}-") for p in PREDICTIONS_DIR.glob(f"{date}-*.json") if not p.stem.endswith("scored"))
    if not tags:
        return {"scored": False, "reason": "no locked predictions"}
    try:
        score.main(["--date", date, "--tags", *tags])
    except SystemExit as stop:
        return {"scored": False, "reason": str(stop)}
    results = json.loads((PREDICTIONS_DIR / f"{date}-scored.json").read_text())
    return {"scored": True, "tags": {
        r["tag"]: {"games": len(r["games"]), "skaters": r["dressed"],
                   "fpMaeModel": round(r["stats"]["fp"]["modelMae"], 3), "fpMaeBaseline": round(r["stats"]["fp"]["baselineMae"], 3),
                   "fpRankModel": round(r["fpSpearman"]["model"], 3), "fpRankBaseline": round(r["fpSpearman"]["baseline"], 3),
                   "goalieStartersCorrect": sum(1 for g in r["goalies"] if g.get("modelCorrect")), "goalieTeams": len(r["goalies"])}
        for r in results}}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--date", help="Local date to lock (default today)")
    parser.add_argument("--tag", default="daily")
    parser.add_argument("--skip-collect", action="store_true")
    parser.add_argument("--no-pbp", action="store_true", help="Skip play-by-play shots (not used by the served model)")
    args = parser.parse_args(argv)
    # NHL game dates are local; use Eastern time so a UTC server picks the right day.
    today = dt.date.fromisoformat(args.date) if args.date else dt.datetime.now(ZoneInfo("America/New_York")).date()
    yesterday = today - dt.timedelta(days=1)
    entry: dict = {"ranAt": dt.datetime.now(dt.timezone.utc).isoformat(), "date": today.isoformat()}
    if not args.skip_collect:
        season = current_season()
        seasons = [season]
        if not (PROCESSED_DIR / "skater_games.parquet").exists():
            # Fresh machine (e.g. a CI runner with an empty cache): collect every season the
            # model was trained on. Incremental runs only touch the current season.
            split = json.loads((REPORTS_DIR / "evaluation.json").read_text())["split"]
            seasons = sorted(set(split["train"] + [split["validation"], split["test"], season]))
            entry["bootstrap"] = seasons
        collect.collect(seasons)
        dataset.build_all()
        if not args.no_pbp:
            collect_pbp.main(["--seasons", season])
        entry["collected"] = season
    entry["lock"] = lock_today(today.isoformat(), args.tag)
    entry["scoreYesterday"] = {"date": yesterday.isoformat(), **score_day(yesterday.isoformat())}
    PREDICTIONS_DIR.mkdir(parents=True, exist_ok=True)
    with Path(LOG_PATH).open("a") as log:
        log.write(json.dumps(entry) + "\n")
    print(json.dumps(entry, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
