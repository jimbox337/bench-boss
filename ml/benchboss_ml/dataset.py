"""Normalize raw NHL report files into tidy skater, goalie and team game tables."""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

import numpy as np
import pandas as pd

from . import PIPELINE_VERSION
from .paths import MANIFEST_PATH, PROCESSED_DIR, RAW_DIR

POSITION_MAP = {"C": "C", "L": "W", "R": "W", "D": "D"}


def _read_report(name: str) -> pd.DataFrame:
    files = sorted((RAW_DIR / name).glob("*.csv.gz"))
    frames = []
    for path in files:
        frame = pd.read_csv(path, compression="gzip")
        frame["season"] = path.name.split(".")[0]
        frames.append(frame)
    if not frames:
        raise FileNotFoundError(f"No raw files for {name}. Run `python -m benchboss_ml.collect` first.")
    return pd.concat(frames, ignore_index=True)


def build_skater_games(summary: pd.DataFrame, realtime: pd.DataFrame, toi: pd.DataFrame) -> pd.DataFrame:
    frame = summary.merge(realtime.drop(columns=["season"], errors="ignore"), on=["gameId", "playerId"], how="left")
    frame = frame.merge(toi.drop(columns=["season"], errors="ignore"), on=["gameId", "playerId"], how="left")
    toi_seconds = frame["timeOnIce"].fillna(frame["timeOnIcePerGame"])
    out = pd.DataFrame({
        "gameId": frame["gameId"].astype("int64"),
        "season": frame["season"].astype(str),
        "gameDate": pd.to_datetime(frame["gameDate"]),
        "playerId": frame["playerId"].astype("int64"),
        "name": frame["skaterFullName"],
        "position": frame["positionCode"].map(POSITION_MAP).fillna("W"),
        "positionCode": frame["positionCode"],
        "team": frame["teamAbbrev"],
        "opp": frame["opponentTeamAbbrev"],
        "home": (frame["homeRoad"] == "H").astype("int8"),
        "goals": frame["goals"].fillna(0),
        "assists": frame["assists"].fillna(0),
        "points": frame["points"].fillna(0),
        "ppPoints": frame["ppPoints"].fillna(0),
        "shots": frame["shots"].fillna(0),
        "hits": frame["hits"].fillna(0),
        "blocks": frame["blockedShots"].fillna(0),
        "pim": frame["penaltyMinutes"].fillna(0),
        "plusMinus": frame["plusMinus"].fillna(0),
        "toi": toi_seconds.fillna(0) / 60.0,
        "ppToi": frame["ppTimeOnIce"].fillna(0) / 60.0,
    })
    out = out.drop_duplicates(["gameId", "playerId"], keep="last")
    return out.sort_values(["playerId", "gameDate", "gameId"]).reset_index(drop=True)


def build_goalie_games(goalies: pd.DataFrame) -> pd.DataFrame:
    out = pd.DataFrame({
        "gameId": goalies["gameId"].astype("int64"),
        "season": goalies["season"].astype(str),
        "gameDate": pd.to_datetime(goalies["gameDate"]),
        "playerId": goalies["playerId"].astype("int64"),
        "name": goalies["goalieFullName"],
        "team": goalies["teamAbbrev"],
        "opp": goalies["opponentTeamAbbrev"],
        "home": (goalies["homeRoad"] == "H").astype("int8"),
        "started": goalies["gamesStarted"].fillna(0).clip(0, 1).astype("int8"),
        "win": goalies["wins"].fillna(0).clip(0, 1).astype("int8"),
        "saves": goalies["saves"].fillna(0),
        "shotsAgainst": goalies["shotsAgainst"].fillna(0),
        "ga": goalies["goalsAgainst"].fillna(0),
        "shutout": goalies["shutouts"].fillna(0).clip(0, 1).astype("int8"),
        "toi": goalies["timeOnIce"].fillna(0) / 60.0,
    })
    out = out.drop_duplicates(["gameId", "playerId"], keep="last")
    return out.sort_values(["playerId", "gameDate", "gameId"]).reset_index(drop=True)


def build_team_games(teams: pd.DataFrame, skaters: pd.DataFrame) -> pd.DataFrame:
    """Team report has no abbreviation, so map (gameId, home/road) from skater rows."""
    side = skaters[["gameId", "home", "team"]].drop_duplicates(["gameId", "home"])
    frame = teams.assign(home=(teams["homeRoad"] == "H").astype("int8"))
    frame = frame.merge(side, on=["gameId", "home"], how="inner")
    out = pd.DataFrame({
        "gameId": frame["gameId"].astype("int64"),
        "season": frame["season"].astype(str),
        "gameDate": pd.to_datetime(frame["gameDate"]),
        "team": frame["team"],
        "opp": frame["opponentTeamAbbrev"],
        "home": frame["home"],
        "gf": frame["goalsFor"].astype(float),
        "ga": frame["goalsAgainst"].astype(float),
        "sf": frame["shotsForPerGame"].astype(float),
        "sa": frame["shotsAgainstPerGame"].astype(float),
        "win": frame["wins"].fillna(0).astype("int8"),
    })
    out = out.drop_duplicates(["gameId", "team"], keep="last")
    return out.sort_values(["team", "gameDate", "gameId"]).reset_index(drop=True)


def build_all(out_dir: Path = PROCESSED_DIR) -> dict[str, pd.DataFrame]:
    skaters = build_skater_games(_read_report("skater_summary"), _read_report("skater_realtime"), _read_report("skater_toi"))
    goalies = build_goalie_games(_read_report("goalie_summary"))
    teams = build_team_games(_read_report("team_summary"), skaters)
    out_dir.mkdir(parents=True, exist_ok=True)
    tables = {"skater_games": skaters, "goalie_games": goalies, "team_games": teams}
    for name, table in tables.items():
        table.to_parquet(out_dir / f"{name}.parquet", index=False)
    manifest = json.loads(MANIFEST_PATH.read_text()) if MANIFEST_PATH.exists() else {}
    manifest["processed"] = {
        "builtAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "pipelineVersion": PIPELINE_VERSION,
        **{name: {"rows": int(len(t)), "games": int(t["gameId"].nunique()),
                  "firstDate": str(t["gameDate"].min().date()), "lastDate": str(t["gameDate"].max().date())}
           for name, t in tables.items()},
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, sort_keys=True))
    return tables


def load_processed(out_dir: Path = PROCESSED_DIR) -> dict[str, pd.DataFrame]:
    return {name: pd.read_parquet(out_dir / f"{name}.parquet") for name in ("skater_games", "goalie_games", "team_games")}


if __name__ == "__main__":
    tables = build_all()
    for name, table in tables.items():
        print(name, len(table), "rows", table["gameId"].nunique(), "games")
    assert not tables["skater_games"].duplicated(["gameId", "playerId"]).any()
    assert np.isfinite(tables["team_games"]["gf"]).all()
