# Bench Boss projection research pipeline

An offline pipeline that collects free, public NHL game data, builds pre-game features,
trains local LightGBM models, and compares them with the projection the app uses today.

**Status: in the app (with fallback).** The latest model (`bench-boss-lgbm-20261105`) passed the
promotion gate on the validation and the untouched test season, so its artifact ships in
`lib/model/artifacts/` and the app serves its projections, labelled as model estimates. Any model
error, timeout or an artifact that fails the gate falls back to the schedule-aware engine. See
[`reports/evaluation.md`](reports/evaluation.md).

## Setup (project-local, never touches global Python)

```bash
python3 -m venv ml/.venv
ml/.venv/bin/pip install -r ml/requirements.txt
```

macOS needs OpenMP for LightGBM (`brew install libomp`). Tested with Python 3.14.

## Refreshing data and models

Run from the `ml/` directory:

```bash
cd ml
.venv/bin/python -m benchboss_ml.collect --seasons 20222023 20232024 20242025 20252026 20262027
.venv/bin/python -m benchboss_ml.dataset
.venv/bin/python -m benchboss_ml.train
.venv/bin/python -m pytest -q tests
```

- **collect**: downloads regular-season player-game rows in 10-day windows (each NHL query is capped at 10,000 rows). It throttles to about 2.5 requests per second. A full five-season pull is about 485 requests and 7 MB compressed.
- **Incremental runs**: any window that ended more than 3 days ago is marked final in `data/manifest.json` and skipped next time (`--force` re-fetches it). A typical refresh is about 10 requests. Rows are de-duplicated on `gameId + playerId` (or `gameId + team side`), so re-runs never create duplicate games.
- **dataset**: normalizes the raw files into `data/processed/{skater,goalie,team}_games.parquet`.
- **train**: builds features, trains, evaluates, and writes:
  - `reports/evaluation.md` / `evaluation.json` (committed)
  - `artifacts/<modelVersion>.json`, a compact tree export plus LightGBM parity samples (gitignored)

`data/`, `artifacts/` and `.venv/` are gitignored. The manifest records each window's fetch timestamp and row count, plus the pipeline version. Every report and artifact records model version, training date, data-through date and source fetch time.

## Data source

`https://api.nhle.com/stats/rest/en/{skater,goalie,team}/{summary,realtime,timeonice}?isGame=true`
are the public, unauthenticated endpoints behind NHL.com's stats pages. They're used here for
non-commercial analysis at a low request rate. No paid, scraped, or third-party projection data is used.

## Features (Phase 2)

Each player-game uses only games **strictly before it**, plus the published schedule:

- Season-to-date per-game rates, and last-20, 10 and 5 game rates (within the season), for goals, assists, shots, PP points, hits, blocks, TOI and PP TOI
- Previous-season rates and games played
- Home/away, rest days (capped at 10), back-to-back flag, team games in the 7 days starting with this game, days since the player's last game
- Historical availability: player games ÷ team games over the prior 30 days
- Team scoring environment (GF/game, last-10 GF, shots/game) and opponent strength (GA/game, last-10 GA, shots against/game)
- Position (C / W / D)
- Goalies: start share over the team's last 5/10/20 games, whether they started the previous game, days since their last start, season save %, GA per start and win rate, previous-season save %, team and opponent context

`tests/test_features.py` changes the target game and every later game, then asserts that no earlier feature moves. It also checks the window, rest, availability and baseline arithmetic.

## Models (Phase 3)

- **Skaters**: one LightGBM Poisson model per stat for goals, assists, shots, PP points, hits and blocks. Two candidates per stat:
  - *direct*: all features
  - *residual*: starts from log(production baseline) and learns only context and usage multipliers
- **Goalies**: start probability (binary), and conditional on starting: saves, goals against (Poisson), win and shutout (binary).
- **Uncertainty**: a per-stat negative-binomial dispersion is fitted on validation. Weekly fantasy-point variance is combined from it, and the 80% interval is rescaled on validation so its coverage is right (test coverage is reported).
- **Baselines**: the app's current blend (45% season, 25% L20, 20% L10, 10% L5), plus a plain season average. Goalies are compared with a usage-share and shrunk per-start average baseline, because the app has no goalie projection today.

## Evaluation (Phase 4)

- **Chronological split**: train on 2022-23 and 2023-24, validate on 2024-25, test on 2025-26. The in-progress 2026-27 season is a "live" holdout scored with the exported fit.
- **Selection**: per stat, uses validation weekly RMSE (player-week sums), because the app projects weeks.
- **Metrics reported**: MAE, RMSE, bias, Spearman ρ, top-50 weekly precision, same-position start/sit pair accuracy, goal-probability and goalie-probability calibration (Brier, log loss, ECE, reliability bins), per-position breakdowns, and 80% interval coverage.

### Promotion gate

On **both** validation and test, the combined weekly fantasy-point projection must:

1. beat the production baseline on weekly MAE **and** RMSE, and
2. not lose more than 0.005 in start/sit accuracy or top-50 precision.

### Results (`bench-boss-lgbm-20261105`, 12 seasons)

| Weekly fantasy points, 2025-26 test | Production baseline | Bench Boss model |
|---|---|---|
| MAE | 1.604 | **1.579** (−1.5%) |
| RMSE | 2.170 | **2.129** (−1.9%) |
| Rank correlation | 0.704 | **0.712** |
| Top-50 precision | 0.459 | **0.463** |
| Start/sit accuracy | 0.759 | **0.762** |

- **What helps:** empirical-Bayes shrinkage of player rates toward last season and ice time, plus small context multipliers (opponent, rest, usage) for shots, PP points and hits. The final projection is a 50/50 blend with the production baseline. That weight was chosen on validation start/sit accuracy and top-50 precision.
- **Goalie starts:** the model picks the actual starter 73–76% of the time, versus 59–62% for recent usage. That's after adding the rotation features (back-to-back after starting, streaks, rough last start, workload rank).
- **Expected goals:** the xG model is good on its own (test AUC 0.737 vs 0.695 for distance only). Its player features barely move weekly fantasy accuracy (test MAE 1.577 vs 1.579), and serving them would need per-game play-by-play, so xG stays offline.
- **Availability:** P(dress) has validation log loss 0.209, versus 0.483 for recent play share. It weights each game in the app's weekly projection.
- **First live night (2026-11-04, locked before puck drop):**
  - Skater fantasy-point MAE: 0.972 for v2, versus 1.006 for the baseline.
  - Starting goalies: 1 of 8 correct, before the rotation features existed.

## Daily track record

`python -m benchboss_ml.daily` collects the current season, locks today's games before puck drop, and scores yesterday's. Each run appends a line to `predictions/daily-log.jsonl`.

It runs every day at 15:00 UTC (10:00 ET) on GitHub Actions (`.github/workflows/daily-predictions.yml`). The NHL dataset is cached between runs, and the first run collects every training season once.

The running record is committed to the **`predictions` branch**, not `main`. `main` requires the Vercel check before anything lands, and a commit pushed straight from a CI runner can't have passed it. The `ml/predictions` folder on `main` is a snapshot from before the switch. To read the latest record, look at that branch (`git fetch origin predictions && git show origin/predictions:ml/predictions/daily-log.jsonl`).

Commits that only touch `ml/predictions` don't redeploy the site (`vercel.json` `ignoreCommand`).

`scripts/com.benchboss.daily.plist` is an optional local launchd job for the same thing.

## Limitations

- The weekly skater tables cover games actually played. Missed games are scored separately in the availability section.
- There is no injury, line-combination or confirmed-starter data; the public endpoints don't provide it reliably.
- Only four completed seasons are used, and 2022-23 has no previous-season features.
- Intervals ignore covariance between stats.
- Goalie start candidates must have appeared for the team in its last 20 games.

## Possible next experiments (not done)

- Fit a calibrated blend weight between the baseline and residual projections on validation, targeting rank metrics
- Add a de-biasing step for the top of the distribution
- Use a weekly-sum objective
- Add more seasons
- Score availability with team-game rows that include missed games
