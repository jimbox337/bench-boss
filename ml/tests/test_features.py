import numpy as np
import pandas as pd
import pytest

from benchboss_ml.features import (
    SKATER_FEATURES,
    goalie_features,
    prior_count_within_days,
    prior_rolling_mean,
    prior_season_mean,
    skater_baseline,
    skater_features,
    team_context,
)


def make_schedule(n_games: int = 12, season: str = "20252026") -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Two teams playing each other on alternating days, with one back-to-back."""
    start = pd.Timestamp("2025-10-08")
    offsets = [0, 2, 3, 5, 7, 9, 11, 12, 14, 16, 18, 20][:n_games]
    team_rows, skater_rows, goalie_rows = [], [], []
    rng = np.random.default_rng(7)
    for i, off in enumerate(offsets):
        game_id = 2025020000 + i + 1
        date = start + pd.Timedelta(days=off)
        for team, opp, home in (("AAA", "BBB", 1), ("BBB", "AAA", 0)):
            gf = float(rng.integers(0, 6))
            team_rows.append({"gameId": game_id, "season": season, "gameDate": date, "team": team, "opp": opp,
                              "home": home, "gf": gf, "ga": float(rng.integers(0, 6)), "sf": 30.0 + i, "sa": 28.0, "win": int(gf > 2)})
            # player 1 skips game index 4 (injury), player 2 plays every game
            for pid, pos in ((1, "C"), (2, "D")) if team == "AAA" else ((3, "W"),):
                if pid == 1 and i == 4:
                    continue
                skater_rows.append({"gameId": game_id, "season": season, "gameDate": date, "playerId": pid,
                                    "name": f"P{pid}", "position": pos, "positionCode": pos, "team": team, "opp": opp,
                                    "home": home, "goals": float(i % 3 == 0), "assists": float(i % 2), "points": 0.0,
                                    "ppPoints": float(i % 4 == 0), "shots": float(i + 1), "hits": 2.0, "blocks": 1.0,
                                    "pim": 0.0, "plusMinus": 0.0, "toi": 15.0 + i, "ppToi": 2.0})
            starter = 10 if (team == "AAA" and i % 3 != 2) else 11 if team == "AAA" else 20
            goalie_rows.append({"gameId": game_id, "season": season, "gameDate": date, "playerId": starter, "name": "G",
                                "team": team, "opp": opp, "home": home, "started": 1, "win": int(gf > 2), "saves": 25.0,
                                "shotsAgainst": 28.0, "ga": 3.0, "shutout": 0, "toi": 60.0})
    return pd.DataFrame(skater_rows), pd.DataFrame(goalie_rows), pd.DataFrame(team_rows)


def test_prior_season_mean_excludes_current_row():
    frame = pd.DataFrame({"k": [1, 1, 1, 2], "season": ["s"] * 4, "x": [1.0, 3.0, 5.0, 9.0]})
    result = prior_season_mean(frame, ["k", "season"], ["x"])["x"].tolist()
    assert np.isnan(result[0]) and result[1] == 1.0 and result[2] == 2.0 and np.isnan(result[3])


def test_prior_rolling_mean_window_and_group_boundaries():
    frame = pd.DataFrame({"k": [1, 1, 1, 1, 2, 2], "x": [2.0, 4.0, 6.0, 8.0, 100.0, 0.0]})
    result = prior_rolling_mean(frame, ["k"], ["x"], 2)["x"].tolist()
    assert np.isnan(result[0])
    assert result[1:4] == [2.0, 3.0, 5.0]
    assert np.isnan(result[4]) and result[5] == 100.0


def test_prior_count_within_days_ignores_same_day_and_future():
    dates = pd.Series(pd.to_datetime(["2025-01-01", "2025-01-10", "2025-01-31", "2025-02-15"]))
    assert prior_count_within_days(dates, 30).tolist() == [0, 1, 2, 1]


def test_team_context_rest_back_to_back_and_schedule_volume():
    _, _, teams = make_schedule()
    ctx = team_context(teams).query("team == 'AAA'").reset_index(drop=True)
    assert ctx.loc[0, "rest_days"] == 10  # season opener capped
    assert ctx.loc[2, "rest_days"] == 1 and ctx.loc[2, "b2b"] == 1  # offsets 2 -> 3
    # Games on/after day 0 and before day 7: offsets 0, 2, 3, 5
    assert ctx.loc[0, "team_games_next7"] == 4
    assert np.isnan(ctx.loc[0, "team_gf_pg"])
    assert ctx.loc[1, "team_gf_pg"] == teams.query("team == 'AAA'").iloc[0]["gf"]


def test_skater_features_have_no_leakage_from_current_or_future_games():
    skaters, _, teams = make_schedule()
    base = skater_features(skaters, teams)
    cutoff = pd.Timestamp("2025-10-15")  # perturb this game and everything after
    tampered_skaters = skaters.copy()
    future = tampered_skaters["gameDate"] >= cutoff
    for col in ("goals", "assists", "shots", "ppPoints", "hits", "blocks", "toi", "ppToi"):
        tampered_skaters.loc[future, col] = 999.0
    tampered_teams = teams.copy()
    tampered_teams.loc[tampered_teams["gameDate"] >= cutoff, ["gf", "ga", "sf", "sa"]] = 999.0
    tampered = skater_features(tampered_skaters, tampered_teams)

    key = ["gameId", "playerId"]
    left = base.set_index(key).sort_index()
    right = tampered.set_index(key).sort_index()
    rows = left.index[left["gameDate"] <= cutoff]
    pd.testing.assert_frame_equal(left.loc[rows, list(SKATER_FEATURES)], right.loc[rows, list(SKATER_FEATURES)])
    # And the tampering is visible afterwards, proving the test can detect changes.
    later = left.index[left["gameDate"] > cutoff]
    assert not left.loc[later, "std_shots"].equals(right.loc[later, "std_shots"])


def test_skater_rates_windows_and_availability():
    skaters, _, teams = make_schedule()
    feats = skater_features(skaters, teams).query("playerId == 2").reset_index(drop=True)
    # Shots are i + 1, so before game index 5 the prior five values are 1..5.
    assert feats.loc[5, "l5_shots"] == pytest.approx(3.0)
    assert feats.loc[5, "std_shots"] == pytest.approx(3.0)
    assert feats.loc[5, "std_gp"] == 5
    assert feats.loc[0, "std_gp"] == 0 and np.isnan(feats.loc[0, "std_shots"])

    p1 = skater_features(skaters, teams).query("playerId == 1").reset_index(drop=True)
    # Player 1 missed one of the team's first five games.
    row = p1[p1["gameDate"] == pd.Timestamp("2025-10-17")].iloc[0]
    assert row["availability_30d"] == pytest.approx(4 / 5)


def test_baseline_reweights_missing_windows_and_falls_back():
    frame = pd.DataFrame({
        "std_goals": [0.5, np.nan, np.nan], "l20_goals": [0.3, np.nan, np.nan],
        "l10_goals": [np.nan, np.nan, np.nan], "l5_goals": [np.nan, np.nan, np.nan],
        "prev_goals": [0.9, 0.4, np.nan], "position": ["C", "C", "D"],
    })
    result = skater_baseline(frame, "goals", {"C": 0.2, "D": 0.1}).tolist()
    assert result[0] == pytest.approx((0.5 * 0.45 + 0.3 * 0.25) / 0.70)
    assert result[1] == pytest.approx(0.4)
    assert result[2] == pytest.approx(0.1)


def test_goalie_candidates_only_use_prior_starts():
    _, goalies, teams = make_schedule()
    feats = goalie_features(goalies, teams)
    aaa = feats[feats["team"] == "AAA"]
    assert set(aaa["playerId"]) == {10, 11}
    first_candidate_game = aaa["teamGameIndex"].min()
    assert first_candidate_game == 1
    # Goalie 11 first starts at index 2, so is not a candidate at index 1 or 2.
    g11 = aaa[aaa["playerId"] == 11]
    assert g11["teamGameIndex"].min() == 3
    # Shares never look at the current game.
    row = aaa[(aaa["playerId"] == 10) & (aaa["teamGameIndex"] == 3)].iloc[0]
    assert row["share_l5"] == pytest.approx(2 / 3)
    assert row["started_prev_team_game"] == 0.0
    assert row["std_starts"] == 2


def test_shrunk_baseline_tempers_tiny_samples_but_trusts_large_ones():
    from benchboss_ml.features import shrunk_baseline
    reference = {"perMinute": {"W": 0.012}, "toi": {"W": 15.0}}
    frame = pd.DataFrame({
        # one game, one goal, 8.5 minutes, nearly no prior production
        "std_goals": [1.0, 0.45], "l20_goals": [1.0, 0.45], "l10_goals": [1.0, 0.5], "l5_goals": [1.0, 0.6],
        "prev_goals": [0.02, 0.45], "prev_gp": [30.0, 82.0], "prev_toi": [8.0, 20.0], "l10_toi": [8.5, 20.0],
        "std_gp": [1.0, 60.0], "position": ["W", "W"],
    })
    result = shrunk_baseline(frame, "goals", 40.0, reference).tolist()
    assert result[0] < 0.15          # production blend would say ~1.0 goals per game
    assert result[1] == pytest.approx(0.47, abs=0.03)  # an established scorer keeps his rate


def test_goalie_rotation_features_use_prior_games_only():
    _, goalies, teams = make_schedule()
    feats = goalie_features(goalies, teams)
    aaa = feats[feats["team"] == "AAA"].set_index(["teamGameIndex", "playerId"]).sort_index()
    # Starters by AAA game index: 10,10,11,10,10,11,10,10,11,...
    assert aaa.loc[(4, 10), "consecutive_starts"] == 1
    assert aaa.loc[(5, 10), "consecutive_starts"] == 2
    assert aaa.loc[(4, 11), "consecutive_starts"] == 0
    # Game index 7 (day 12) follows day 11: a back-to-back after goalie 10 started game 6.
    assert aaa.loc[(7, 10), "b2b"] == 1 and aaa.loc[(7, 10), "b2b_started_prev"] == 1
    assert aaa.loc[(7, 11), "b2b_started_prev"] == 0
    assert aaa.loc[(4, 10), "pulled_last_start"] == 0
    assert aaa.loc[(4, 10), "l5_start_sv_pct"] == pytest.approx(25 / 28)
    assert aaa.loc[(4, 10), "share_rank"] == 1

    # Perturb the result of game index 5 and later: features up to game 5 must not change.
    cutoff = teams[teams["team"] == "AAA"].sort_values("gameDate").iloc[5]["gameDate"]
    tampered = goalies.copy()
    late = tampered["gameDate"] >= cutoff
    tampered.loc[late, ["saves", "ga", "toi"]] = [1.0, 9.0, 10.0]
    again = goalie_features(tampered, teams)
    again = again[again["team"] == "AAA"].set_index(["teamGameIndex", "playerId"]).sort_index()
    cols = ["consecutive_starts", "pulled_last_start", "last_start_ga", "l5_start_sv_pct", "std_sv_pct", "b2b_started_prev"]
    early = aaa.index[aaa.index.get_level_values(0) <= 5]
    pd.testing.assert_frame_equal(aaa.loc[early, cols], again.loc[early, cols])
    assert again.loc[(7, 10), "pulled_last_start"] == 1  # his tampered game-6 start is visible afterwards
