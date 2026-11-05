#!/bin/zsh
# Daily lock-and-score for Bench Boss (run by launchd: ~/Library/LaunchAgents/com.benchboss.daily.plist).
# Collects the latest NHL results, locks today's predictions before puck drop and scores
# yesterday's. Output is appended to ml/data/daily-run.log (gitignored).
set -euo pipefail
cd "$(dirname "$0")/.."
{
  echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ) daily run ==="
  .venv/bin/python -m benchboss_ml.daily
  echo "=== done $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
} >> data/daily-run.log 2>&1
