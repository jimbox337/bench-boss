import datetime as dt

import pandas as pd
import pytest

from benchboss_ml.collect import REPORTS, build_url, merge_rows, season_bounds, windows
from benchboss_ml.train import Split, choose_split, goalie_baseline, nb_dispersion, promotion_gate


def test_windows_cover_range_without_gaps_or_overlap():
    result = windows(dt.date(2025, 10, 1), dt.date(2025, 10, 25), size=10)
    assert result[0] == (dt.date(2025, 10, 1), dt.date(2025, 10, 10))
    assert result[-1][1] == dt.date(2025, 10, 25)
    for (_, end), (start, _) in zip(result, result[1:]):
        assert start - end == dt.timedelta(days=1)


def test_window_starts_stay_stable_as_today_advances():
    early = windows(*season_bounds("20262027", dt.date(2026, 11, 4)))
    later = windows(*season_bounds("20262027", dt.date(2026, 11, 20)))
    assert [w[0] for w in early] == [w[0] for w in later][: len(early)]


def test_merge_rows_deduplicates_on_natural_key_newest_wins():
    old = pd.DataFrame({"gameId": [1, 1, 2], "playerId": [10, 11, 10], "goals": [0, 1, 0]})
    new = pd.DataFrame({"gameId": [2, 3], "playerId": [10, 10], "goals": [2, 1]})
    merged = merge_rows(old, new, ("gameId", "playerId"))
    assert len(merged) == 4
    assert merged.set_index(["gameId", "playerId"]).loc[(2, 10), "goals"] == 2


def test_build_url_is_regular_season_and_windowed():
    url = build_url(REPORTS[0], "20242025", dt.date(2024, 11, 1), dt.date(2024, 11, 10))
    assert "isGame=true" in url and "limit=-1" in url
    assert "gameTypeId%3D2" in url and "2024-11-10" in url


def test_split_is_chronological_and_keeps_live_season_out():
    split = choose_split(["20222023", "20232024", "20242025", "20252026", "20262027"], dt.date(2026, 11, 4))
    assert split == Split(train=["20222023", "20232024"], validation="20242025", test="20252026", live="20262027")


def test_promotion_gate_requires_every_check():
    base = {"mae": 1.6, "rmse": 2.1, "startSitAccuracy": 0.76, "top50Precision": 0.45}
    better = {"mae": 1.5, "rmse": 2.0, "startSitAccuracy": 0.76, "top50Precision": 0.45}
    assert promotion_gate(better, base)["passed"]
    worse_ranking = {**better, "top50Precision": 0.44}
    gate = promotion_gate(worse_ranking, base)
    assert not gate["passed"] and not gate["checks"]["top50NotWorse"]


def test_goalie_baseline_shrinks_small_samples_toward_league():
    frame = pd.DataFrame({"cum_starts": [0.0, 1.0, 50.0], "cum_win": [0.0, 1.0, 30.0],
                          "cum_saves": [0.0, 30.0, 1300.0], "cum_ga": [0.0, 0.0, 140.0],
                          "share_l10": [None, 0.3, 0.9], "share_l20": [0.2, 0.3, 0.9]})
    league = {"win": 0.5, "saves": 25.0, "ga": 2.9, "shutout": 0.06}
    wins = goalie_baseline(frame, "win", league).tolist()
    assert wins[0] == pytest.approx(0.5)
    assert wins[1] == pytest.approx((1 + 2.5) / 6)  # one win does not mean a 100% win rate
    assert wins[2] == pytest.approx((30 + 2.5) / 55)
    assert goalie_baseline(frame, "started", league).tolist() == [0.2, 0.3, 0.9]


def test_nb_dispersion_zero_for_poisson_like_data():
    mu = pd.Series([1.0] * 4).to_numpy()
    y = pd.Series([0.0, 1.0, 1.0, 2.0]).to_numpy()
    assert nb_dispersion(y, mu) == 0.0
