"""Collect unblocked shot attempts (with rink coordinates) from NHL play-by-play.

One request per game to https://api-web.nhle.com/v1/gamecenter/{id}/play-by-play, throttled.
Resumable: games already stored in data/raw/pbp_shots/<season>.csv.gz are skipped, and only
final games are fetched, so re-running picks up new games without duplicates.

Usage: python -m benchboss_ml.collect_pbp --seasons 20212022 20222023 20232024 20242025 20252026 20262027
"""
from __future__ import annotations

import argparse
import math
import time
from typing import Any

import pandas as pd
import requests

from .collect import REQUEST_DELAY_S, USER_AGENT, fetch_json, read_existing, write_dataset
from .dataset import load_processed
from .paths import RAW_DIR

SHOT_TYPES = {"goal", "shot-on-goal", "missed-shot"}
COLUMNS = ("gameId", "eventId", "period", "seconds", "team", "isHome", "shooterId", "kind", "shotType",
           "x", "y", "distance", "angle", "strength", "emptyNet", "rebound", "goal")


def strength_from_situation(code: str | None, is_home: bool) -> tuple[str, bool]:
    """situationCode digits: away goalie, away skaters, home skaters, home goalie."""
    if not code or len(code) != 4 or not code.isdigit():
        return "ev", False
    away_goalie, away_sk, home_sk, home_goalie = (int(c) for c in code)
    own, opp = (home_sk, away_sk) if is_home else (away_sk, home_sk)
    opp_goalie = away_goalie if is_home else home_goalie
    strength = "pp" if own > opp else "sh" if own < opp else "ev"
    return strength, opp_goalie == 0


def shot_geometry(x: float, y: float, attacking_net_x: float) -> tuple[float, float]:
    """Distance (ft) and angle (degrees from the centre line) to the net being attacked."""
    dx = abs(attacking_net_x - x)
    return math.hypot(dx, y), math.degrees(math.atan2(abs(y), dx)) if dx or y else 0.0


def parse_game(payload: dict[str, Any]) -> list[dict[str, Any]]:
    home_id, away_id = payload.get("homeTeam", {}).get("id"), payload.get("awayTeam", {}).get("id")
    abbrev = {home_id: payload.get("homeTeam", {}).get("abbrev"), away_id: payload.get("awayTeam", {}).get("abbrev")}
    rows: list[dict[str, Any]] = []
    last_shot: dict[Any, float] = {}
    for play in payload.get("plays", []):
        kind = play.get("typeDescKey")
        details = play.get("details") or {}
        period = (play.get("periodDescriptor") or {}).get("number", 0)
        if (play.get("periodDescriptor") or {}).get("periodType") == "SO":
            continue
        mm, ss = (play.get("timeInPeriod") or "0:0").split(":")
        seconds = (period - 1) * 1200 + int(mm) * 60 + int(ss)
        team_id = details.get("eventOwnerTeamId")
        if kind == "blocked-shot":
            last_shot[team_id] = seconds
            continue
        if kind not in SHOT_TYPES or details.get("xCoord") is None or details.get("yCoord") is None:
            continue
        is_home = team_id == home_id
        defending = play.get("homeTeamDefendingSide")
        if defending not in ("left", "right"):
            continue
        # Home defends the left net (x=-89) => home attacks x=+89; away attacks the other end.
        attacking_x = 89.0 if (is_home == (defending == "left")) else -89.0
        distance, angle = shot_geometry(float(details["xCoord"]), float(details["yCoord"]), attacking_x)
        strength, empty_net = strength_from_situation(play.get("situationCode"), is_home)
        rebound = team_id in last_shot and 0 <= seconds - last_shot[team_id] <= 3
        rows.append({
            "gameId": payload.get("id"), "eventId": play.get("eventId"), "period": period, "seconds": seconds,
            "team": abbrev.get(team_id), "isHome": int(is_home),
            "shooterId": details.get("scoringPlayerId") or details.get("shootingPlayerId"),
            "kind": kind, "shotType": details.get("shotType") or "unknown",
            "x": details["xCoord"], "y": details["yCoord"], "distance": round(distance, 2), "angle": round(angle, 2),
            "strength": strength, "emptyNet": int(empty_net), "rebound": int(rebound), "goal": int(kind == "goal"),
        })
        last_shot[team_id] = seconds
    return rows


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seasons", nargs="+", required=True)
    args = parser.parse_args(argv)
    teams = load_processed()["team_games"]
    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT
    for season in args.seasons:
        path = RAW_DIR / "pbp_shots" / f"{season}.csv.gz"
        existing = read_existing(path)
        done = set(existing["gameId"].unique()) if not existing.empty else set()
        game_ids = sorted(set(teams.loc[teams["season"] == season, "gameId"]) - done)
        print(f"[{season}] {len(done)} stored, {len(game_ids)} to fetch", flush=True)
        batch: list[dict[str, Any]] = []
        for i, game_id in enumerate(game_ids, 1):
            try:
                payload = fetch_json(session, f"https://api-web.nhle.com/v1/gamecenter/{game_id}/play-by-play")
            except RuntimeError as error:
                print(f"  skip {game_id}: {error}", flush=True)
                continue
            if payload.get("gameState") not in ("OFF", "FINAL"):
                continue
            batch.extend(parse_game(payload))
            time.sleep(REQUEST_DELAY_S * 0.6)
            if i % 200 == 0 or i == len(game_ids):
                frame = pd.concat([existing, pd.DataFrame(batch, columns=list(COLUMNS))], ignore_index=True)
                frame = frame.drop_duplicates(["gameId", "eventId"], keep="last").sort_values(["gameId", "eventId"])
                write_dataset(frame, path)
                existing, batch = frame, []
                print(f"  [{season}] {i}/{len(game_ids)} games, {len(frame)} shots", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
