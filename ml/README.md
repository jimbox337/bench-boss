# Bench Boss projection research pipeline

An offline pipeline that collects free, public NHL game data, builds pre-game features,
trains local LightGBM models, and compares them with the projection the app uses today.

**Status: in the app (with fallback).** The latest model (`bench-boss-lgbm-20261106`) passed the
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
.venv/bin/python -m benchboss_ml.collect --seasons 20152016 20162017 20172018 20182019 20192020 20202021 20212022 20222023 20232024 20242025 20252026 20262027
.venv/bin/python -m benchboss_ml.dataset
.venv/bin/python -m benchboss_ml.train
.venv/bin/python -m pytest -q tests
```

- **collect**: downloads regular-season player-game rows in 10-day windows (each NHL query is capped at 10,000 rows). It throttles to about 2.5 requests per second. Each season is roughly 100 requests and 1.5 MB compressed, so the full 12-season pull takes several minutes.
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

- **Skaters**: LightGBM Poisson models per stat for goals, assists, shots, PP points, hits and blocks. Three booster candidates per stat:
  - *direct*: all features
  - *residual*: starts from log(production baseline) and learns only context and usage multipliers
  - *residual on shrunk*: the same, starting from log(shrunk baseline)

  The served projection per stat is a stack of these and the two baselines (see Results).
- **Goalies**: start probability (binary), and conditional on starting: saves, goals against (Poisson), win and shutout (binary).
- **Uncertainty**: a per-stat negative-binomial dispersion is fitted on validation. Weekly fantasy-point variance is combined from it, and the 80% interval is rescaled on validation so its coverage is right (test coverage is reported).
- **Baselines**: the app's current blend (45% season, 25% L20, 20% L10, 10% L5), plus a plain season average. Goalies are compared with a usage-share and shrunk per-start average baseline.

## Evaluation (Phase 4)

- **Chronological split**: train on every completed season except the last two (2015-16 through 2023-24), validate on 2024-25, test on 2025-26. The in-progress 2026-27 season is a "live" holdout scored with the exported fit. `choose_split` in `train.py` rolls this forward automatically as seasons complete.
- **Selection**: per stat, uses validation weekly RMSE (player-week sums), because the app projects weeks.
- **Metrics reported**: MAE, RMSE, bias, Spearman ρ, top-50 weekly precision, same-position start/sit pair accuracy, goal-probability and goalie-probability calibration (Brier, log loss, ECE, reliability bins), per-position breakdowns, and 80% interval coverage.

### Promotion gate

On **both** validation and test, the combined weekly fantasy-point projection must:

1. beat the production baseline on weekly MAE **and** RMSE, and
2. not lose more than 0.005 in start/sit accuracy or top-50 precision.

### Results (`bench-boss-lgbm-20261106`, 12 seasons)

| Weekly fantasy points, 2025-26 test | Production baseline | Previous model (20261105) | Bench Boss model |
|---|---|---|---|
| MAE | 1.604 | 1.580 | **1.574** (−1.9%) |
| RMSE | 2.170 | 2.129 | **2.123** (−2.2%) |
| Rank correlation | 0.704 | 0.712 | **0.714** |
| Top-50 precision | 0.459 | 0.463 | **0.466** |
| Start/sit accuracy | 0.759 | 0.762 | 0.761 |

On the in-progress 2026-27 season (unseen by every fit) weekly MAE is 1.425 vs 1.433 for the previous model and 1.486 for the baseline, and RMSE is 1.998 vs 2.019 and 2.125.

- **Stacking (new in 20261106):** instead of picking one projection per stat, each stat is a non-negative weighted sum of the production baseline, the shrunk baseline and the direct, residual and residual-on-shrunk boosters. Weights are fitted by NNLS on validation player-week sums, so test and live stay untouched. The direct model ranks single games best but is biased low, while the shrunk baseline is unbiased but blunter; stacking takes the strengths of both. Then 75% stack and 25% production baseline, chosen on validation ranking metrics.

- **What helps:** empirical-Bayes shrinkage of player rates toward last season and ice time, plus small context multipliers (opponent, rest, usage) for shots, PP points and hits. These are now combined by the stack above.
- **Goalie starts:** the model picks the actual starter 73–76% of the time, versus 59–62% for recent usage. That's after adding the rotation features (back-to-back after starting, streaks, rough last start, workload rank).
- **Expected goals:** the xG model is good on its own (test AUC 0.737 vs 0.695 for distance only). Its player features barely move weekly fantasy accuracy (test MAE 1.577 vs 1.579), and serving them would need per-game play-by-play, so xG stays offline.
- **Goalies in the app:** the start, saves, goals-against, win and shutout boosters are served too. Each goalie's week is the sum over his team's games of P(start) × per-start estimates; start probabilities are normalised per team game, and for a back-to-back inside the week "started the previous game" is that game's start probability. Starts are labelled projected, not confirmed. `lib/model/features.test.ts` checks the runtime goalie features against Python on a fixture day. The previous-season save % at runtime comes from the season aggregate (including relief appearances), while training uses starts only.
- **Availability:** P(dress) has validation log loss 0.209, versus 0.483 for recent play share. It weights each game in the app's weekly projection.
- **First live night (2026-11-04, locked before puck drop):**
  - Skater fantasy-point MAE: 0.972 for v2, versus 1.006 for the baseline.
  - Starting goalies: 1 of 8 correct, before the rotation features existed.

## Neural challenger (experiment, not served)

`benchboss_ml/neural.py` trains one small shared network for all six skater stats: two hidden ReLU layers (128, 64) with dropout and weight decay, and six Poisson outputs, each offset by log(shrunk baseline). It uses the same features, the same chronological split and early stopping on the validation season. It trains on a laptop CPU in a few minutes (`pip install -r requirements-neural.txt`; `train --no-neural` skips it). It runs in a child process, because PyTorch and LightGBM deadlock in one process on macOS (OpenMP).

It competes rather than replaces. It joins the LightGBM stack as one more NNLS component, so validation chooses its weight. It reaches the app only if the ensemble passes a stricter gate: better weekly MAE and RMSE than the current model, no loss in start/sit or top-50, at most 0.5% worse MAE for forwards or defence, on validation **and** test. Even then it stays behind `BENCHBOSS_NEURAL=1`.

**First result (20261106): not promoted.**

| Weekly FP, 2025-26 test | Baseline | LightGBM (served) | Neural alone | LightGBM + neural |
|---|---|---|---|---|
| MAE | 1.604 | **1.574** | 1.603 | **1.574** |
| RMSE | 2.170 | 2.123 | 2.200 | 2.123 |
| Start/sit | 0.760 | 0.761 | 0.758 | 0.762 |
| Top-50 | 0.459 | **0.466** | 0.448 | 0.465 |

On its own the network is about baseline quality. It is biased low (−0.19 FP per week on test) and ranks players worse than the shrunk baseline it starts from. Validation gave it weight only for assists (0.06), so the ensemble is the current model to three decimals, and it fails the start/sit (validation) and top-50 (test) checks by about 0.001. As expected, better inputs (injuries, lines, roles) matter more than the model family.

The exported weights ship in the app artifact (about 300 KB). `lib/model/neural.ts` reproduces PyTorch to 1e-4, and a week of projections for the whole league takes about 50 ms. The daily runner also writes shadow `nn_*` projections, scored as `neuralShadow` but never shown, so live evidence builds up for a future promotion.

## Daily track record

`python -m benchboss_ml.daily` collects the current season, locks today's games before puck drop, and scores yesterday's. Each run appends a line to `predictions/daily-log.jsonl`.

It runs every day at 15:00 UTC (10:00 ET) on GitHub Actions (`.github/workflows/daily-predictions.yml`). The NHL dataset is cached between runs, and the first run collects every training season once.

The running record is committed to the **`predictions` branch**, not `main`. `main` requires the Vercel check before anything lands, and a commit pushed straight from a CI runner can't have passed it. The `ml/predictions` folder on `main` is a snapshot from before the switch. To read the latest record, look at that branch (`git fetch origin predictions && git show origin/predictions:ml/predictions/daily-log.jsonl`).

Commits that only touch `ml/predictions` don't redeploy the site (`vercel.json` `ignoreCommand`).

`scripts/com.benchboss.daily.plist` is an optional local launchd job for the same thing.

## Limitations

- The weekly skater tables cover games actually played. Missed games are scored separately in the availability section.
- There is no injury, line-combination, power-play-unit or confirmed-starter data; the free public endpoints don't provide it reliably before puck drop. These are probably the biggest remaining source of error, and they would need a free, licensed source; news text from an LLM is not used as a data source.
- The first collected season (2015-16) has no previous-season features, and the 2019-20 and 2020-21 seasons were shortened.
- Intervals ignore covariance between stats.
- Goalie start candidates must have appeared for the team in its last 20 games.

## Possible next experiments (not done)

- Add a de-biasing step for the top of the distribution
- Use a weekly-sum objective
- Score availability with team-game rows that include missed games
