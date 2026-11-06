"""Render the evaluation JSON as a readable Markdown report."""
from __future__ import annotations

from typing import Any


def _f(value: Any, digits: int = 3) -> str:
    if value is None:
        return "—"
    try:
        number = float(value)
    except (TypeError, ValueError):
        return str(value)
    if number != number:  # NaN
        return "—"
    return f"{number:.{digits}f}"


def _delta(model: float, base: float, lower_is_better: bool = True) -> str:
    if not base or base != base or model != model:
        return "—"
    change = (model - base) / abs(base) * 100
    better = change < 0 if lower_is_better else change > 0
    return f"{change:+.1f}% {'✓' if better else '✗'}"


# Display names for report keys (keys stay stable so older evaluation.json files still render).
LABELS = {"neuralOnly": "benchSniperOnly", "lightgbmNeuralEnsemble": "lightgbmPlusBenchSniper"}


def render_markdown(report: dict[str, Any]) -> str:
    split = report["split"]
    skater = report["skater"]
    promotion = skater["promotion"]
    lines = [
        f"# Bench Boss model evaluation — `{report['modelVersion']}`",
        "",
        f"- Trained: {report['trainedAt']}",
        f"- Data through: {report['dataThrough']} (source: {report['source']}, fetched {report.get('sourceUpdatedAt') or 'unknown'})",
        f"- Pipeline {report['pipelineVersion']}, feature schema v{report['featureSchemaVersion']}",
        f"- Time-based split — train: {', '.join(split['train'])}; validation: {split['validation']}; "
        f"test: {split['test']}; live (in-progress, unseen by every fit): {split['live'] or 'n/a'}",
        f"- Rows: {report['rows']['skaterGames']:,} skater-games, {report['rows']['goalieCandidates']:,} goalie start candidates",
        "",
        "## Promotion decision",
        "",
        f"**{'ELIGIBLE for integration review' if promotion['eligible'] else 'NOT eligible — keep the production baseline'}.** "
        "This pipeline never changes the app; integration requires a separate, explicit decision.",
        "",
        f"Rule: {promotion['rule']}",
        "",
        *([f"Per-game weekly gate (information only; it lets later games in a week see earlier results): "
           + ", ".join(f"{k} {'passed' if v else 'failed'}" for k, v in promotion["perGameGate"].items()), ""]
          if promotion.get("perGameGate") else []),
        "Week-start backtest gate:",
        "",
        "| Split | Passed | Weekly MAE better | Weekly RMSE better | Start/sit not worse | Top-50 not worse |",
        "|---|---|---|---|---|---|",
    ]
    for name, gate in skater.get("gateWeekStart", skater["gate"]).items():
        c = gate["checks"]
        mark = lambda ok: "✓" if ok else "✗"  # noqa: E731
        lines.append(f"| {name}{' (informational)' if name == 'live' else ''} | {mark(gate['passed'])} | {mark(c['weeklyMaeImproves'])} | "
                     f"{mark(c['weeklyRmseImproves'])} | {mark(c['startSitNotWorse'])} | {mark(c['top50NotWorse'])} |")

    lines += [
        "",
        "Projections compared:",
        "- **productionBaseline** — today's app blend: 45% season-to-date, 25% last-20, 20% last-10, 10% last-5 per-game rates.",
        "- **directModelOnly** — LightGBM Poisson on all pre-game features for every stat.",
        "- **residualModelOnly** — LightGBM Poisson starting from log(baseline), learning only context/usage multipliers.",
        "- **shrunkBaselineOnly** — the production blend with empirical-Bayes shrinkage toward last season and a TOI-based prior (k tuned on validation).",
        "- **residualOnShrunkOnly** — LightGBM context/usage multipliers on top of the shrunk baseline.",
        "- **benchBossSelected** — the served LightGBM projection: per-stat NNLS stack of baselines and boosters, blended with the production baseline.",
        "- **benchSniperOnly** — BenchSniper alone (one shared neural network, six Poisson outputs on top of the shrunk baseline).",
        "- **lightgbmPlusBenchSniper** — the same stack with BenchSniper as one more component; validation picks its weight.",
        "",
        "## Weekly fantasy points (default Bench Boss scoring; games actually played)",
        "",
        "| Split | Projection | MAE | RMSE | Bias | Weekly ρ | Top-50 precision | Start/sit accuracy | 80% interval coverage |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for split_name, result in skater["weekly"].items():
        base = result["productionBaseline"]
        for label, m in result.items():
            delta = "" if label == "productionBaseline" else f" ({_delta(m['mae'], base['mae'])})"
            lines.append(
                f"| {split_name} | {LABELS.get(label, label)} | {_f(m['mae'])}{delta} | {_f(m['rmse'])} | {_f(m['bias'])} | {_f(m['weeklySpearman'])} | "
                f"{_f(m['top50Precision'])} | {_f(m['startSitAccuracy'])} | {_f(m.get('interval80Coverage'))} |"
            )
    lines += ["", "Weekly fantasy-point MAE by position group (F = forwards, D = defence):", ""]
    for split_name, result in skater["weekly"].items():
        parts = "; ".join(f"{LABELS.get(label, label)} " + " / ".join(f"{g} {_f(v, 3)}" for g, v in m["byPositionMae"].items()) for label, m in result.items()
                          if label in ("benchBossSelected", "productionBaseline", "neuralOnly", "lightgbmNeuralEnsemble"))
        lines.append(f"- {split_name}: {parts}")

    if skater.get("weeklyWeekStart"):
        lines += ["", "## Week-start backtest (how the app projects a week)", "",
                  "The per-game table above updates features before every game, so a later game in a week benefits from earlier results "
                  "of that week. The app projects the whole week once, from data through the day before. Here each player's history and "
                  "own-team features are frozen at his first game of the calendar week (days since last game advance; home, rest, "
                  "back-to-back, schedule and opponent stay per game), and the same models and weights are re-scored.", "",
                  "| Split | Projection | MAE | RMSE | Bias | Weekly ρ | Top-50 precision | Start/sit accuracy | Gate vs baseline |",
                  "|---|---|---|---|---|---|---|---|---|"]
        mark = lambda ok: "✓" if ok else "✗"  # noqa: E731
        for split_name, result in skater["weeklyWeekStart"].items():
            base = result["productionBaseline"]
            for label, m in result.items():
                delta = "" if label == "productionBaseline" else f" ({_delta(m['mae'], base['mae'])})"
                gate = mark(skater["gateWeekStart"][split_name]["passed"]) if label == "benchBossSelected" else ""
                lines.append(f"| {split_name} | {LABELS.get(label, label)} | {_f(m['mae'])}{delta} | {_f(m['rmse'])} | {_f(m['bias'])} | "
                             f"{_f(m['weeklySpearman'])} | {_f(m['top50Precision'])} | {_f(m['startSitAccuracy'])} | {gate} |")

    lines += ["", "## Skater statistics", "",
              "Selection metric is validation weekly RMSE of the statistic (player-week sums).", "",
              "| Target | Selected (servable) | Best incl. xG | Shrink k / prior weight | baseline | shrunk | direct | residual | residualShrunk | residualXg | stack |", "|---|---|---|---|---|---|---|---|---|---|---|"]
    for target, info in skater["targets"].items():
        w = info["validationWeeklyRmse"]
        lines.append(f"| {target} | **{info['selected']}** | {info.get('selectedIncludingXg', '—')} | {_f(info.get('shrinkK'), 0)} / {_f(info.get('priorWeight'), 2)} | {_f(w['baseline'])} | {_f(w.get('shrunk'))} | "
                     f"{_f(w['direct'])} | {_f(w['residual'])} | {_f(w.get('residualShrunk'))} | {_f(w.get('residualXg'))} | {_f(w.get('stack'))} |")
    stacks = {t: i["stackWeights"] for t, i in skater["targets"].items() if i.get("stackWeights")}
    if stacks:
        lines += ["", "Stack weights (non-negative least squares on validation player-week sums; the test and live seasons are untouched):", ""]
        lines += [f"- {t}: " + ", ".join(f"{n} {w:.3f}" for n, w in sorted(ws.items(), key=lambda kv: -kv[1])) for t, ws in stacks.items()]

    blend = skater.get("blend")
    if blend:
        lines += ["", f"Rank-aware blend: model weight **{blend['chosenModelWeight']}** (rest production baseline), chosen on validation "
                  "start/sit accuracy + top-50 precision among blends within 0.5% of the best weekly RMSE.", "",
                  "| Model weight | Weekly MAE | Weekly RMSE | Start/sit | Top-50 |", "|---|---|---|---|---|"]
        for weight, m in blend["validation"].items():
            lines.append(f"| {weight} | {_f(m['mae'])} | {_f(m['rmse'])} | {_f(m['startSitAccuracy'])} | {_f(m['top50Precision'])} |")

    nn = skater.get("neural")
    if nn:
        mark = lambda ok: "✓" if ok else "✗"  # noqa: E731
        lines += ["", "## BenchSniper (neural network)", "",
                  f"Gate basis: {'week-start backtest' if nn.get('gateBasis') == 'weekStart' else 'per-game backtest'}. Best epoch {nn['bestEpoch']} (early stopping on validation); ensemble model weight {nn['modelWeight']} vs the production baseline. "
                  f"**{'Promoted' if nn['promoted'] else 'Not promoted'}** — even when promoted it is served only with `BENCHSNIPER=1`.", "",
                  f"Rule: {nn['rule']}", "",
                  "| Split | Passed | MAE | RMSE | Start/sit | Top-50 | F MAE | D MAE |", "|---|---|---|---|---|---|---|---|"]
        for name, g in nn["gate"].items():
            c = g["checks"]
            lines.append(f"| {name} | {mark(g['passed'])} | {mark(c['weeklyMaeImproves'])} | {mark(c['weeklyRmseImproves'])} | {mark(c['startSitNotWorse'])} | "
                         f"{mark(c['top50NotWorse'])} | {mark(c['FMaeNotWorse'])} | {mark(c['DMaeNotWorse'])} |")
        if nn.get("daily"):
            lines += ["", "Daily (single-game) accuracy, per-game features as at puck drop. Poisson deviance is summed over the six stats; lower is better:", "",
                      "| Split | Projection | Poisson deviance | FP MAE | FP ρ |", "|---|---|---|---|---|"]
            for split_name, result in nn["daily"].items():
                for label, m in result.items():
                    lines.append(f"| {split_name} | {LABELS.get(label, label)} | {_f(m['poissonDevianceSum'], 4)} | {_f(m['fpMae'], 4)} | {_f(m['fpSpearman'])} |")
        lines += ["", "Stack weights with BenchSniper as a component (validation NNLS):", ""]
        lines += [f"- {t}: " + ", ".join(f"{'BenchSniper' if n == 'neural' else n} {w:.3f}" for n, w in sorted(ws.items(), key=lambda kv: -kv[1])) for t, ws in nn["stackWeights"].items()]

    xg = report.get("xg") or {}
    if xg.get("available"):
        lines += ["", "## Expected goals (xG)", "",
                  f"Logistic model on {xg['trainShots']:,} unblocked, non-empty-net attempts from training seasons (play-by-play seasons: "
                  f"{', '.join(xg['seasons'])}). Features: distance, angle, shot type, strength, rebound.", "",
                  "| Split | Shots | Goals | xG total | Log loss | AUC | Distance-only log loss | Distance-only AUC |", "|---|---|---|---|---|---|---|---|"]
        for name, m in xg["splits"].items():
            lines.append(f"| {name} | {m['shots']:,} | {m['goals']:,} | {_f(m['xgTotal'], 0)} | {_f(m['logLoss'], 4)} | {_f(m['auc'], 3)} | {_f(m['distanceOnlyLogLoss'], 4)} | {_f(m['distanceOnlyAuc'], 3)} |")
        lines += ["", "xG features (ixg, high-danger attempts) need per-game play-by-play at serving time, so the `residualXg` candidate "
                  "is evaluated offline (the `withXgOffline` weekly row) but not exported to the app."]

    lines += ["", "Per-game accuracy:", "",
              "| Target | Split | Baseline MAE | Direct MAE | Residual MAE | Baseline RMSE | Direct RMSE | Residual RMSE | Baseline ρ | Direct ρ | Residual ρ |",
              "|---|---|---|---|---|---|---|---|---|---|---|"]
    for target, info in skater["targets"].items():
        for split_name, s in info["scores"].items():
            b, d, r = s["productionBaseline"], s["direct"], s["residual"]
            lines.append(f"| {target} | {split_name} | {_f(b['mae'])} | {_f(d['mae'])} | {_f(r['mae'])} | {_f(b['rmse'])} | "
                         f"{_f(d['rmse'])} | {_f(r['rmse'])} | {_f(b['spearman'])} | {_f(d['spearman'])} | {_f(r['spearman'])} |")

    lines += ["", "Per-game MAE by position, test season (selected vs baseline):", "",
              "| Target | C | W | D |", "|---|---|---|---|"]
    for target, info in skater["targets"].items():
        pos = info["scores"].get("test", {}).get("byPosition", {})
        cells = [f"{_f(pos[p]['selectedMae'])} vs {_f(pos[p]['baselineMae'])}" if p in pos else "—" for p in ("C", "W", "D")]
        lines.append(f"| {target} | " + " | ".join(cells) + " |")

    lines += ["", "## Probability calibration — P(skater scores ≥ 1 goal)", "",
              "| Split | Projection | Brier | Log loss | ECE |", "|---|---|---|---|---|"]
    for split_name, cal in skater["calibration"].items():
        for label, m in cal.items():
            lines.append(f"| {split_name} | {label.split('_')[1]} | {_f(m['brier'], 4)} | {_f(m['logLoss'], 4)} | {_f(m['ece'], 4)} |")

    goalie = report["goalie"]
    lines += ["", "## Goalie models", "",
              "The app has no goalie projection today, so the comparison baseline is a simple usage model: last-10 start share, "
              "and per-start season averages shrunk toward the league mean (5-start prior).", "",
              "| Target | Selected | Split | Model | Baseline | Metric |", "|---|---|---|---|---|---|"]
    for target, info in goalie["targets"].items():
        for split_name, score in info["scores"].items():
            metric = "logLoss" if "logLoss" in score["model"] else "rmse"
            extra = ""
            if metric == "logLoss":
                extra = (f" · Brier {_f(score['model']['brier'], 4)} vs {_f(score['productionBaseline']['brier'], 4)}"
                         f" · ECE {_f(score['model']['ece'], 4)} vs {_f(score['productionBaseline']['ece'], 4)}")
            lines.append(f"| {target} | {info['selected']} | {split_name} | {_f(score['model'][metric], 4)} | "
                         f"{_f(score['productionBaseline'][metric], 4)} | {metric}{extra} |")
    lines += ["", "Expected weekly goalie fantasy points (P(start) × E[points | start]; default scoring):", "",
              "| Split | Projection | MAE | RMSE | Bias | ρ |", "|---|---|---|---|---|---|"]
    for split_name, result in goalie["weekly"].items():
        for label, m in result.items():
            lines.append(f"| {split_name} | {label} | {_f(m['mae'])} | {_f(m['rmse'])} | {_f(m['bias'])} | {_f(m['spearman'])} |")

    started = goalie["targets"].get("started", {}).get("scores", {})
    if any("pickAccuracy" in v for v in started.values()):
        lines += ["", "Starter pick accuracy (top candidate per team-game started; team-games whose starter was a candidate):", "",
                  "| Split | Model | Usage (last-10 share) | Team-games |", "|---|---|---|---|"]
        for split_name, score in started.items():
            pa = score.get("pickAccuracy")
            if pa:
                lines.append(f"| {split_name} | {_f(pa['model']['accuracy'])} | {_f(pa['usageBaseline']['accuracy'])} | {pa['model']['teamGames']:,} |")

    lines += ["", "Goalie start-probability reliability (test season):", "", "| Bin | n | Predicted | Observed |", "|---|---|---|---|"]
    for row in goalie["targets"].get("started", {}).get("scores", {}).get("test", {}).get("model", {}).get("reliability", []):
        lines.append(f"| {row['bin']} | {row['n']:,} | {row['predicted']} | {row['observed']} |")

    availability = report.get("availability")
    if availability:
        lines += ["", "## Availability — scratches, injuries and other missed games", "",
                  "One row per team game for every skater who played for that team in its previous 10 games; "
                  "`played` is whether he dressed. Weekly fantasy points here **include missed games as 0**, "
                  "and use the production per-game baseline as the projection when he plays, so the only difference "
                  "between rows is how availability is handled.", "",
                  "Play rate: " + ", ".join(f"{k} {_f(v)}" for k, v in availability["playRate"].items())
                  + f". Top features: {', '.join(availability['topFeatures'])}.", "",
                  "| Split | Availability approach | Weekly games MAE | Weekly FP MAE | Weekly FP RMSE | FP bias |", "|---|---|---|---|---|---|"]
        for split_name, out in availability["splits"].items():
            for label, m in out["weekly"].items():
                lines.append(f"| {split_name} | {label} | {_f(m['gamesMae'])} | {_f(m['fpMae'])} | {_f(m['fpRmse'])} | {_f(m['fpBias'])} |")
        lines += ["", "| Split | P(plays) | Brier | Log loss | ECE |", "|---|---|---|---|---|"]
        for split_name, out in availability["splits"].items():
            for label, m in out["probability"].items():
                lines.append(f"| {split_name} | {label} | {_f(m['brier'], 4)} | {_f(m['logLoss'], 4)} | {_f(m['ece'], 4)} |")
            lines.append(f"| {split_name} | assumesPlaysEveryGame | {_f(out['assumesPlaysBrier'], 4)} | ∞ | — |")

    lines += [
        "", "## Known limitations", "",
        "- The skater stat tables score games played; the availability section scores missed games separately. Combining both into one projection is not done yet.",
        "- Missed games are not split into injury, healthy scratch, suspension or demotion: the NHL public data has no historical injury reports.",
        "- There is no line-combination feed. Power-play share and TOI rank from earlier games stand in for line and PP-unit placement.",
        "- Historical confirmed starters come from game results. The confirmedStarter row shows the value of knowing the starter, not of a pre-game forecast.",
        "- Goalie start candidates are goalies who appeared for the team in its previous 20 games; a fresh call-up cannot be predicted.",
        "- Relief appearances are not counted in goalie weekly actuals.",
        "- Intervals use a per-stat negative-binomial variance, ignore covariance between stats, and are rescaled on the validation season.",
        "- The first collected season has no previous-season features. 2019-20 (stopped in March) and 2020-21 (56 games, division-only schedule) are included as-is.",
        "",
    ]
    return "\n".join(lines)
