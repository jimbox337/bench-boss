# Bench Boss model evaluation — `bench-boss-lgbm-20261104`

- Trained: 2026-11-04T23:45:49.417162+00:00
- Data through: 2026-11-03 (source: NHL public stats REST API (api.nhle.com/stats/rest), fetched 2026-11-04T23:39:56.650507+00:00)
- Pipeline 2026.11.0, feature schema v1
- Time-based split — train: 20222023, 20232024; validation: 20242025; test: 20252026; live (in-progress, unseen by every fit): 20262027
- Rows: 197,738 skater-games, 25,755 goalie start candidates

## Promotion decision

**NOT eligible — keep the production baseline.** This pipeline never changes the app; integration requires a separate, explicit decision.

Rule: Selected projection must beat the production baseline on weekly fantasy-point MAE and RMSE, and not lose more than 0.005 in start/sit accuracy or top-50 precision, on both the validation and the untouched test season.

| Split | Passed | Weekly MAE better | Weekly RMSE better | Start/sit not worse | Top-50 not worse |
|---|---|---|---|---|---|
| validation | ✗ | ✓ | ✓ | ✓ | ✗ |
| test | ✗ | ✓ | ✗ | ✓ | ✗ |
| live (informational) | ✓ | ✓ | ✓ | ✓ | ✓ |

Projections compared:
- **productionBaseline** — today's app blend: 45% season-to-date, 25% last-20, 20% last-10, 10% last-5 per-game rates.
- **directModelOnly** — LightGBM Poisson on all pre-game features for every stat.
- **residualModelOnly** — LightGBM Poisson starting from log(baseline), learning only context/usage multipliers.
- **benchBossSelected** — per stat, whichever of the three had the lowest validation weekly RMSE.

## Weekly fantasy points (default Bench Boss scoring; games actually played)

| Split | Projection | MAE | RMSE | Bias | Weekly ρ | Top-50 precision | Start/sit accuracy | 80% interval coverage |
|---|---|---|---|---|---|---|---|---|
| validation | benchBossSelected | 1.567 (-0.7% ✓) | 2.128 | -0.126 | 0.695 | 0.439 | 0.755 | 0.800 |
| validation | directModelOnly | 1.607 (+1.8% ✗) | 2.169 | -0.057 | 0.683 | 0.416 | 0.747 | — |
| validation | residualModelOnly | 1.568 (-0.6% ✓) | 2.127 | -0.098 | 0.695 | 0.436 | 0.757 | — |
| validation | productionBaseline | 1.578 | 2.129 | 0.034 | 0.695 | 0.444 | 0.758 | — |
| validation | seasonAverageBaseline | 1.624 (+2.9% ✗) | 2.189 | 0.052 | 0.678 | 0.423 | 0.750 | — |
| test | benchBossSelected | 1.592 (-0.7% ✓) | 2.188 | -0.178 | 0.703 | 0.446 | 0.759 | 0.797 |
| test | directModelOnly | 1.634 (+1.9% ✗) | 2.216 | -0.084 | 0.691 | 0.440 | 0.753 | — |
| test | residualModelOnly | 1.596 (-0.5% ✓) | 2.186 | -0.143 | 0.703 | 0.448 | 0.758 | — |
| test | productionBaseline | 1.604 | 2.170 | 0.041 | 0.704 | 0.459 | 0.760 | — |
| test | seasonAverageBaseline | 1.650 (+2.9% ✗) | 2.233 | 0.052 | 0.687 | 0.441 | 0.749 | — |
| live | benchBossSelected | 1.472 (-1.1% ✓) | 2.092 | -0.103 | 0.655 | 0.480 | 0.765 | 0.796 |
| live | directModelOnly | 1.499 (+0.7% ✗) | 2.080 | -0.108 | 0.643 | 0.483 | 0.755 | — |
| live | residualModelOnly | 1.472 (-1.1% ✓) | 2.092 | -0.104 | 0.655 | 0.480 | 0.765 | — |
| live | productionBaseline | 1.488 | 2.128 | -0.008 | 0.655 | 0.470 | 0.760 | — |
| live | seasonAverageBaseline | 1.498 (+0.7% ✗) | 2.142 | -0.009 | 0.654 | 0.460 | 0.761 | — |

Weekly fantasy-point MAE by position group (F = forwards, D = defence):

- validation: benchBossSelected D 1.375 / F 1.667; productionBaseline D 1.386 / F 1.678
- test: benchBossSelected D 1.400 / F 1.691; productionBaseline D 1.410 / F 1.704
- live: benchBossSelected D 1.221 / F 1.604; productionBaseline D 1.235 / F 1.621

## Skater statistics

Selection metric is validation weekly RMSE of the statistic (player-week sums).

| Target | Selected | Val weekly RMSE baseline | direct | residual |
|---|---|---|---|---|
| goals | **residual** | 0.678 | 0.689 | 0.677 |
| assists | **residual** | 0.883 | 0.898 | 0.882 |
| shots | **residual** | 2.219 | 2.239 | 2.216 |
| ppPoints | **residual** | 0.506 | 0.518 | 0.505 |
| hits | **residual** | 2.027 | 2.067 | 2.027 |
| blocks | **baseline** | 1.618 | 1.627 | 1.620 |

Per-game accuracy:

| Target | Split | Baseline MAE | Direct MAE | Residual MAE | Baseline RMSE | Direct RMSE | Residual RMSE | Baseline ρ | Direct ρ | Residual ρ |
|---|---|---|---|---|---|---|---|---|---|---|
| goals | validation | 0.262 | 0.256 | 0.255 | 0.422 | 0.407 | 0.419 | 0.206 | 0.259 | 0.207 |
| goals | test | 0.267 | 0.258 | 0.258 | 0.429 | 0.415 | 0.427 | 0.200 | 0.257 | 0.200 |
| goals | live | 0.275 | 0.269 | 0.271 | 0.468 | 0.424 | 0.466 | 0.146 | 0.250 | 0.141 |
| assists | validation | 0.392 | 0.387 | 0.383 | 0.549 | 0.530 | 0.544 | 0.210 | 0.262 | 0.215 |
| assists | test | 0.399 | 0.390 | 0.388 | 0.556 | 0.538 | 0.553 | 0.214 | 0.266 | 0.215 |
| assists | live | 0.408 | 0.401 | 0.402 | 0.600 | 0.546 | 0.594 | 0.159 | 0.262 | 0.164 |
| shots | validation | 1.052 | 1.018 | 1.043 | 1.363 | 1.327 | 1.358 | 0.395 | 0.424 | 0.398 |
| shots | test | 1.044 | 1.010 | 1.034 | 1.357 | 1.319 | 1.352 | 0.394 | 0.424 | 0.396 |
| shots | live | 1.080 | 1.004 | 1.078 | 1.415 | 1.302 | 1.408 | 0.337 | 0.410 | 0.335 |
| ppPoints | validation | 0.151 | 0.147 | 0.146 | 0.316 | 0.307 | 0.314 | 0.295 | 0.314 | 0.283 |
| ppPoints | test | 0.156 | 0.150 | 0.149 | 0.321 | 0.313 | 0.320 | 0.300 | 0.323 | 0.288 |
| ppPoints | live | 0.172 | 0.171 | 0.169 | 0.376 | 0.346 | 0.370 | 0.277 | 0.346 | 0.227 |
| hits | validation | 0.909 | 0.915 | 0.910 | 1.225 | 1.206 | 1.225 | 0.496 | 0.509 | 0.497 |
| hits | test | 0.869 | 0.874 | 0.870 | 1.182 | 1.157 | 1.181 | 0.515 | 0.528 | 0.516 |
| hits | live | 0.955 | 0.906 | 0.952 | 1.306 | 1.212 | 1.301 | 0.479 | 0.523 | 0.479 |
| blocks | validation | 0.760 | 0.760 | 0.763 | 1.001 | 0.970 | 1.001 | 0.384 | 0.416 | 0.384 |
| blocks | test | 0.731 | 0.740 | 0.736 | 0.958 | 0.933 | 0.959 | 0.370 | 0.402 | 0.370 |
| blocks | live | 0.748 | 0.726 | 0.750 | 1.019 | 0.930 | 1.019 | 0.322 | 0.403 | 0.319 |

Per-game MAE by position, test season (selected vs baseline):

| Target | C | W | D |
|---|---|---|---|
| goals | 0.304 vs 0.313 | 0.340 vs 0.350 | 0.132 vs 0.137 |
| assists | 0.398 vs 0.409 | 0.397 vs 0.406 | 0.371 vs 0.381 |
| shots | 1.064 vs 1.074 | 1.119 vs 1.130 | 0.920 vs 0.929 |
| ppPoints | 0.169 vs 0.176 | 0.186 vs 0.194 | 0.093 vs 0.097 |
| hits | 0.873 vs 0.872 | 0.929 vs 0.928 | 0.808 vs 0.808 |
| blocks | 0.628 vs 0.628 | 0.571 vs 0.571 | 0.991 vs 0.991 |

## Probability calibration — P(skater scores ≥ 1 goal)

| Split | Projection | Brier | Log loss | ECE |
|---|---|---|---|---|
| validation | selected | 0.1235 | 0.4503 | 0.0327 |
| validation | baseline | 0.1242 | 0.5440 | 0.0357 |
| test | selected | 0.1258 | 0.4594 | 0.0363 |
| test | baseline | 0.1263 | 0.5552 | 0.0383 |
| live | selected | 0.1380 | 0.5922 | 0.0831 |
| live | baseline | 0.1390 | 0.8995 | 0.0890 |

## Goalie models

The app has no goalie projection today, so the comparison baseline is a simple usage model: last-10 start share, and per-start season averages shrunk toward the league mean (5-start prior).

| Target | Selected | Split | Model | Baseline | Metric |
|---|---|---|---|---|---|
| started | model | validation | 0.4883 | 0.7214 | logLoss · Brier 0.1600 vs 0.2094 · ECE 0.0275 vs 0.0571 |
| started | model | test | 0.5281 | 0.7457 | logLoss · Brier 0.1768 vs 0.2242 · ECE 0.0171 vs 0.0678 |
| started | model | live | 0.5458 | 1.2107 | logLoss · Brier 0.1851 vs 0.2637 · ECE 0.0485 vs 0.1170 |
| saves | model | validation | 6.9293 | 7.1338 | rmse |
| saves | model | test | 6.9237 | 7.1526 | rmse |
| saves | model | live | 6.8190 | 7.2655 | rmse |
| ga | model | validation | 1.5306 | 1.5505 | rmse |
| ga | model | test | 1.4991 | 1.5055 | rmse |
| ga | model | live | 1.5409 | 1.5574 | rmse |
| win | model | validation | 0.6806 | 0.6978 | logLoss · Brier 0.2438 vs 0.2519 · ECE 0.0560 vs 0.0488 |
| win | model | test | 0.6999 | 0.7028 | logLoss · Brier 0.2531 vs 0.2545 · ECE 0.0713 vs 0.0580 |
| win | model | live | 0.6709 | 0.6991 | logLoss · Brier 0.2391 vs 0.2525 · ECE 0.0314 vs 0.0654 |
| shutout | model | validation | 0.2169 | 0.2185 | logLoss · Brier 0.0534 vs 0.0536 · ECE 0.0028 vs 0.0068 |
| shutout | model | test | 0.1758 | 0.1748 | logLoss · Brier 0.0404 vs 0.0403 · ECE 0.0119 vs 0.0080 |
| shutout | model | live | 0.1572 | 0.1554 | logLoss · Brier 0.0345 vs 0.0343 · ECE 0.0160 vs 0.0146 |

Expected weekly goalie fantasy points (P(start) × E[points | start]; default scoring):

| Split | Projection | MAE | RMSE | Bias | ρ |
|---|---|---|---|---|---|
| validation | benchBossSelected | 2.398 | 3.509 | 0.215 | 0.227 |
| validation | usageBaseline | 2.290 | 3.461 | 0.119 | 0.266 |
| test | benchBossSelected | 2.443 | 3.446 | 0.424 | 0.192 |
| test | usageBaseline | 2.326 | 3.399 | 0.238 | 0.226 |
| live | benchBossSelected | 2.244 | 3.269 | 0.279 | 0.092 |
| live | usageBaseline | 2.234 | 3.214 | 0.491 | 0.176 |

Goalie start-probability reliability (test season):

| Bin | n | Predicted | Observed |
|---|---|---|---|
| 0.0-0.1 | 837 | 0.0643 | 0.0621 |
| 0.1-0.2 | 872 | 0.1489 | 0.1376 |
| 0.2-0.3 | 854 | 0.2488 | 0.2845 |
| 0.3-0.4 | 645 | 0.3478 | 0.3783 |
| 0.4-0.5 | 551 | 0.449 | 0.4519 |
| 0.5-0.6 | 624 | 0.5526 | 0.5737 |
| 0.6-0.7 | 687 | 0.6487 | 0.6667 |
| 0.7-0.8 | 638 | 0.7487 | 0.7586 |
| 0.8-0.9 | 341 | 0.8432 | 0.8651 |
| 0.9-1.0 | 25 | 0.9156 | 0.96 |

## Known limitations

- Skater evaluation conditions on games actually played. It does not score availability or the number of games played, so scratches and injuries are outside these numbers.
- No injury, line-combination, or confirmed-starter data is used. The NHL public endpoints do not provide them reliably.
- Goalie start candidates are goalies who appeared for the team in its previous 20 games; a fresh call-up cannot be predicted.
- Relief appearances are not counted in goalie weekly actuals.
- Intervals use a per-stat negative-binomial variance, ignore covariance between stats, and are rescaled on the validation season.
- Only four completed seasons are used (2022-23 onward); 2022-23 rows have no previous-season features.
