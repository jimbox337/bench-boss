"""Collect historical NHL player-game data from the public NHL stats REST API.

Source: https://api.nhle.com/stats/rest/en/{skater|goalie|team}/{report}?isGame=true
These are the same public, unauthenticated endpoints the NHL.com stats pages use.
Requests are throttled and windowed (the API caps a query at 10,000 rows).

Incremental behaviour:
  * Each (report, season, window) fetch is recorded in data/manifest.json with its
    timestamp and row count.
  * Windows that ended more than FINAL_AFTER_DAYS ago are treated as final and are
    skipped on later runs unless --force is supplied.
  * Rows are de-duplicated on their natural key (gameId + playerId, or gameId + team side),
    so re-fetching a window never produces duplicate games.

Usage:
  python -m benchboss_ml.collect --seasons 20222023 20232024 20242025 20252026 20262027
"""
from __future__ import annotations

import argparse
import datetime as dt
import gzip
import io
import json
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import quote

import pandas as pd
import requests

from . import PIPELINE_VERSION
from .paths import MANIFEST_PATH, RAW_DIR

BASE = "https://api.nhle.com/stats/rest/en"
WINDOW_DAYS = 10
FINAL_AFTER_DAYS = 3
REQUEST_DELAY_S = 0.4
USER_AGENT = "BenchBoss-research/1.0 (non-commercial historical analysis)"


@dataclass(frozen=True)
class Report:
    name: str          # local dataset name
    path: str          # REST path
    key: tuple[str, ...]
    columns: tuple[str, ...]


REPORTS: tuple[Report, ...] = (
    Report("skater_summary", "skater/summary", ("gameId", "playerId"), (
        "gameId", "gameDate", "playerId", "skaterFullName", "positionCode", "teamAbbrev",
        "opponentTeamAbbrev", "homeRoad", "goals", "assists", "points", "plusMinus",
        "penaltyMinutes", "ppGoals", "ppPoints", "shGoals", "shPoints", "shots",
        "gameWinningGoals", "timeOnIcePerGame",
    )),
    Report("skater_realtime", "skater/realtime", ("gameId", "playerId"), (
        "gameId", "playerId", "hits", "blockedShots", "giveaways", "takeaways",
        "missedShots", "totalShotAttempts",
    )),
    Report("skater_toi", "skater/timeonice", ("gameId", "playerId"), (
        "gameId", "playerId", "timeOnIce", "evTimeOnIce", "ppTimeOnIce", "shTimeOnIce", "shifts",
    )),
    Report("goalie_summary", "goalie/summary", ("gameId", "playerId"), (
        "gameId", "gameDate", "playerId", "goalieFullName", "teamAbbrev", "opponentTeamAbbrev",
        "homeRoad", "gamesStarted", "wins", "losses", "otLosses", "saves", "shotsAgainst",
        "goalsAgainst", "shutouts", "timeOnIce",
    )),
    Report("team_summary", "team/summary", ("gameId", "homeRoad"), (
        "gameId", "gameDate", "teamId", "teamFullName", "opponentTeamAbbrev", "homeRoad",
        "goalsFor", "goalsAgainst", "shotsForPerGame", "shotsAgainstPerGame", "wins",
        "losses", "otLosses", "powerPlayPct", "penaltyKillPct",
    )),
)


def season_bounds(season: str, today: dt.date) -> tuple[dt.date, dt.date]:
    """Regular-season search bounds. Generous margins (empty windows are cheap) so that
    unusual calendars are covered, e.g. 2020-21 ran January to mid-May."""
    start_year = int(season[:4])
    start = dt.date(start_year, 9, 25)
    end = min(dt.date(start_year + 1, 6, 1), today)
    return start, end


def windows(start: dt.date, end: dt.date, size: int = WINDOW_DAYS) -> list[tuple[dt.date, dt.date]]:
    out: list[tuple[dt.date, dt.date]] = []
    cursor = start
    while cursor <= end:
        stop = min(cursor + dt.timedelta(days=size - 1), end)
        out.append((cursor, stop))
        cursor = stop + dt.timedelta(days=1)
    return out


def build_url(report: Report, season: str, start: dt.date, end: dt.date) -> str:
    expression = (
        f'seasonId={season} and gameTypeId=2 and gameDate>="{start.isoformat()}" '
        f'and gameDate<="{end.isoformat()}"'
    )
    return f"{BASE}/{report.path}?isAggregate=false&isGame=true&limit=-1&cayenneExp={quote(expression)}"


def fetch_json(session: requests.Session, url: str, retries: int = 4) -> dict[str, Any]:
    delay = 1.5
    for attempt in range(retries):
        try:
            response = session.get(url, timeout=30)
            if response.status_code == 200:
                return response.json()
            if response.status_code not in (429, 500, 502, 503, 504):
                raise RuntimeError(f"HTTP {response.status_code} for {url}")
        except (requests.RequestException, ValueError) as error:
            if attempt == retries - 1:
                raise RuntimeError(f"Failed after {retries} attempts: {url}") from error
        time.sleep(delay)
        delay *= 2
    raise RuntimeError(f"Failed after {retries} attempts: {url}")


def load_manifest() -> dict[str, Any]:
    if MANIFEST_PATH.exists():
        return json.loads(MANIFEST_PATH.read_text())
    return {"pipelineVersion": PIPELINE_VERSION, "source": BASE, "windows": {}, "datasets": {}}


def save_manifest(manifest: dict[str, Any]) -> None:
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    manifest["pipelineVersion"] = PIPELINE_VERSION
    manifest["updatedAt"] = dt.datetime.now(dt.timezone.utc).isoformat()
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, sort_keys=True))


def dataset_path(report: Report, season: str) -> Path:
    return RAW_DIR / report.name / f"{season}.csv.gz"


def read_existing(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path, compression="gzip")


def write_dataset(frame: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    buffer = io.BytesIO()
    with gzip.GzipFile(fileobj=buffer, mode="wb", mtime=0) as handle:
        handle.write(frame.to_csv(index=False).encode())
    tmp = path.with_suffix(".tmp")
    tmp.write_bytes(buffer.getvalue())
    tmp.replace(path)


def merge_rows(existing: pd.DataFrame, new_rows: pd.DataFrame, key: tuple[str, ...]) -> pd.DataFrame:
    """Union with newest rows winning; guarantees one row per natural key."""
    if existing.empty:
        merged = new_rows
    elif new_rows.empty:
        merged = existing
    else:
        merged = pd.concat([existing, new_rows], ignore_index=True)
    if merged.empty:
        return merged
    merged = merged.drop_duplicates(subset=list(key), keep="last")
    return merged.sort_values(list(key)).reset_index(drop=True)


def collect(seasons: list[str], force: bool = False, today: dt.date | None = None) -> None:
    today = today or dt.date.today()
    manifest = load_manifest()
    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT
    requests_made = 0

    for season in seasons:
        start, end = season_bounds(season, today)
        if start > today:
            print(f"[{season}] has not started; skipping")
            continue
        for report in REPORTS:
            path = dataset_path(report, season)
            frame = read_existing(path)
            fetched: list[pd.DataFrame] = []
            for w_start, w_end in windows(start, end):
                window_id = f"{report.name}:{season}:{w_start.isoformat()}"
                record = manifest["windows"].get(window_id)
                # Window starts are fixed per season, so a window cut short by "today"
                # keeps its id and is re-fetched until it is safely in the past.
                is_final = (today - w_end).days > FINAL_AFTER_DAYS
                if record and record.get("final") and not force:
                    continue
                url = build_url(report, season, w_start, w_end)
                payload = fetch_json(session, url)
                requests_made += 1
                rows = payload.get("data", [])
                total = payload.get("total", len(rows))
                if total >= 10_000 or len(rows) < total:
                    raise RuntimeError(f"Window {window_id} truncated ({len(rows)}/{total}); reduce WINDOW_DAYS")
                if rows:
                    window_frame = pd.DataFrame(rows)
                    keep = [c for c in report.columns if c in window_frame.columns]
                    fetched.append(window_frame[keep])
                manifest["windows"][window_id] = {
                    "fetchedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
                    "rows": len(rows),
                    "final": bool(is_final),
                    "end": w_end.isoformat(),
                }
                time.sleep(REQUEST_DELAY_S)
            if fetched:
                frame = merge_rows(frame, pd.concat(fetched, ignore_index=True), report.key)
                write_dataset(frame, path)
            manifest["datasets"][f"{report.name}:{season}"] = {
                "path": str(path.relative_to(RAW_DIR.parent)),
                "rows": int(len(frame)),
                "games": int(frame["gameId"].nunique()) if not frame.empty else 0,
                "updatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
            }
            save_manifest(manifest)
            print(f"[{season}] {report.name}: {len(frame)} rows")
    print(f"Done. {requests_made} NHL requests made.")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--seasons", nargs="+", required=True, help="Season ids such as 20242025")
    parser.add_argument("--force", action="store_true", help="Re-fetch windows already marked final")
    args = parser.parse_args(argv)
    for season in args.seasons:
        if len(season) != 8 or not season.isdigit() or int(season[4:]) != int(season[:4]) + 1:
            parser.error(f"Invalid season id: {season}")
    collect(args.seasons, force=args.force)
    return 0


if __name__ == "__main__":
    sys.exit(main())
