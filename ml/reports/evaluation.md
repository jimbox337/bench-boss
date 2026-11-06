# Bench Boss model evaluation — `bench-boss-lgbm-20261106`

- Trained: 2026-11-06T04:49:47.758996+00:00
- Data through: 2026-11-04 (source: NHL public stats REST API (api.nhle.com/stats/rest), fetched 2026-11-05T14:56:13.130795+00:00)
- Pipeline 2026.11.0, feature schema v1
- Time-based split — train: 20152016, 20162017, 20172018, 20182019, 20192020, 20202021, 20212022, 20222023, 20232024; validation: 20242025; test: 20252026; live (in-progress, unseen by every fit): 20262027
- Rows: 495,329 skater-games, 64,108 goalie start candidates

## Promotion decision

**ELIGIBLE for integration review.** This pipeline never changes the app; integration requires a separate, explicit decision.

Rule: Selected projection must beat the production baseline on weekly fantasy-point MAE and RMSE, and not lose more than 0.005 in start/sit accuracy or top-50 precision, on both the validation and the untouched test season.

| Split | Passed | Weekly MAE better | Weekly RMSE better | Start/sit not worse | Top-50 not worse |
|---|---|---|---|---|---|
| validation | ✓ | ✓ | ✓ | ✓ | ✓ |
| test | ✓ | ✓ | ✓ | ✓ | ✓ |
| live (informational) | ✓ | ✓ | ✓ | ✓ | ✓ |

Projections compared:
- **productionBaseline** — today's app blend: 45% season-to-date, 25% last-20, 20% last-10, 10% last-5 per-game rates.
- **directModelOnly** — LightGBM Poisson on all pre-game features for every stat.
- **residualModelOnly** — LightGBM Poisson starting from log(baseline), learning only context/usage multipliers.
- **shrunkBaselineOnly** — the production blend with empirical-Bayes shrinkage toward last season and a TOI-based prior (k tuned on validation).
- **residualOnShrunkOnly** — LightGBM context/usage multipliers on top of the shrunk baseline.
- **benchBossSelected** — the served LightGBM projection: per-stat NNLS stack of baselines and boosters, blended with the production baseline.
- **benchBossAiOnly** — BenchBoss AI alone (one shared neural network, six Poisson outputs on top of the shrunk baseline).
- **lightgbmPlusBenchBossAi** — the same stack with BenchBoss AI as one more component; validation picks its weight.

## Weekly fantasy points (default Bench Boss scoring; games actually played)

| Split | Projection | MAE | RMSE | Bias | Weekly ρ | Top-50 precision | Start/sit accuracy | 80% interval coverage |
|---|---|---|---|---|---|---|---|---|
| validation | benchBossSelected | 1.545 (-2.1% ✓) | 2.081 | 0.004 | 0.705 | 0.448 | 0.762 | 0.800 |
| validation | directModelOnly | 1.593 (+1.0% ✗) | 2.153 | -0.085 | 0.687 | 0.414 | 0.747 | — |
| validation | residualModelOnly | 1.564 (-0.9% ✓) | 2.120 | -0.096 | 0.696 | 0.446 | 0.758 | — |
| validation | shrunkBaselineOnly | 1.557 (-1.3% ✓) | 2.086 | 0.053 | 0.704 | 0.453 | 0.761 | — |
| validation | residualOnShrunkOnly | 1.546 (-2.0% ✓) | 2.088 | -0.055 | 0.704 | 0.443 | 0.760 | — |
| validation | withXgOffline | 1.545 (-2.1% ✓) | 2.079 | -0.006 | 0.706 | 0.447 | 0.761 | — |
| validation | productionBaseline | 1.578 | 2.129 | 0.033 | 0.695 | 0.444 | 0.758 | — |
| validation | seasonAverageBaseline | 1.624 (+2.9% ✗) | 2.189 | 0.051 | 0.678 | 0.423 | 0.750 | — |
| validation | benchBossAiOnly | 1.586 (+0.5% ✗) | 2.150 | -0.126 | 0.689 | 0.422 | 0.749 | — |
| validation | lightgbmPlusBenchBossAi | 1.545 (-2.1% ✓) | 2.081 | 0.004 | 0.705 | 0.448 | 0.761 | — |
| test | benchBossSelected | 1.574 (-1.9% ✓) | 2.123 | 0.001 | 0.714 | 0.466 | 0.761 | 0.798 |
| test | directModelOnly | 1.615 (+0.7% ✗) | 2.202 | -0.116 | 0.696 | 0.445 | 0.757 | — |
| test | residualModelOnly | 1.593 (-0.7% ✓) | 2.174 | -0.109 | 0.704 | 0.447 | 0.759 | — |
| test | shrunkBaselineOnly | 1.581 (-1.4% ✓) | 2.121 | 0.043 | 0.712 | 0.465 | 0.763 | — |
| test | residualOnShrunkOnly | 1.571 (-2.1% ✓) | 2.131 | -0.085 | 0.712 | 0.468 | 0.763 | — |
| test | withXgOffline | 1.572 (-2.0% ✓) | 2.120 | -0.013 | 0.714 | 0.466 | 0.764 | — |
| test | productionBaseline | 1.604 | 2.170 | 0.040 | 0.704 | 0.459 | 0.759 | — |
| test | seasonAverageBaseline | 1.650 (+2.9% ✗) | 2.233 | 0.051 | 0.687 | 0.442 | 0.749 | — |
| test | benchBossAiOnly | 1.603 (-0.0% ✓) | 2.200 | -0.187 | 0.698 | 0.448 | 0.758 | — |
| test | lightgbmPlusBenchBossAi | 1.574 (-1.9% ✓) | 2.123 | 0.001 | 0.714 | 0.465 | 0.762 | — |
| live | benchBossSelected | 1.425 (-4.1% ✓) | 1.998 | -0.048 | 0.681 | 0.490 | 0.772 | 0.812 |
| live | directModelOnly | 1.489 (+0.2% ✗) | 2.073 | -0.134 | 0.652 | 0.453 | 0.761 | — |
| live | residualModelOnly | 1.473 (-0.8% ✓) | 2.097 | -0.128 | 0.661 | 0.457 | 0.768 | — |
| live | shrunkBaselineOnly | 1.450 (-2.4% ✓) | 2.011 | -0.013 | 0.672 | 0.480 | 0.768 | — |
| live | residualOnShrunkOnly | 1.443 (-2.9% ✓) | 2.011 | -0.105 | 0.671 | 0.477 | 0.766 | — |
| live | withXgOffline | 1.430 (-3.8% ✓) | 1.993 | -0.061 | 0.679 | 0.483 | 0.770 | — |
| live | productionBaseline | 1.486 | 2.125 | -0.010 | 0.663 | 0.453 | 0.765 | — |
| live | seasonAverageBaseline | 1.495 (+0.6% ✗) | 2.139 | -0.011 | 0.661 | 0.450 | 0.764 | — |
| live | benchBossAiOnly | 1.479 (-0.5% ✓) | 2.076 | -0.216 | 0.650 | 0.460 | 0.762 | — |
| live | lightgbmPlusBenchBossAi | 1.425 (-4.1% ✓) | 1.998 | -0.048 | 0.681 | 0.490 | 0.772 | — |

Weekly fantasy-point MAE by position group (F = forwards, D = defence):

- validation: benchBossSelected D 1.351 / F 1.647; productionBaseline D 1.386 / F 1.678; benchBossAiOnly D 1.385 / F 1.691; lightgbmPlusBenchBossAi D 1.351 / F 1.647
- test: benchBossSelected D 1.376 / F 1.675; productionBaseline D 1.410 / F 1.703; benchBossAiOnly D 1.406 / F 1.705; lightgbmPlusBenchBossAi D 1.376 / F 1.675
- live: benchBossSelected D 1.166 / F 1.560; productionBaseline D 1.229 / F 1.621; benchBossAiOnly D 1.226 / F 1.612; lightgbmPlusBenchBossAi D 1.166 / F 1.560

## Week-start backtest (how the app projects a week)

The per-game table above updates features before every game, so a later game in a week benefits from earlier results of that week. The app projects the whole week once, from data through the day before. Here each player's history and own-team features are frozen at his first game of the calendar week (days since last game advance; home, rest, back-to-back, schedule and opponent stay per game), and the same models and weights are re-scored.

| Split | Projection | MAE | RMSE | Bias | Weekly ρ | Top-50 precision | Start/sit accuracy | Gate vs baseline |
|---|---|---|---|---|---|---|---|---|
| validation | benchBossSelected | 1.682 (-4.1% ✓) | 2.272 | -0.003 | 0.650 | 0.390 | 0.735 | ✓ |
| validation | shrunkBaselineOnly | 1.683 (-4.0% ✓) | 2.263 | 0.053 | 0.651 | 0.384 | 0.734 |  |
| validation | productionBaseline | 1.753 | 2.382 | 0.029 | 0.629 | 0.376 | 0.727 |  |
| validation | benchBossAiOnly | 1.623 (-7.5% ✓) | 2.205 | -0.159 | 0.670 | 0.404 | 0.739 |  |
| validation | lightgbmPlusBenchBossAi | 1.682 (-4.1% ✓) | 2.272 | -0.003 | 0.650 | 0.389 | 0.735 |  |
| test | benchBossSelected | 1.715 (-4.2% ✓) | 2.324 | -0.004 | 0.655 | 0.406 | 0.738 | ✓ |
| test | shrunkBaselineOnly | 1.712 (-4.4% ✓) | 2.307 | 0.045 | 0.657 | 0.409 | 0.740 |  |
| test | productionBaseline | 1.790 | 2.443 | 0.043 | 0.634 | 0.393 | 0.730 |  |
| test | benchBossAiOnly | 1.642 (-8.3% ✓) | 2.259 | -0.222 | 0.678 | 0.436 | 0.748 |  |
| test | lightgbmPlusBenchBossAi | 1.715 (-4.2% ✓) | 2.324 | -0.004 | 0.655 | 0.406 | 0.738 |  |
| live | benchBossSelected | 1.638 (-9.2% ✓) | 2.320 | -0.056 | 0.588 | 0.377 | 0.730 | ✓ |
| live | shrunkBaselineOnly | 1.594 (-11.6% ✓) | 2.230 | -0.016 | 0.605 | 0.390 | 0.738 |  |
| live | productionBaseline | 1.804 | 2.630 | -0.022 | 0.536 | 0.350 | 0.712 |  |
| live | benchBossAiOnly | 1.522 (-15.6% ✓) | 2.145 | -0.253 | 0.629 | 0.440 | 0.747 |  |
| live | lightgbmPlusBenchBossAi | 1.638 (-9.2% ✓) | 2.320 | -0.056 | 0.588 | 0.377 | 0.730 |  |

## Skater statistics

Selection metric is validation weekly RMSE of the statistic (player-week sums).

| Target | Selected (servable) | Best incl. xG | Shrink k / prior weight | baseline | shrunk | direct | residual | residualShrunk | residualXg | stack |
|---|---|---|---|---|---|---|---|---|---|---|
| goals | **stack** | stack | 2 / 0.35 | 0.678 | 0.663 | 0.686 | 0.676 | 0.665 | 0.665 | 0.662 |
| assists | **stack** | stack | 2 / 0.35 | 0.883 | 0.864 | 0.893 | 0.880 | 0.864 | 0.865 | 0.861 |
| shots | **stack** | stack | 2 / 0.20 | 2.219 | 2.175 | 2.232 | 2.215 | 2.169 | 2.189 | 2.166 |
| ppPoints | **stack** | stack | 2 / 0.20 | 0.506 | 0.496 | 0.514 | 0.504 | 0.496 | 0.496 | 0.494 |
| hits | **stack** | stack | 2 / 0.00 | 2.027 | 2.005 | 2.061 | 2.024 | 2.000 | 2.002 | 1.991 |
| blocks | **stack** | stack | 2 / 0.20 | 1.618 | 1.580 | 1.622 | 1.616 | 1.580 | 1.581 | 1.575 |

Stack weights (non-negative least squares on validation player-week sums; the test and live seasons are untouched):

- goals: shrunk 0.534, baseline 0.232, direct 0.151, residualShrunk 0.088
- assists: residualShrunk 0.548, baseline 0.245, direct 0.123, shrunk 0.111
- shots: residualShrunk 0.408, shrunk 0.368, residual 0.117, direct 0.103
- ppPoints: residualShrunk 0.347, shrunk 0.332, direct 0.199, baseline 0.137
- hits: residualShrunk 0.604, baseline 0.226, direct 0.158
- blocks: residualShrunk 0.678, direct 0.157, residual 0.133

Rank-aware blend: model weight **0.75** (rest production baseline), chosen on validation start/sit accuracy + top-50 precision among blends within 0.5% of the best weekly RMSE.

| Model weight | Weekly MAE | Weekly RMSE | Start/sit | Top-50 |
|---|---|---|---|---|
| 1.0 | 1.545 | 2.079 | 0.761 | 0.447 |
| 0.75 | 1.545 | 2.081 | 0.762 | 0.448 |
| 0.5 | 1.551 | 2.090 | 0.762 | 0.446 |

## BenchBoss AI (neural network)

Gate basis: week-start backtest. Best epoch 11 (early stopping on validation); ensemble model weight 0.75 vs the production baseline. **Not promoted** — even when promoted it is served only with `BENCHBOSS_AI=1`.

Rule: The LightGBM + BenchBoss AI ensemble must beat the current LightGBM projection on weekly fantasy-point MAE and RMSE, not reduce start/sit accuracy or top-50 precision, and not raise forward or defence weekly MAE by more than 0.5%, on both the validation and the untouched test season of the week-start backtest; and validation must give BenchBoss AI a non-zero weight.

| Split | Passed | MAE | RMSE | Start/sit | Top-50 | F MAE | D MAE |
|---|---|---|---|---|---|---|---|
| validation | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ |
| test | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Daily (single-game) accuracy, per-game features as at puck drop. Poisson deviance is summed over the six stats; lower is better:

| Split | Projection | Poisson deviance | FP MAE | FP ρ |
|---|---|---|---|---|
| validation | benchBossSelected | 5.4174 | 0.9650 | 0.336 |
| validation | benchBossAiOnly | 5.2753 | 0.9459 | 0.359 |
| validation | lightgbmPlusBenchBossAi | 5.4173 | 0.9649 | 0.336 |
| validation | productionBaseline | 8.1406 | 0.9827 | 0.317 |
| test | benchBossSelected | 5.3692 | 0.9680 | 0.325 |
| test | benchBossAiOnly | 5.2313 | 0.9474 | 0.351 |
| test | lightgbmPlusBenchBossAi | 5.3691 | 0.9680 | 0.325 |
| test | productionBaseline | 8.0720 | 0.9852 | 0.306 |
| live | benchBossSelected | 5.6780 | 1.0172 | 0.277 |
| live | benchBossAiOnly | 5.3320 | 0.9788 | 0.325 |
| live | lightgbmPlusBenchBossAi | 5.6778 | 1.0172 | 0.277 |
| live | productionBaseline | 15.8228 | 1.0695 | 0.232 |

Stack weights with BenchBoss AI as a component (validation NNLS):

- goals: shrunk 0.534, baseline 0.232, direct 0.151, residualShrunk 0.088
- assists: residualShrunk 0.543, baseline 0.250, shrunk 0.098, direct 0.074, BenchBoss AI 0.063
- shots: residualShrunk 0.408, shrunk 0.368, residual 0.117, direct 0.103
- ppPoints: residualShrunk 0.347, shrunk 0.332, direct 0.199, baseline 0.137
- hits: residualShrunk 0.604, baseline 0.226, direct 0.158
- blocks: residualShrunk 0.678, direct 0.157, residual 0.133

## Expected goals (xG)

Logistic model on 339,971 unblocked, non-empty-net attempts from training seasons (play-by-play seasons: 20212022, 20222023, 20232024, 20242025, 20252026, 20262027). Features: distance, angle, shot type, strength, rebound.

| Split | Shots | Goals | xG total | Log loss | AUC | Distance-only log loss | Distance-only AUC |
|---|---|---|---|---|---|---|---|
| validation | 111,304 | 7,377 | 7454 | 0.2192 | 0.750 | 0.2287 | 0.708 |
| test | 111,099 | 7,578 | 8051 | 0.2270 | 0.737 | 0.2359 | 0.695 |
| live | 20,650 | 1,492 | 1540 | 0.2368 | 0.731 | 0.2462 | 0.687 |

xG features (ixg, high-danger attempts) need per-game play-by-play at serving time, so the `residualXg` candidate is evaluated offline (the `withXgOffline` weekly row) but not exported to the app.

Per-game accuracy:

| Target | Split | Baseline MAE | Direct MAE | Residual MAE | Baseline RMSE | Direct RMSE | Residual RMSE | Baseline ρ | Direct ρ | Residual ρ |
|---|---|---|---|---|---|---|---|---|---|---|
| goals | validation | 0.261 | 0.256 | 0.255 | 0.422 | 0.407 | 0.419 | 0.206 | 0.261 | 0.207 |
| goals | test | 0.266 | 0.258 | 0.260 | 0.429 | 0.414 | 0.427 | 0.200 | 0.258 | 0.200 |
| goals | live | 0.274 | 0.267 | 0.269 | 0.468 | 0.425 | 0.464 | 0.146 | 0.250 | 0.141 |
| assists | validation | 0.392 | 0.386 | 0.385 | 0.549 | 0.529 | 0.544 | 0.210 | 0.265 | 0.214 |
| assists | test | 0.399 | 0.389 | 0.391 | 0.556 | 0.538 | 0.553 | 0.214 | 0.268 | 0.215 |
| assists | live | 0.408 | 0.398 | 0.401 | 0.601 | 0.546 | 0.596 | 0.160 | 0.265 | 0.163 |
| shots | validation | 1.052 | 1.019 | 1.048 | 1.363 | 1.323 | 1.360 | 0.395 | 0.428 | 0.397 |
| shots | test | 1.044 | 1.008 | 1.040 | 1.357 | 1.316 | 1.353 | 0.394 | 0.428 | 0.395 |
| shots | live | 1.079 | 1.000 | 1.086 | 1.413 | 1.294 | 1.415 | 0.338 | 0.419 | 0.335 |
| ppPoints | validation | 0.151 | 0.148 | 0.145 | 0.316 | 0.306 | 0.313 | 0.295 | 0.320 | 0.278 |
| ppPoints | test | 0.156 | 0.150 | 0.149 | 0.321 | 0.312 | 0.320 | 0.300 | 0.327 | 0.281 |
| ppPoints | live | 0.172 | 0.170 | 0.168 | 0.378 | 0.347 | 0.370 | 0.278 | 0.349 | 0.218 |
| hits | validation | 0.909 | 0.909 | 0.909 | 1.225 | 1.202 | 1.223 | 0.496 | 0.512 | 0.498 |
| hits | test | 0.869 | 0.868 | 0.870 | 1.182 | 1.151 | 1.179 | 0.515 | 0.532 | 0.518 |
| hits | live | 0.955 | 0.903 | 0.946 | 1.305 | 1.208 | 1.292 | 0.479 | 0.528 | 0.481 |
| blocks | validation | 0.759 | 0.751 | 0.761 | 1.001 | 0.968 | 1.000 | 0.384 | 0.419 | 0.385 |
| blocks | test | 0.730 | 0.731 | 0.735 | 0.957 | 0.930 | 0.959 | 0.370 | 0.404 | 0.371 |
| blocks | live | 0.747 | 0.720 | 0.750 | 1.017 | 0.927 | 1.018 | 0.323 | 0.408 | 0.321 |

Per-game MAE by position, test season (selected vs baseline):

| Target | C | W | D |
|---|---|---|---|
| goals | 0.314 vs 0.313 | 0.349 vs 0.350 | 0.137 vs 0.137 |
| assists | 0.407 vs 0.409 | 0.404 vs 0.406 | 0.379 vs 0.381 |
| shots | 1.053 vs 1.074 | 1.104 vs 1.130 | 0.910 vs 0.929 |
| ppPoints | 0.175 vs 0.176 | 0.191 vs 0.194 | 0.098 vs 0.097 |
| hits | 0.865 vs 0.872 | 0.915 vs 0.928 | 0.805 vs 0.808 |
| blocks | 0.622 vs 0.628 | 0.569 vs 0.571 | 0.972 vs 0.990 |

## Probability calibration — P(skater scores ≥ 1 goal)

| Split | Projection | Brier | Log loss | ECE |
|---|---|---|---|---|
| validation | selected | 0.1201 | 0.3955 | 0.0150 |
| validation | baseline | 0.1242 | 0.5440 | 0.0356 |
| test | selected | 0.1221 | 0.4013 | 0.0178 |
| test | baseline | 0.1263 | 0.5551 | 0.0382 |
| live | selected | 0.1254 | 0.4108 | 0.0350 |
| live | baseline | 0.1385 | 0.8919 | 0.0879 |

## Goalie models

The app has no goalie projection today, so the comparison baseline is a simple usage model: last-10 start share, and per-start season averages shrunk toward the league mean (5-start prior).

| Target | Selected | Split | Model | Baseline | Metric |
|---|---|---|---|---|---|
| started | model | validation | 0.4658 | 0.7214 | logLoss · Brier 0.1512 vs 0.2094 · ECE 0.0314 vs 0.0571 |
| started | model | test | 0.5024 | 0.7457 | logLoss · Brier 0.1665 vs 0.2242 · ECE 0.0160 vs 0.0678 |
| started | model | live | 0.5159 | 1.1997 | logLoss · Brier 0.1727 vs 0.2634 · ECE 0.0424 vs 0.1178 |
| saves | model | validation | 6.9321 | 7.1439 | rmse |
| saves | model | test | 6.9030 | 7.1655 | rmse |
| saves | model | live | 6.7577 | 7.2580 | rmse |
| ga | model | validation | 1.5322 | 1.5509 | rmse |
| ga | model | test | 1.4961 | 1.5062 | rmse |
| ga | model | live | 1.5554 | 1.5743 | rmse |
| win | model | validation | 0.6753 | 0.6978 | logLoss · Brier 0.2412 vs 0.2519 · ECE 0.0415 vs 0.0487 |
| win | model | test | 0.6930 | 0.7028 | logLoss · Brier 0.2499 vs 0.2545 · ECE 0.0511 vs 0.0579 |
| win | model | live | 0.6704 | 0.6991 | logLoss · Brier 0.2389 vs 0.2525 · ECE 0.0497 vs 0.0647 |
| shutout | model | validation | 0.2170 | 0.2180 | logLoss · Brier 0.0534 vs 0.0535 · ECE 0.0014 vs 0.0001 |
| shutout | model | test | 0.1762 | 0.1764 | logLoss · Brier 0.0404 vs 0.0404 · ECE 0.0156 vs 0.0150 |
| shutout | model | live | 0.1558 | 0.1561 | logLoss · Brier 0.0340 vs 0.0340 · ECE 0.0200 vs 0.0222 |

Expected weekly goalie fantasy points (P(start) × E[points | start]; default scoring):

| Split | Projection | MAE | RMSE | Bias | ρ |
|---|---|---|---|---|---|
| validation | benchBossSelected | 2.338 | 3.436 | 0.294 | 0.294 |
| validation | usageBaseline | 2.319 | 3.472 | 0.225 | 0.264 |
| validation | confirmedStarter | 2.163 | 3.373 | 0.243 | 0.320 |
| test | benchBossSelected | 2.363 | 3.362 | 0.435 | 0.277 |
| test | usageBaseline | 2.357 | 3.415 | 0.351 | 0.224 |
| test | confirmedStarter | 2.220 | 3.343 | 0.451 | 0.289 |
| live | benchBossSelected | 2.240 | 3.254 | 0.408 | 0.126 |
| live | usageBaseline | 2.298 | 3.257 | 0.646 | 0.149 |
| live | confirmedStarter | 2.089 | 3.181 | 0.457 | 0.211 |

Starter pick accuracy (top candidate per team-game started; team-games whose starter was a candidate):

| Split | Model | Usage (last-10 share) | Team-games |
|---|---|---|---|
| validation | 0.755 | 0.620 | 2,519 |
| test | 0.729 | 0.586 | 2,527 |
| live | 0.762 | 0.623 | 432 |

Goalie start-probability reliability (test season):

| Bin | n | Predicted | Observed |
|---|---|---|---|
| 0.0-0.1 | 777 | 0.0582 | 0.0438 |
| 0.1-0.2 | 1,014 | 0.1496 | 0.142 |
| 0.2-0.3 | 786 | 0.2479 | 0.257 |
| 0.3-0.4 | 601 | 0.3487 | 0.3544 |
| 0.4-0.5 | 547 | 0.4483 | 0.4186 |
| 0.5-0.6 | 540 | 0.5489 | 0.5704 |
| 0.6-0.7 | 591 | 0.6515 | 0.6616 |
| 0.7-0.8 | 634 | 0.7483 | 0.7681 |
| 0.8-0.9 | 489 | 0.8417 | 0.8834 |
| 0.9-1.0 | 95 | 0.9238 | 0.9158 |

## Availability — scratches, injuries and other missed games

One row per team game for every skater who played for that team in its previous 10 games; `played` is whether he dressed. Weekly fantasy points here **include missed games as 0**, and use the production per-game baseline as the projection when he plays, so the only difference between rows is how availability is handled.

Play rate: validation 0.832, test 0.814, live 0.838. Top features: played_prev, last_toi, played_share_l5, played_share_l10, avg_toi_l5, miss_streak.

| Split | Availability approach | Weekly games MAE | Weekly FP MAE | Weekly FP RMSE | FP bias |
|---|---|---|---|---|---|
| validation | assumesPlaysEveryGame | 0.496 | 1.872 | 2.459 | 0.541 |
| validation | recentShare | 0.418 | 1.684 | 2.285 | 0.045 |
| validation | availabilityModel | 0.253 | 1.524 | 2.094 | 0.023 |
| test | assumesPlaysEveryGame | 0.567 | 1.939 | 2.547 | 0.625 |
| test | recentShare | 0.456 | 1.712 | 2.326 | 0.060 |
| test | availabilityModel | 0.266 | 1.532 | 2.119 | 0.042 |
| live | assumesPlaysEveryGame | 0.396 | 1.747 | 2.424 | 0.381 |
| live | recentShare | 0.304 | 1.577 | 2.247 | 0.029 |
| live | availabilityModel | 0.212 | 1.484 | 2.146 | -0.019 |

| Split | P(plays) | Brier | Log loss | ECE |
|---|---|---|---|---|
| validation | availabilityModel | 0.0587 | 0.2087 | 0.0037 |
| validation | recentShare | 0.1035 | 0.4833 | 0.0549 |
| validation | assumesPlaysEveryGame | 0.1684 | ∞ | — |
| test | availabilityModel | 0.0623 | 0.2202 | 0.0026 |
| test | recentShare | 0.1101 | 0.5099 | 0.0564 |
| test | assumesPlaysEveryGame | 0.1857 | ∞ | — |
| live | availabilityModel | 0.0599 | 0.2097 | 0.0071 |
| live | recentShare | 0.0950 | 0.4911 | 0.0513 |
| live | assumesPlaysEveryGame | 0.1623 | ∞ | — |

## Known limitations

- The skater stat tables score games played; the availability section scores missed games separately. Combining both into one projection is not done yet.
- Missed games are not split into injury, healthy scratch, suspension or demotion: the NHL public data has no historical injury reports.
- There is no line-combination feed. Power-play share and TOI rank from earlier games stand in for line and PP-unit placement.
- Historical confirmed starters come from game results. The confirmedStarter row shows the value of knowing the starter, not of a pre-game forecast.
- Goalie start candidates are goalies who appeared for the team in its previous 20 games; a fresh call-up cannot be predicted.
- Relief appearances are not counted in goalie weekly actuals.
- Intervals use a per-stat negative-binomial variance, ignore covariance between stats, and are rescaled on the validation season.
- The first collected season has no previous-season features. 2019-20 (stopped in March) and 2020-21 (56 games, division-only schedule) are included as-is.
