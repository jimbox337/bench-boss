import numpy as np
import pandas as pd

from benchboss_ml.train import apply_stack, stack_weights


def test_stack_recovers_weights_and_drops_useless_components():
    rng = np.random.default_rng(0)
    n = 4000
    frame = pd.DataFrame({
        "playerId": rng.integers(0, 200, n),
        "gameDate": pd.Timestamp("2025-10-06") + pd.to_timedelta(rng.integers(0, 120, n), unit="D"),
        "base_goals": rng.uniform(0.1, 0.6, n),
        "shr_goals": rng.uniform(0.1, 0.6, n),
        "direct_goals": rng.uniform(0.1, 0.6, n),
    })
    frame["goals"] = 0.7 * frame["shr_goals"] + 0.3 * frame["direct_goals"]
    weights = stack_weights(frame, "goals", ["baseline", "shrunk", "direct"])
    assert set(weights) == {"shrunk", "direct"}
    assert abs(weights["shrunk"] - 0.7) < 1e-6 and abs(weights["direct"] - 0.3) < 1e-6
    assert np.allclose(apply_stack(frame, "goals", weights), frame["goals"])
