"""Export a feature-parity fixture for the TypeScript runtime (lib/model/features.ts).

Picks one game day from the in-progress season, writes the raw inputs the server would
collect (current-season rows before that day for the teams involved, season and previous
season totals, team totals and the schedule), and the features Python training computes
for every skater who played that day. lib/model/features.test.ts recomputes and compares.

Usage: python -m benchboss_ml.export_parity [--date YYYY-MM-DD]
"""
from __future__ import annotations

import argparse
import json
import math

import pandas as pd

from .availability import AVAILABILITY_FEATURES, availability_rows
from .dataset import load_processed
from .features import GOALIE_FEATURES, RATE_STATS_FOR_EXPORT, SKATER_FEATURES, goalie_features, skater_features
from .paths import ML_ROOT

FIXTURE = ML_ROOT.parent / "lib" / "model" / "__fixtures__" / "parity.json"


def clean(value):
    return None if value is None or (isinstance(value, float) and math.isnan(value)) else round(float(value), 10)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--date")
    args = parser.parse_args(argv)
    t = load_processed()
    skaters, teams, goalies = t["skater_games"], t["team_games"], t["goalie_games"]
    season = sorted(skaters["season"].unique())[-1]
    prev_season = f"{int(season[:4]) - 1}{season[:4]}"
    cur = skaters[skaters["season"] == season]
    dates = sorted(cur["gameDate"].dt.strftime("%Y-%m-%d").unique())
    date = args.date or dates[-2]
    day = pd.Timestamp(date)
    games = teams[(teams["season"] == season) & (teams["gameDate"] == day)]
    involved = set(games["team"])

    feats = skater_features(skaters, teams)
    target = feats[(feats["gameDate"] == day) & feats["team"].isin(involved)]
    avail = availability_rows(skaters, teams)
    avail = avail[(avail["gameDate"] == day) & avail["team"].isin(involved)]
    players = set(target["playerId"]) | set(avail["playerId"])

    prior = cur[cur["gameDate"] < day]
    team_game_ids = set(teams[(teams["season"] == season) & (teams["gameDate"] < day) & teams["team"].isin(involved)]["gameId"])
    rows = prior[prior["gameId"].isin(team_game_ids) | prior["playerId"].isin(players)]
    team_rows = teams[(teams["season"] == season) & (teams["gameDate"] < day) & teams["team"].isin(involved)]
    upcoming = teams[(teams["season"] == season) & (teams["gameDate"] >= day) & (teams["gameDate"] < day + pd.Timedelta(days=8)) & teams["team"].isin(involved)]
    # Every game an involved team plays in the window, described from the home side.
    schedule = teams[teams["gameId"].isin(set(upcoming["gameId"])) & (teams["home"] == 1)][["gameId", "gameDate", "team", "opp"]]

    gfeats = goalie_features(goalies, teams)
    gtarget = gfeats[(gfeats["gameDate"] == day) & gfeats["team"].isin(involved)]
    goalie_ids = set(gtarget["playerId"])
    cur_goalies = goalies[(goalies["season"] == season) & (goalies["gameDate"] < day)]
    goalie_rows = cur_goalies[cur_goalies["team"].isin(involved) | cur_goalies["playerId"].isin(goalie_ids)]
    prev_starts = goalies[(goalies["season"] == prev_season) & (goalies["started"] == 1) & goalies["playerId"].isin(goalie_ids)]

    def totals(frame: pd.DataFrame) -> dict[str, dict]:
        out = {}
        for pid, g in frame.groupby("playerId"):
            out[str(int(pid))] = {"gp": int(len(g)), **{s: float(g[s].sum()) for s in RATE_STATS_FOR_EXPORT}}
        return out

    payload = {
        "date": date, "season": season,
        "skaterRows": [{"gameId": int(r.gameId), "date": r.gameDate.strftime("%Y-%m-%d"), "playerId": int(r.playerId), "team": r.team, "opp": r.opp,
                        "home": int(r.home), "position": r.position, **{s: float(getattr(r, s)) for s in RATE_STATS_FOR_EXPORT}} for r in rows.itertuples()],
        "teamRows": [{"gameId": int(r.gameId), "date": r.gameDate.strftime("%Y-%m-%d"), "team": r.team, "opp": r.opp, "home": int(r.home),
                      "gf": float(r.gf), "ga": float(r.ga), "sf": float(r.sf), "sa": float(r.sa)} for r in team_rows.itertuples()],
        "seasonTotals": totals(prior[prior["playerId"].isin(players)]),
        "prevSeasonTotals": totals(skaters[(skaters["season"] == prev_season) & skaters["playerId"].isin(players)]),
        "teamTotals": {team: {"gp": int(len(g)), **{c: float(g[c].sum()) for c in ("gf", "ga", "sf", "sa")}}
                       for team, g in teams[(teams["season"] == season) & (teams["gameDate"] < day) & teams["team"].isin(involved)].groupby("team")},
        "schedule": [{"gameId": int(r.gameId), "date": r.gameDate.strftime("%Y-%m-%d"), "home": r.team, "away": r.opp} for r in schedule.itertuples()],
        "expectedSkaters": [{"playerId": int(r.playerId), "team": r.team, "opp": r.opp, "home": int(r.home), "position": r.position,
                             "features": {f: clean(getattr(r, f)) for f in SKATER_FEATURES}} for r in target.itertuples()],
        "goalieRows": [{"gameId": int(r.gameId), "date": r.gameDate.strftime("%Y-%m-%d"), "playerId": int(r.playerId), "team": r.team, "opp": r.opp,
                        "home": int(r.home), "started": int(r.started), "win": int(r.win), "saves": float(r.saves), "shotsAgainst": float(r.shotsAgainst),
                        "ga": float(r.ga), "toi": float(r.toi)} for r in goalie_rows.itertuples()],
        "prevGoalieTotals": {str(int(pid)): {"starts": int(len(g)), "saves": float(g["saves"].sum()), "shotsAgainst": float(g["shotsAgainst"].sum())}
                             for pid, g in prev_starts.groupby("playerId")},
        "expectedGoalies": [{"playerId": int(r.playerId), "team": r.team, "opp": r.opp, "home": int(r.home),
                             "features": {f: clean(getattr(r, f)) for f in GOALIE_FEATURES}} for r in gtarget.itertuples()],
        "expectedAvailability": [{"playerId": int(r.playerId), "team": r.team, "home": int(r.home), "position": r.position,
                                  "features": {f: clean(getattr(r, f)) for f in AVAILABILITY_FEATURES}} for r in avail.itertuples()],
    }
    FIXTURE.parent.mkdir(parents=True, exist_ok=True)
    FIXTURE.write_text(json.dumps(payload, separators=(",", ":")))
    print(f"Wrote {FIXTURE} ({FIXTURE.stat().st_size / 1024:.0f} KB): {len(payload['expectedSkaters'])} skaters, "
          f"{len(payload['expectedAvailability'])} availability rows, {len(payload['expectedGoalies'])} goalie candidates, {len(payload['skaterRows'])} input rows, date {date}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
