"""Runs tests/neural_checks.py in a separate interpreter (see that file for why)."""
import subprocess
import sys
from pathlib import Path

import pytest

pytest.importorskip("torch")


def test_neural_checks_in_fresh_process():
    here = Path(__file__).resolve().parent
    result = subprocess.run([sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider", str(here / "neural_checks.py")],
                            cwd=here.parent, capture_output=True, text=True, timeout=600)
    assert result.returncode == 0, result.stdout[-3000:] + result.stderr[-2000:]
