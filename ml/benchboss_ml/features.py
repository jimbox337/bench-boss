"""Pre-game feature engineering.

Every feature for a player-game is computed only from games strictly before that game
(earlier date, or same date with a smaller gameId - which never happens for one team)
plus the published schedule, which is known in advance. The leakage tests in
ml/tests/test_features.py perturb the target game and all later games and assert that
features for earlier rows do not change.

The TypeScript runtime (lib/model/features.ts) mirrors these definitions; the shared
names live in SKATER_FEATURES / GOALIE_FEATURES and are exported with every artifact.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

SKATER_RATE_STATS = ("goals", "assists", "shots", "ppPoints", "hits", "blocks", "toi", "ppToi")
SKATER_TARGETS = ("goals", "assists", "shots", "ppPoints", "hits", "blocks")
# Shot-quality stats from play-by-play (benchboss_ml.xg); NaN for seasons without coverage.
XG_STATS = ("ixg", "hdAtt")
XG_FEATURES: tuple[str, ...] = tuple(f"{w}_{s}" for s in XG_STATS for w in ("std", "l5", "l10", "l20", "prev"))
WINDOWS = (5, 10, 20)
AVAILABILITY_DAYS = 30
REST_CAP = 10
GAP_CAP = 30

SKATER_FEATURES: tuple[str, ...] = tuple(
    [f"std_{s}" for s in SKATER_RATE_STATS]
    + [f"l{w}_{s}" for w in WINDOWS for s in SKATER_RATE_STATS]
    + [f"prev_{s}" for s in SKATER_RATE_STATS]
    + [
        "std_gp", "prev_gp", "home", "pos_C", "pos_W", "pos_D",
        "rest_days", "b2b", "team_games_next7", "availability_30d", "days_since_last_game",
        "team_gf_pg", "team_gf_l10", "team_sf_pg",
        "opp_ga_pg", "opp_ga_l10", "opp_sa_pg", "opp_sv_pct",
        # Deployment proxies (no public line-combination feed exists): share of the team's
        # power-play time and TOI rank among same-position teammates, from prior games.
        "l10_pp_share", "l5_toi_rank",
    ]
)

# Features for the "residual" skater candidate: player talent comes from the production
# baseline (used as the Poisson init score), so the model only learns game-context and
# usage multipliers. This avoids shrinking individual players toward their cohort, which
# improves single games but adds a per-player bias that compounds over a fantasy week.
RESIDUAL_FEATURES: tuple[str, ...] = (
    "home", "rest_days", "b2b", "team_games_next7", "days_since_last_game", "availability_30d",
    "team_gf_pg", "team_gf_l10", "team_sf_pg", "opp_ga_pg", "opp_ga_l10", "opp_sa_pg", "opp_sv_pct",
    "std_gp", "pos_C", "pos_W", "pos_D",
    "std_toi", "l5_toi", "l10_toi", "std_ppToi", "l5_ppToi", "l10_ppToi",
    "l10_pp_share", "l5_toi_rank",
)

GOALIE_FEATURES: tuple[str, ...] = (
    "share_l5", "share_l10", "share_l20", "started_prev_team_game", "days_since_last_start",
    "std_starts", "std_sv_pct", "std_ga_per_start", "std_win_rate", "prev_starts", "prev_sv_pct",
    "home", "rest_days", "b2b",
    "team_ga_pg", "team_sa_pg", "team_gf_pg", "opp_gf_pg", "opp_sf_pg", "opp_ga_pg",
    # Rotation signals coaches use: back-to-back after starting, streaks, a rough last start.
    "consecutive_starts", "b2b_started_prev", "pulled_last_start", "last_start_ga", "l5_start_sv_pct", "share_rank",
)


# --------------------------------------------------------------------------------------
# Generic prior-only helpers
# --------------------------------------------------------------------------------------

def prior_season_mean(frame: pd.DataFrame, keys: list[str], cols: list[str]) -> pd.DataFrame:
    """Mean of each column over earlier rows in the same group (rows must be time-sorted)."""
    grouped = frame.groupby(keys, sort=False)
    count = grouped.cumcount().to_numpy(dtype=float)
    cumulative = grouped[cols].cumsum().to_numpy(dtype=float) - frame[cols].to_numpy(dtype=float)
    with np.errstate(invalid="ignore", divide="ignore"):
        values = cumulative / count[:, None]
    values[count == 0] = np.nan
    return pd.DataFrame(values, columns=cols, index=frame.index)


def prior_rolling_mean(frame: pd.DataFrame, keys: list[str], cols: list[str], window: int) -> pd.DataFrame:
    """Mean of the previous `window` rows in the group, excluding the current row."""
    shifted = frame.groupby(keys, sort=False)[cols].shift(1)
    shifted[keys] = frame[keys]
    rolled = shifted.groupby(keys, sort=False)[cols].rolling(window, min_periods=1).mean()
    rolled = rolled.reset_index(level=list(range(len(keys))), drop=True)
    return rolled.reindex(frame.index)


def prior_count_within_days(dates: pd.Series, days: int) -> np.ndarray:
    """For sorted dates, count earlier rows whose date is within `days` before each row."""
    values = dates.to_numpy(dtype="datetime64[D]")
    lower = values - np.timedelta64(days, "D")
    left = np.searchsorted(values, lower, side="left")
    first_same_day = np.searchsorted(values, values, side="left")
    return first_same_day - left


def _assert_sorted(frame: pd.DataFrame, key: str) -> None:
    ordered = frame.sort_values([key, "gameDate", "gameId"], kind="stable")
    if not ordered.index.equals(frame.index):
        raise ValueError(f"Frame must be sorted by {key}, gameDate, gameId before feature generation")


# --------------------------------------------------------------------------------------
# Team environment and schedule
# --------------------------------------------------------------------------------------

def team_context(team_games: pd.DataFrame) -> pd.DataFrame:
    """Per team-game, information known before puck drop."""
    teams = team_games.sort_values(["team", "gameDate", "gameId"], kind="stable").reset_index(drop=True)
    std = prior_season_mean(teams, ["team", "season"], ["gf", "ga", "sf", "sa", "win"])
    l10 = prior_rolling_mean(teams, ["team", "season"], ["gf", "ga"], 10)
    previous_date = teams.groupby(["team", "season"], sort=False)["gameDate"].shift(1)
    rest = (teams["gameDate"] - previous_date).dt.days.fillna(REST_CAP).clip(upper=REST_CAP)

    next7 = np.zeros(len(teams), dtype=int)
    games_30d = np.zeros(len(teams), dtype=int)
    for _, idx in teams.groupby("team", sort=False).indices.items():
        dates = teams.loc[idx, "gameDate"].to_numpy(dtype="datetime64[D]")
        next7[idx] = np.searchsorted(dates, dates + np.timedelta64(7, "D"), side="left") - np.arange(len(idx))
        games_30d[idx] = prior_count_within_days(teams.loc[idx, "gameDate"], AVAILABILITY_DAYS)

    return pd.DataFrame({
        "gameId": teams["gameId"], "team": teams["team"], "season": teams["season"], "gameDate": teams["gameDate"],
        "team_gf_pg": std["gf"], "team_ga_pg": std["ga"], "team_sf_pg": std["sf"], "team_sa_pg": std["sa"],
        "team_gf_l10": l10["gf"], "team_ga_l10": l10["ga"],
        "team_sv_pct": 1 - std["ga"] / std["sa"].where(std["sa"] > 0),
        "rest_days": rest.astype(float), "b2b": (rest == 1).astype(float),
        "team_games_next7": next7.astype(float), "team_games_30d": games_30d.astype(float),
    })


def _opponent_view(context: pd.DataFrame) -> pd.DataFrame:
    return context.rename(columns={
        "team": "opp", "team_gf_pg": "opp_gf_pg", "team_ga_pg": "opp_ga_pg", "team_sf_pg": "opp_sf_pg",
        "team_sa_pg": "opp_sa_pg", "team_ga_l10": "opp_ga_l10", "team_sv_pct": "opp_sv_pct",
    })[["gameId", "opp", "opp_gf_pg", "opp_ga_pg", "opp_sf_pg", "opp_sa_pg", "opp_ga_l10", "opp_sv_pct"]]


def previous_season_id(season: str) -> str:
    start = int(season[:4]) - 1
    return f"{start}{start + 1}"


# --------------------------------------------------------------------------------------
# Skaters
# --------------------------------------------------------------------------------------

def skater_features(skaters: pd.DataFrame, team_games: pd.DataFrame) -> pd.DataFrame:
    frame = skaters.sort_values(["playerId", "gameDate", "gameId"], kind="stable").reset_index(drop=True)
    _assert_sorted(frame, "playerId")
    for stat in XG_STATS:
        if stat not in frame:
            frame[stat] = np.nan
    cols = list(SKATER_RATE_STATS) + list(XG_STATS)
    frame = add_deployment(frame)

    std = prior_season_mean(frame, ["playerId", "season"], cols).add_prefix("std_")
    parts = [std]
    for window in WINDOWS:
        parts.append(prior_rolling_mean(frame, ["playerId", "season"], cols, window).add_prefix(f"l{window}_"))
    parts.append(prior_rolling_mean(frame, ["playerId", "season"], ["pp_share"], 10).add_prefix("l10_"))
    parts.append(prior_rolling_mean(frame, ["playerId", "season"], ["toi_rank"], 5).add_prefix("l5_"))
    std_gp = frame.groupby(["playerId", "season"], sort=False).cumcount().astype(float)

    season_totals = frame.groupby(["playerId", "season"])[cols].mean()
    season_totals["gp"] = frame.groupby(["playerId", "season"]).size()
    season_totals = season_totals.reset_index()
    season_totals["nextSeason"] = season_totals["season"].map(lambda s: f"{int(s[4:])}{int(s[4:]) + 1}")
    prev = season_totals.rename(columns={**{c: f"prev_{c}" for c in cols}, "gp": "prev_gp"})
    prev = prev.drop(columns=["season"]).rename(columns={"nextSeason": "season"})

    previous_date = frame.groupby(["playerId", "season"], sort=False)["gameDate"].shift(1)
    gap = (frame["gameDate"] - previous_date).dt.days.clip(upper=GAP_CAP)

    player_30d = np.zeros(len(frame), dtype=float)
    for _, idx in frame.groupby("playerId", sort=False).indices.items():
        player_30d[idx] = prior_count_within_days(frame.loc[idx, "gameDate"], AVAILABILITY_DAYS)

    out = pd.concat([frame] + parts, axis=1)
    out["std_gp"] = std_gp
    out["days_since_last_game"] = gap
    out["player_games_30d"] = player_30d
    out = out.merge(prev, on=["playerId", "season"], how="left")
    out["prev_gp"] = out["prev_gp"].fillna(0.0)

    context = team_context(team_games)
    out = out.merge(context.drop(columns=["season", "gameDate"]), on=["gameId", "team"], how="left")
    out = out.merge(_opponent_view(context), on=["gameId", "opp"], how="left")
    with np.errstate(invalid="ignore", divide="ignore"):
        availability = out["player_games_30d"] / out["team_games_30d"]
    out["availability_30d"] = availability.where(out["team_games_30d"] > 0).clip(upper=1.0)
    out["pos_C"] = (out["position"] == "C").astype(float)
    out["pos_W"] = (out["position"] == "W").astype(float)
    out["pos_D"] = (out["position"] == "D").astype(float)
    out["home"] = out["home"].astype(float)
    return out


def add_deployment(frame: pd.DataFrame) -> pd.DataFrame:
    """Same-game deployment descriptors. They describe the game they come from, so they
    are only ever used through prior-game rolling means (never for the game itself)."""
    frame = frame.copy()
    group = np.where(frame["position"] == "D", "D", "F")
    team_pp = frame.groupby(["gameId", "team"])["ppToi"].transform("max")
    frame["pp_share"] = (frame["ppToi"] / team_pp).where(team_pp > 0, 0.0)
    frame["toi_rank"] = frame.assign(_g=group).groupby(["gameId", "team", "_g"])["toi"].rank(ascending=False, method="min")
    return frame


def skater_baseline(features: pd.DataFrame, stat: str, fallback: dict[str, float] | None = None) -> pd.Series:
    """Re-implementation of the production schedule-aware blend (lib/projectionEngine.ts):
    45% season-to-date, 25% last-20, 20% last-10, 10% last-5, re-weighted over the parts
    that exist; falls back to the previous season, then a positional mean."""
    weights = {f"std_{stat}": 0.45, f"l20_{stat}": 0.25, f"l10_{stat}": 0.20, f"l5_{stat}": 0.10}
    values = features[list(weights)].to_numpy(dtype=float)
    weight_vector = np.array(list(weights.values()))
    mask = ~np.isnan(values)
    with np.errstate(invalid="ignore", divide="ignore"):
        blend = np.nansum(values * weight_vector, axis=1) / (mask * weight_vector).sum(axis=1)
    blend[~mask.any(axis=1)] = np.nan
    result = pd.Series(blend, index=features.index)
    result = result.fillna(features[f"prev_{stat}"])
    if fallback:
        result = result.fillna(features["position"].map(fallback))
    return result.fillna(0.0)


SHRINK_PRIOR_GAMES = 20.0   # weight of the TOI-based prior relative to last season's games
SHRINK_K_GRID = (2.0, 5.0, 10.0, 20.0, 40.0)
PRIOR_WEIGHT_GRID = (0.0, 0.2, 0.35, 0.5)
SEASON_WEIGHT_GRID = (0.45, 0.0)  # production weight on season-to-date, or recent windows only


def shrinkage_reference(train: pd.DataFrame, stat: str) -> dict[str, dict[str, float]]:
    """Positional rate per minute and mean TOI, from training seasons only."""
    by_pos = train.groupby("position")
    return {"perMinute": (by_pos[stat].sum() / by_pos["toi"].sum()).to_dict(), "toi": by_pos["toi"].mean().to_dict()}


def player_prior(features: pd.DataFrame, stat: str, reference: dict[str, dict[str, float]]) -> pd.Series:
    """Last season's rate blended with a TOI-based expectation (position rate per minute
    x recent ice time), weighted by last season's games vs SHRINK_PRIOR_GAMES."""
    toi = features["l10_toi"].fillna(features["prev_toi"]).fillna(features["position"].map(reference["toi"]))
    toi_prior = features["position"].map(reference["perMinute"]) * toi
    prev_gp = features["prev_gp"].fillna(0.0)
    return (prev_gp * features[f"prev_{stat}"].fillna(0.0) + SHRINK_PRIOR_GAMES * toi_prior) / (prev_gp + SHRINK_PRIOR_GAMES)


def current_season_blend(features: pd.DataFrame, stat: str, season_weight: float = 0.45) -> pd.Series:
    """Production weights (45/25/20/10) over the windows that exist this season. With
    season_weight=0 only the last-20/10/5 windows are used."""
    weights = {f"std_{stat}": season_weight, f"l20_{stat}": 0.25, f"l10_{stat}": 0.20, f"l5_{stat}": 0.10}
    values = features[list(weights)].to_numpy(dtype=float)
    vector = np.array(list(weights.values()))
    mask = ~np.isnan(values)
    with np.errstate(invalid="ignore", divide="ignore"):
        blend = np.nansum(values * vector, axis=1) / (mask * vector).sum(axis=1)
    return pd.Series(blend, index=features.index)


def shrunk_baseline(features: pd.DataFrame, stat: str, k: float, reference: dict[str, dict[str, float]],
                    prior_weight: float = 0.0, season_weight: float = 0.45) -> pd.Series:
    """Empirical-Bayes version of the production blend.

    inner    = (gp * current-season blend + k * prior) / (gp + k)   -- small samples, e.g.
               one game with one goal, lean on the prior instead of being taken at face value
    estimate = prior_weight * prior + (1 - prior_weight) * inner    -- last season and ice
               time keep some weight all season
    k, prior_weight and season_weight are tuned per statistic on the validation season.
    """
    prior = player_prior(features, stat, reference)
    gp = features["std_gp"].fillna(0.0)
    blend = current_season_blend(features, stat, season_weight).fillna(prior)
    inner = (gp * blend + k * prior) / (gp + k)
    return (prior_weight * prior + (1 - prior_weight) * inner).fillna(0.0).clip(lower=0.0)


def season_average_baseline(features: pd.DataFrame, stat: str, fallback: dict[str, float] | None = None) -> pd.Series:
    result = features[f"std_{stat}"].fillna(features[f"prev_{stat}"])
    if fallback:
        result = result.fillna(features["position"].map(fallback))
    return result.fillna(0.0)


# --------------------------------------------------------------------------------------
# Goalies
# --------------------------------------------------------------------------------------

def goalie_candidates(goalies: pd.DataFrame, team_games: pd.DataFrame, lookback_games: int = 20) -> pd.DataFrame:
    """One row per (team game, goalie who appeared for that team in its previous
    `lookback_games` games of the same season). The label `started` is 1 when that goalie
    started. Goalies with no prior appearance are never candidates, matching runtime."""
    teams = team_games.sort_values(["team", "gameDate", "gameId"], kind="stable").reset_index(drop=True)
    teams["teamGameIndex"] = teams.groupby(["team", "season"], sort=False).cumcount()
    appearances = goalies.merge(teams[["gameId", "team", "teamGameIndex"]], on=["gameId", "team"], how="inner")
    starts = appearances[appearances["started"] == 1]

    rows = []
    for (team, season), team_rows in teams.groupby(["team", "season"], sort=False):
        team_apps = appearances[(appearances["team"] == team) & (appearances["season"] == season)]
        team_starts = starts[(starts["team"] == team) & (starts["season"] == season)]
        start_by_index = dict(zip(team_starts["teamGameIndex"], team_starts["playerId"]))
        start_line = {int(r.teamGameIndex): r for r in team_starts.itertuples(index=False)}
        for game in team_rows.itertuples(index=False):
            k = game.teamGameIndex
            if k == 0:
                continue
            recent = team_apps[(team_apps["teamGameIndex"] < k) & (team_apps["teamGameIndex"] >= k - lookback_games)]
            for goalie_id in recent["playerId"].unique():
                shares = {}
                for window in (5, 10, 20):
                    lo = max(0, k - window)
                    starters = [start_by_index.get(i) for i in range(lo, k)]
                    shares[window] = sum(1 for s in starters if s == goalie_id) / (k - lo)
                prior_starts = [i for i in range(0, k) if start_by_index.get(i) == goalie_id]
                consecutive = 0
                while k - 1 - consecutive >= 0 and start_by_index.get(k - 1 - consecutive) == goalie_id:
                    consecutive += 1
                last = start_line.get(prior_starts[-1]) if prior_starts else None
                recent5 = [start_line[i] for i in prior_starts[-5:]]
                sa5 = sum(r.shotsAgainst for r in recent5)
                rows.append({
                    "gameId": game.gameId, "team": team, "season": season, "gameDate": game.gameDate,
                    "playerId": int(goalie_id), "teamGameIndex": k,
                    "share_l5": shares[5], "share_l10": shares[10], "share_l20": shares[20],
                    "started_prev_team_game": float(start_by_index.get(k - 1) == goalie_id),
                    "lastStartIndex": prior_starts[-1] if prior_starts else None,
                    "consecutive_starts": float(consecutive),
                    "pulled_last_start": float(last is not None and last.toi < 45),
                    "last_start_ga": float(last.ga) if last is not None else float("nan"),
                    "l5_start_sv_pct": float(sum(r.saves for r in recent5) / sa5) if sa5 > 0 else float("nan"),
                    "started": int(start_by_index.get(k) == goalie_id),
                })
    out = pd.DataFrame(rows)
    if not out.empty:
        # 1 = the goalie with the most starts in the team's last 20 games (ties share rank 1).
        out["share_rank"] = out.groupby(["gameId", "team"])["share_l20"].rank(ascending=False, method="min")
    return out


def goalie_features(goalies: pd.DataFrame, team_games: pd.DataFrame) -> pd.DataFrame:
    candidates = goalie_candidates(goalies, team_games)
    context = team_context(team_games)
    starts = goalies[goalies["started"] == 1].sort_values(["playerId", "gameDate", "gameId"], kind="stable").reset_index(drop=True)
    std = prior_season_mean(starts, ["playerId", "season"], ["saves", "shotsAgainst", "ga", "win"])
    starts = pd.concat([starts, std.add_prefix("std_")], axis=1)
    starts["std_starts"] = starts.groupby(["playerId", "season"], sort=False).cumcount().astype(float)

    # Season-to-date goalie quality as of each candidate game: last start strictly before it.
    candidates = candidates.sort_values("gameDate", kind="stable")
    lookup = starts[["playerId", "season", "gameDate", "std_starts", "std_saves", "std_shotsAgainst", "std_ga", "std_win", "saves", "shotsAgainst", "ga", "win"]].sort_values("gameDate")
    # Use an as-of join on the *next* state after each prior start: cumulative including that start.
    lookup = lookup.assign(
        cum_starts=lookup["std_starts"] + 1,
        cum_saves=lookup["std_saves"].fillna(0) * lookup["std_starts"] + lookup["saves"],
        cum_sa=lookup["std_shotsAgainst"].fillna(0) * lookup["std_starts"] + lookup["shotsAgainst"],
        cum_ga=lookup["std_ga"].fillna(0) * lookup["std_starts"] + lookup["ga"],
        cum_win=lookup["std_win"].fillna(0) * lookup["std_starts"] + lookup["win"],
        asof=lookup["gameDate"] + pd.Timedelta(days=1),
    )[["playerId", "season", "asof", "gameDate", "cum_starts", "cum_saves", "cum_sa", "cum_ga", "cum_win"]]
    merged = pd.merge_asof(
        candidates.sort_values("gameDate"), lookup.rename(columns={"gameDate": "lastStartDate"}).sort_values("asof"),
        left_on="gameDate", right_on="asof", by=["playerId", "season"], direction="backward",
    )
    with np.errstate(invalid="ignore", divide="ignore"):
        merged["std_starts"] = merged["cum_starts"].fillna(0.0)
        merged["std_sv_pct"] = merged["cum_saves"] / merged["cum_sa"]
        merged["std_ga_per_start"] = merged["cum_ga"] / merged["cum_starts"]
        merged["std_win_rate"] = merged["cum_win"] / merged["cum_starts"]
    merged["days_since_last_start"] = (merged["gameDate"] - merged["lastStartDate"]).dt.days.clip(upper=GAP_CAP)

    season_totals = starts.groupby(["playerId", "season"]).agg(prev_starts=("saves", "size"), sv=("saves", "sum"), sa=("shotsAgainst", "sum")).reset_index()
    season_totals["prev_sv_pct"] = season_totals["sv"] / season_totals["sa"]
    season_totals["season"] = season_totals["season"].map(lambda s: f"{int(s[4:])}{int(s[4:]) + 1}")
    merged = merged.merge(season_totals[["playerId", "season", "prev_starts", "prev_sv_pct"]], on=["playerId", "season"], how="left")
    merged["prev_starts"] = merged["prev_starts"].fillna(0.0)

    merged = merged.merge(context.drop(columns=["season", "gameDate"]), on=["gameId", "team"], how="left")
    opp_side = team_games[["gameId", "team", "opp", "home"]]
    merged = merged.merge(opp_side, on=["gameId", "team"], how="left")
    merged = merged.merge(_opponent_view(context), on=["gameId", "opp"], how="left")
    merged["home"] = merged["home"].astype(float)
    merged["b2b_started_prev"] = merged["b2b"] * merged["started_prev_team_game"]

    outcomes = goalies[["gameId", "playerId", "saves", "shotsAgainst", "ga", "win", "shutout"]]
    merged = merged.merge(outcomes, on=["gameId", "playerId"], how="left")
    return merged.sort_values(["gameDate", "gameId", "playerId"]).reset_index(drop=True)
