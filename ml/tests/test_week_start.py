"""Week-start backtest: player history frozen at the first game of each calendar week, game context per game."""
import numpy as np
import pandas as pd

from benchboss_ml.train import week_start_frame


def test_freezes_history_and_keeps_game_context():
    # Mon 2026-11-02 .. Sun 2026-11-08 is one week; 2026-11-10 starts the next.
    frame = pd.DataFrame({
        "playerId": [7, 7, 7, 7, 8],
        "gameId": [1, 2, 3, 4, 1],
        "gameDate": pd.to_datetime(["2026-11-03", "2026-11-05", "2026-11-06", "2026-11-10", "2026-11-03"]),
        "l5_goals": [0.2, 0.4, 0.6, 0.8, 1.0],          # history: changes after every game
        "std_gp": [10.0, 11.0, 12.0, 13.0, 5.0],
        "team_gf_pg": [3.0, 3.1, 3.2, 3.3, 2.5],        # own-team history
        "availability_30d": [np.nan, 1.0, 1.0, 1.0, 0.5],  # missing at week start stays missing
        "home": [1.0, 0.0, 1.0, 0.0, 1.0],              # game context: per game
        "rest_days": [2.0, 2.0, 1.0, 4.0, 3.0],
        "opp_ga_pg": [3.5, 2.9, 3.1, 3.0, 3.0],
        "days_since_last_game": [2.0, 2.0, 1.0, 4.0, 29.0],
    }, index=[10, 11, 12, 13, 14])
    out = week_start_frame(frame)

    assert list(out.index) == [10, 11, 12, 13, 14]  # original row order
    # Player 7, week 1: history frozen at the 11-03 game.
    assert out.loc[[10, 11, 12], "l5_goals"].tolist() == [0.2, 0.2, 0.2]
    assert out.loc[[10, 11, 12], "std_gp"].tolist() == [10.0, 10.0, 10.0]
    assert out.loc[[10, 11, 12], "team_gf_pg"].tolist() == [3.0, 3.0, 3.0]
    assert out.loc[[10, 11, 12], "availability_30d"].isna().all()
    # Game context stays per game.
    assert out.loc[[10, 11, 12], "home"].tolist() == [1.0, 0.0, 1.0]
    assert out.loc[[10, 11, 12], "rest_days"].tolist() == [2.0, 2.0, 1.0]
    assert out.loc[[10, 11, 12], "opp_ga_pg"].tolist() == [3.5, 2.9, 3.1]
    # Days since last game: week-start gap plus days elapsed (the app has no in-week results).
    assert out.loc[[10, 11, 12], "days_since_last_game"].tolist() == [2.0, 4.0, 5.0]
    # Next week starts fresh; other players are independent; the cap applies.
    assert out.loc[13, "l5_goals"] == 0.8 and out.loc[13, "days_since_last_game"] == 4.0
    assert out.loc[14, "l5_goals"] == 1.0 and out.loc[14, "days_since_last_game"] == 29.0


def test_single_game_weeks_are_unchanged():
    frame = pd.DataFrame({
        "playerId": [1, 1], "gameId": [1, 2], "gameDate": pd.to_datetime(["2026-11-03", "2026-11-11"]),
        "l10_shots": [2.0, 3.0], "home": [1.0, 0.0], "days_since_last_game": [3.0, 8.0],
    })
    pd.testing.assert_frame_equal(week_start_frame(frame), frame, check_dtype=False)
