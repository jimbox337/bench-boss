"""Availability: will a recently active skater dress for the team's next game?

Game-level stats only contain games a player actually played, so evaluating per-game
projections ignores scratches and injuries. Here every team game gets one row per skater
who appeared for that team in its previous LOOKBACK games of the season, labelled
`played`. Missing a game covers injury, illness, healthy scratch, suspension and
demotion; the NHL public data does not say which.

Roster moves are public at prediction time, so a candidate is dropped from a team's games
once his next appearance is for a different team (a trade). Demotions and long injuries
stay in as misses, because we cannot see them in advance.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .features import team_context

LOOKBACK = 10
MISS_STREAK_CAP = 10

AVAILABILITY_FEATURES: tuple[str, ...] = (
    "played_share_l5", "played_share_l10", "played_prev", "miss_streak", "games_on_team",
    "last_toi", "avg_toi_l5", "pos_D", "rest_days", "b2b", "home",
)


def availability_rows(skaters: pd.DataFrame, team_games: pd.DataFrame) -> pd.DataFrame:
    teams = team_games.sort_values(["team", "gameDate", "gameId"], kind="stable").reset_index(drop=True)
    teams["k"] = teams.groupby(["team", "season"], sort=False).cumcount()
    apps = skaters.merge(teams[["gameId", "team", "k"]], on=["gameId", "team"], how="inner")

    # Next appearance team per player-game, to detect trades (roster moves are public).
    ordered = skaters.sort_values(["playerId", "gameDate", "gameId"], kind="stable")
    next_team = ordered.groupby("playerId")["team"].shift(-1)
    traded_after = ordered.assign(next_team=next_team)
    traded_after = traded_after[traded_after["next_team"].notna() & (traded_after["next_team"] != traded_after["team"])]
    trade_date = traded_after.groupby(["playerId", "team", "season"])["gameDate"].max()

    ctx = team_context(team_games)[["gameId", "team", "rest_days", "b2b"]]
    rows = []
    for (team, season), team_apps in apps.groupby(["team", "season"], sort=False):
        n_games = int(teams[(teams["team"] == team) & (teams["season"] == season)]["k"].max()) + 1
        team_schedule = teams[(teams["team"] == team) & (teams["season"] == season)].set_index("k")
        players = team_apps["playerId"].unique()
        index = {p: i for i, p in enumerate(players)}
        played = np.zeros((len(players), n_games), dtype=bool)
        toi = np.full((len(players), n_games), np.nan)
        played[team_apps["playerId"].map(index).to_numpy(), team_apps["k"].to_numpy()] = True
        toi[team_apps["playerId"].map(index).to_numpy(), team_apps["k"].to_numpy()] = team_apps["toi"].to_numpy()
        position = team_apps.drop_duplicates("playerId").set_index("playerId")["position"]
        first_k = team_apps.groupby("playerId")["k"].min()
        for k in range(1, n_games):
            lo = max(0, k - LOOKBACK)
            window = played[:, lo:k]
            active = window.any(axis=1)
            game = team_schedule.loc[k]
            for i in np.flatnonzero(active):
                player = players[i]
                cutoff = trade_date.get((player, team, season))
                if cutoff is not None and game["gameDate"] > cutoff:
                    continue
                history = played[i, :k]
                last_played = np.flatnonzero(history)
                streak = k - 1 - last_played[-1]
                recent_toi = toi[i, :k][history][-5:]
                rows.append({
                    "gameId": game["gameId"], "gameDate": game["gameDate"], "season": season, "team": team,
                    "playerId": int(player), "position": position[player], "home": float(game["home"]),
                    "played_share_l5": history[max(0, k - 5):].mean(), "played_share_l10": window[i].mean(),
                    "played_prev": float(history[-1]), "miss_streak": float(min(streak, MISS_STREAK_CAP)),
                    "games_on_team": float(k - first_k[player]), "last_toi": float(recent_toi[-1]),
                    "avg_toi_l5": float(recent_toi.mean()), "pos_D": float(position[player] == "D"),
                    "played": int(played[i, k]),
                })
    out = pd.DataFrame(rows).merge(ctx, on=["gameId", "team"], how="left")
    return out.sort_values(["gameDate", "gameId", "playerId"]).reset_index(drop=True)
