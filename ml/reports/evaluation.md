# Bench Boss model evaluation — `bench-boss-lgbm-20261105`

- Trained: 2026-11-05T00:10:20.555208+00:00
- Data through: 2026-11-03 (source: NHL public stats REST API (api.nhle.com/stats/rest), fetched 2026-11-05T00:10:01.968402+00:00)
- Pipeline 2026.11.0, feature schema v1
- Time-based split — train: 20152016, 20162017, 20172018, 20182019, 20192020, 20202021, 20212022, 20222023, 20232024; validation: 20242025; test: 20252026; live (in-progress, unseen by every fit): 20262027
- Rows: 495,185 skater-games, 64,089 goalie start candidates

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
- **benchBossSelected** — per stat, whichever of the three had the lowest validation weekly RMSE.

## Weekly fantasy points (default Bench Boss scoring; games actually played)

| Split | Projection | MAE | RMSE | Bias | Weekly ρ | Top-50 precision | Start/sit accuracy | 80% interval coverage |
|---|---|---|---|---|---|---|---|---|
| validation | benchBossSelected | 1.553 (-1.6% ✓) | 2.083 | 0.021 | 0.705 | 0.448 | 0.761 | 0.800 |
| validation | directModelOnly | 1.595 (+1.1% ✗) | 2.154 | -0.078 | 0.687 | 0.416 | 0.747 | — |
| validation | residualModelOnly | 1.564 (-0.9% ✓) | 2.123 | -0.122 | 0.696 | 0.443 | 0.758 | — |
| validation | shrunkBaselineOnly | 1.557 (-1.3% ✓) | 2.086 | 0.053 | 0.704 | 0.453 | 0.761 | — |
| validation | residualOnShrunkOnly | 1.546 (-2.0% ✓) | 2.088 | -0.054 | 0.705 | 0.443 | 0.760 | — |
| validation | productionBaseline | 1.578 | 2.129 | 0.033 | 0.695 | 0.444 | 0.758 | — |
| validation | seasonAverageBaseline | 1.624 (+2.9% ✗) | 2.189 | 0.051 | 0.678 | 0.423 | 0.750 | — |
| test | benchBossSelected | 1.577 (-1.7% ✓) | 2.121 | 0.007 | 0.713 | 0.468 | 0.763 | 0.800 |
| test | directModelOnly | 1.617 (+0.8% ✗) | 2.203 | -0.110 | 0.695 | 0.445 | 0.756 | — |
| test | residualModelOnly | 1.592 (-0.8% ✓) | 2.181 | -0.152 | 0.704 | 0.448 | 0.759 | — |
| test | shrunkBaselineOnly | 1.581 (-1.4% ✓) | 2.121 | 0.043 | 0.712 | 0.465 | 0.763 | — |
| test | residualOnShrunkOnly | 1.571 (-2.1% ✓) | 2.132 | -0.086 | 0.712 | 0.468 | 0.763 | — |
| test | productionBaseline | 1.604 | 2.170 | 0.040 | 0.704 | 0.459 | 0.759 | — |
| test | seasonAverageBaseline | 1.650 (+2.9% ✗) | 2.233 | 0.051 | 0.687 | 0.442 | 0.749 | — |
| live | benchBossSelected | 1.449 (-2.6% ✓) | 2.010 | -0.040 | 0.664 | 0.480 | 0.762 | 0.813 |
| live | directModelOnly | 1.493 (+0.3% ✗) | 2.081 | -0.140 | 0.643 | 0.467 | 0.758 | — |
| live | residualModelOnly | 1.481 (-0.5% ✓) | 2.110 | -0.155 | 0.651 | 0.463 | 0.765 | — |
| live | shrunkBaselineOnly | 1.451 (-2.4% ✓) | 2.012 | -0.013 | 0.664 | 0.490 | 0.763 | — |
| live | residualOnShrunkOnly | 1.446 (-2.8% ✓) | 2.012 | -0.104 | 0.661 | 0.487 | 0.761 | — |
| live | productionBaseline | 1.488 | 2.128 | -0.009 | 0.655 | 0.470 | 0.760 | — |
| live | seasonAverageBaseline | 1.498 (+0.7% ✗) | 2.142 | -0.010 | 0.654 | 0.460 | 0.761 | — |

Weekly fantasy-point MAE by position group (F = forwards, D = defence):

- validation: benchBossSelected D 1.357 / F 1.655; productionBaseline D 1.386 / F 1.678
- test: benchBossSelected D 1.375 / F 1.680; productionBaseline D 1.410 / F 1.703
- live: benchBossSelected D 1.192 / F 1.583; productionBaseline D 1.234 / F 1.621

## Skater statistics

Selection metric is validation weekly RMSE of the statistic (player-week sums).

| Target | Selected | Shrink k / prior weight | baseline | shrunk | direct | residual | residualShrunk |
|---|---|---|---|---|---|---|---|
| goals | **shrunk** | 2 / 0.35 | 0.678 | 0.663 | 0.685 | 0.677 | 0.665 |
| assists | **shrunk** | 2 / 0.35 | 0.883 | 0.864 | 0.893 | 0.881 | 0.864 |
| shots | **residualShrunk** | 2 / 0.20 | 2.219 | 2.175 | 2.234 | 2.215 | 2.168 |
| ppPoints | **residualShrunk** | 2 / 0.20 | 0.506 | 0.496 | 0.514 | 0.505 | 0.496 |
| hits | **residualShrunk** | 2 / 0.00 | 2.027 | 2.005 | 2.059 | 2.023 | 2.000 |
| blocks | **shrunk** | 2 / 0.20 | 1.618 | 1.580 | 1.623 | 1.615 | 1.580 |

Per-game accuracy:

| Target | Split | Baseline MAE | Direct MAE | Residual MAE | Baseline RMSE | Direct RMSE | Residual RMSE | Baseline ρ | Direct ρ | Residual ρ |
|---|---|---|---|---|---|---|---|---|---|---|
| goals | validation | 0.261 | 0.256 | 0.254 | 0.422 | 0.406 | 0.418 | 0.206 | 0.262 | 0.207 |
| goals | test | 0.266 | 0.258 | 0.258 | 0.429 | 0.414 | 0.427 | 0.200 | 0.258 | 0.200 |
| goals | live | 0.275 | 0.266 | 0.268 | 0.467 | 0.425 | 0.464 | 0.146 | 0.249 | 0.139 |
| assists | validation | 0.392 | 0.386 | 0.383 | 0.549 | 0.529 | 0.544 | 0.210 | 0.265 | 0.214 |
| assists | test | 0.399 | 0.390 | 0.389 | 0.556 | 0.538 | 0.553 | 0.214 | 0.268 | 0.214 |
| assists | live | 0.408 | 0.399 | 0.400 | 0.600 | 0.546 | 0.595 | 0.159 | 0.265 | 0.162 |
| shots | validation | 1.052 | 1.020 | 1.048 | 1.363 | 1.323 | 1.360 | 0.395 | 0.428 | 0.397 |
| shots | test | 1.044 | 1.009 | 1.040 | 1.357 | 1.315 | 1.353 | 0.394 | 0.428 | 0.395 |
| shots | live | 1.080 | 1.000 | 1.087 | 1.415 | 1.295 | 1.417 | 0.337 | 0.418 | 0.334 |
| ppPoints | validation | 0.151 | 0.149 | 0.144 | 0.316 | 0.306 | 0.313 | 0.295 | 0.320 | 0.281 |
| ppPoints | test | 0.156 | 0.150 | 0.147 | 0.321 | 0.312 | 0.320 | 0.300 | 0.327 | 0.283 |
| ppPoints | live | 0.172 | 0.170 | 0.168 | 0.376 | 0.346 | 0.370 | 0.277 | 0.348 | 0.213 |
| hits | validation | 0.909 | 0.909 | 0.909 | 1.225 | 1.202 | 1.223 | 0.496 | 0.512 | 0.498 |
| hits | test | 0.869 | 0.868 | 0.870 | 1.182 | 1.150 | 1.178 | 0.515 | 0.532 | 0.518 |
| hits | live | 0.955 | 0.904 | 0.947 | 1.306 | 1.209 | 1.293 | 0.479 | 0.528 | 0.481 |
| blocks | validation | 0.759 | 0.752 | 0.761 | 1.001 | 0.968 | 1.000 | 0.384 | 0.419 | 0.385 |
| blocks | test | 0.730 | 0.731 | 0.734 | 0.957 | 0.931 | 0.959 | 0.370 | 0.404 | 0.371 |
| blocks | live | 0.748 | 0.720 | 0.751 | 1.019 | 0.928 | 1.020 | 0.322 | 0.409 | 0.320 |

Per-game MAE by position, test season (selected vs baseline):

| Target | C | W | D |
|---|---|---|---|
| goals | 0.316 vs 0.313 | 0.352 vs 0.350 | 0.139 vs 0.137 |
| assists | 0.413 vs 0.409 | 0.409 vs 0.406 | 0.384 vs 0.381 |
| shots | 1.051 vs 1.074 | 1.103 vs 1.130 | 0.908 vs 0.929 |
| ppPoints | 0.171 vs 0.176 | 0.186 vs 0.194 | 0.095 vs 0.097 |
| hits | 0.871 vs 0.872 | 0.919 vs 0.928 | 0.809 vs 0.808 |
| blocks | 0.622 vs 0.628 | 0.570 vs 0.571 | 0.975 vs 0.990 |

## Probability calibration — P(skater scores ≥ 1 goal)

| Split | Projection | Brier | Log loss | ECE |
|---|---|---|---|---|
| validation | selected | 0.1203 | 0.3963 | 0.0149 |
| validation | baseline | 0.1242 | 0.5440 | 0.0356 |
| test | selected | 0.1222 | 0.4019 | 0.0170 |
| test | baseline | 0.1263 | 0.5551 | 0.0382 |
| live | selected | 0.1245 | 0.4077 | 0.0262 |
| live | baseline | 0.1390 | 0.8995 | 0.0886 |

## Goalie models

The app has no goalie projection today, so the comparison baseline is a simple usage model: last-10 start share, and per-start season averages shrunk toward the league mean (5-start prior).

| Target | Selected | Split | Model | Baseline | Metric |
|---|---|---|---|---|---|
| started | model | validation | 0.4836 | 0.7214 | logLoss · Brier 0.1586 vs 0.2094 · ECE 0.0293 vs 0.0571 |
| started | model | test | 0.5208 | 0.7457 | logLoss · Brier 0.1743 vs 0.2242 · ECE 0.0182 vs 0.0678 |
| started | model | live | 0.5406 | 1.2107 | logLoss · Brier 0.1823 vs 0.2637 · ECE 0.0473 vs 0.1170 |
| saves | model | validation | 6.9281 | 7.1439 | rmse |
| saves | model | test | 6.8936 | 7.1655 | rmse |
| saves | model | live | 6.8098 | 7.3055 | rmse |
| ga | model | validation | 1.5344 | 1.5509 | rmse |
| ga | model | test | 1.4976 | 1.5062 | rmse |
| ga | model | live | 1.5517 | 1.5649 | rmse |
| win | model | validation | 0.6764 | 0.6978 | logLoss · Brier 0.2418 vs 0.2519 · ECE 0.0433 vs 0.0487 |
| win | model | test | 0.6934 | 0.7028 | logLoss · Brier 0.2501 vs 0.2545 · ECE 0.0531 vs 0.0579 |
| win | model | live | 0.6717 | 0.6991 | logLoss · Brier 0.2395 vs 0.2525 · ECE 0.0424 vs 0.0651 |
| shutout | model | validation | 0.2172 | 0.2180 | logLoss · Brier 0.0535 vs 0.0535 · ECE 0.0011 vs 0.0001 |
| shutout | model | test | 0.1758 | 0.1764 | logLoss · Brier 0.0403 vs 0.0404 · ECE 0.0156 vs 0.0150 |
| shutout | model | live | 0.1582 | 0.1579 | logLoss · Brier 0.0346 vs 0.0346 · ECE 0.0202 vs 0.0215 |

Expected weekly goalie fantasy points (P(start) × E[points | start]; default scoring):

| Split | Projection | MAE | RMSE | Bias | ρ |
|---|---|---|---|---|---|
| validation | benchBossSelected | 2.389 | 3.497 | 0.290 | 0.240 |
| validation | usageBaseline | 2.319 | 3.472 | 0.225 | 0.264 |
| validation | confirmedStarter | 2.170 | 3.379 | 0.262 | 0.317 |
| test | benchBossSelected | 2.429 | 3.436 | 0.438 | 0.204 |
| test | usageBaseline | 2.357 | 3.415 | 0.351 | 0.224 |
| test | confirmedStarter | 2.224 | 3.345 | 0.478 | 0.291 |
| live | benchBossSelected | 2.273 | 3.295 | 0.424 | 0.087 |
| live | usageBaseline | 2.296 | 3.261 | 0.658 | 0.169 |
| live | confirmedStarter | 2.102 | 3.192 | 0.474 | 0.210 |

Goalie start-probability reliability (test season):

| Bin | n | Predicted | Observed |
|---|---|---|---|
| 0.0-0.1 | 681 | 0.0595 | 0.0338 |
| 0.1-0.2 | 957 | 0.15 | 0.1452 |
| 0.2-0.3 | 878 | 0.2489 | 0.2563 |
| 0.3-0.4 | 672 | 0.3485 | 0.3601 |
| 0.4-0.5 | 607 | 0.4504 | 0.458 |
| 0.5-0.6 | 599 | 0.5492 | 0.5793 |
| 0.6-0.7 | 711 | 0.6536 | 0.6906 |
| 0.7-0.8 | 620 | 0.7458 | 0.7645 |
| 0.8-0.9 | 317 | 0.836 | 0.877 |
| 0.9-1.0 | 32 | 0.9181 | 0.9375 |

## Availability — scratches, injuries and other missed games

One row per team game for every skater who played for that team in its previous 10 games; `played` is whether he dressed. Weekly fantasy points here **include missed games as 0**, and use the production per-game baseline as the projection when he plays, so the only difference between rows is how availability is handled.

Play rate: validation 0.832, test 0.814, live 0.838. Top features: played_prev, last_toi, played_share_l5, played_share_l10, avg_toi_l5, miss_streak.

| Split | Availability approach | Weekly games MAE | Weekly FP MAE | Weekly FP RMSE | FP bias |
|---|---|---|---|---|---|
| validation | assumesPlaysEveryGame | 0.496 | 1.872 | 2.459 | 0.541 |
| validation | recentShare | 0.418 | 1.684 | 2.285 | 0.045 |
| validation | availabilityModel | 0.253 | 1.525 | 2.095 | 0.024 |
| test | assumesPlaysEveryGame | 0.567 | 1.939 | 2.548 | 0.626 |
| test | recentShare | 0.456 | 1.712 | 2.326 | 0.061 |
| test | availabilityModel | 0.266 | 1.532 | 2.119 | 0.042 |
| live | assumesPlaysEveryGame | 0.395 | 1.751 | 2.432 | 0.383 |
| live | recentShare | 0.305 | 1.582 | 2.253 | 0.030 |
| live | availabilityModel | 0.212 | 1.488 | 2.150 | -0.018 |

| Split | P(plays) | Brier | Log loss | ECE |
|---|---|---|---|---|
| validation | availabilityModel | 0.0587 | 0.2088 | 0.0041 |
| validation | recentShare | 0.1035 | 0.4833 | 0.0549 |
| validation | assumesPlaysEveryGame | 0.1684 | ∞ | — |
| test | availabilityModel | 0.0623 | 0.2202 | 0.0023 |
| test | recentShare | 0.1101 | 0.5102 | 0.0564 |
| test | assumesPlaysEveryGame | 0.1859 | ∞ | — |
| live | availabilityModel | 0.0597 | 0.2094 | 0.0079 |
| live | recentShare | 0.0951 | 0.4919 | 0.0520 |
| live | assumesPlaysEveryGame | 0.1615 | ∞ | — |

## Known limitations

- The skater stat tables score games played; the availability section scores missed games separately. Combining both into one projection is not done yet.
- Missed games are not split into injury, healthy scratch, suspension or demotion: the NHL public data has no historical injury reports.
- There is no line-combination feed. Power-play share and TOI rank from earlier games stand in for line and PP-unit placement.
- Historical confirmed starters come from game results. The confirmedStarter row shows the value of knowing the starter, not of a pre-game forecast.
- Goalie start candidates are goalies who appeared for the team in its previous 20 games; a fresh call-up cannot be predicted.
- Relief appearances are not counted in goalie weekly actuals.
- Intervals use a per-stat negative-binomial variance, ignore covariance between stats, and are rescaled on the validation season.
- The first collected season has no previous-season features. 2019-20 (stopped in March) and 2020-21 (56 games, division-only schedule) are included as-is.
