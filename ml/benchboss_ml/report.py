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
              "| Target | Selected | Val weekly RMSE baseline | direct | residual |", "|---|---|---|---|---|"]
    for target, info in skater["targets"].items():
        w = info["validationWeeklyRmse"]
        lines.append(f"| {target} | **{info['selected']}** | {_f(w['baseline'])} | {_f(w['direct'])} | {_f(w['residual'])} |")

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

    lines += [
        "", "## Known limitations", "",
        "- Skater evaluation conditions on games actually played. It does not score availability or the number of games played, so scratches and injuries are outside these numbers.",
        "- No injury, line-combination, or confirmed-starter data is used. The NHL public endpoints do not provide them reliably.",
        "- Goalie start candidates are goalies who appeared for the team in its previous 20 games; a fresh call-up cannot be predicted.",
        "- Relief appearances are not counted in goalie weekly actuals.",
        "- Intervals use a per-stat negative-binomial variance, ignore covariance between stats, and are rescaled on the validation season.",
        "- Only four completed seasons are used (2022-23 onward); 2022-23 rows have no previous-season features.",
        "",
    ]
    return "\n".join(lines)
