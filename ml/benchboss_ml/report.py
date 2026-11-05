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
        "| Split | Passed | Weekly MAE better | Weekly RMSE better | Start/sit not worse | Top-50 not worse |",
        "|---|---|---|---|---|---|",
    ]
    for name, gate in skater["gate"].items():
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
        "- **benchBossSelected** — per stat, whichever of the three had the lowest validation weekly RMSE.",
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
                f"| {split_name} | {label} | {_f(m['mae'])}{delta} | {_f(m['rmse'])} | {_f(m['bias'])} | {_f(m['weeklySpearman'])} | "
                f"{_f(m['top50Precision'])} | {_f(m['startSitAccuracy'])} | {_f(m.get('interval80Coverage'))} |"
            )
    lines += ["", "Weekly fantasy-point MAE by position group (F = forwards, D = defence):", ""]
    for split_name, result in skater["weekly"].items():
        parts = "; ".join(f"{label} " + " / ".join(f"{g} {_f(v, 3)}" for g, v in m["byPositionMae"].items()) for label, m in result.items()
                          if label in ("benchBossSelected", "productionBaseline"))
        lines.append(f"- {split_name}: {parts}")

    lines += ["", "## Skater statistics", "",
              "Selection metric is validation weekly RMSE of the statistic (player-week sums).", "",
              "| Target | Selected | Shrink k / prior weight | baseline | shrunk | direct | residual | residualShrunk |", "|---|---|---|---|---|---|---|---|"]
    for target, info in skater["targets"].items():
        w = info["validationWeeklyRmse"]
        lines.append(f"| {target} | **{info['selected']}** | {_f(info.get('shrinkK'), 0)} / {_f(info.get('priorWeight'), 2)} | {_f(w['baseline'])} | {_f(w.get('shrunk'))} | "
                     f"{_f(w['direct'])} | {_f(w['residual'])} | {_f(w.get('residualShrunk'))} |")

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
