import pandas as pd
import pytest

from benchboss_ml.availability import availability_rows
from tests.test_features import make_schedule


def test_misses_are_rows_with_label_zero_and_features_use_only_prior_games():
    skaters, _, teams = make_schedule()
    rows = availability_rows(skaters, teams)
    p1 = rows[(rows["playerId"] == 1)].reset_index(drop=True)
    missed = p1[p1["played"] == 0]
    assert len(missed) == 1  # player 1 skipped exactly one game (team game index 4)
    miss = missed.iloc[0]
    assert miss["played_prev"] == 1.0 and miss["miss_streak"] == 0.0
    after = p1[p1["gameDate"] > miss["gameDate"]].iloc[0]
    assert after["played_prev"] == 0.0 and after["miss_streak"] == 1.0
    assert after["played_share_l5"] == pytest.approx(4 / 5)


def test_no_row_for_teams_first_game_and_traded_players_are_dropped():
    skaters, _, teams = make_schedule()
    rows = availability_rows(skaters, teams)
    first_game = teams["gameId"].min()
    assert not (rows["gameId"] == first_game).any()

    # Player 2 moves from AAA to BBB after the sixth game: no AAA rows after that.
    moved = skaters.copy()
    late = (moved["playerId"] == 2) & (moved["gameDate"] > pd.Timestamp("2025-10-17"))
    moved.loc[late, "team"] = "BBB"
    moved.loc[late, "opp"] = "AAA"
    moved.loc[late, "home"] = 0
    rows = availability_rows(moved, teams)
    aaa_after = rows[(rows["playerId"] == 2) & (rows["team"] == "AAA") & (rows["gameDate"] > pd.Timestamp("2025-10-17"))]
    assert aaa_after.empty
