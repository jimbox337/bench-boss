from pathlib import Path

ML_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ML_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
MANIFEST_PATH = DATA_DIR / "manifest.json"
REPORTS_DIR = ML_ROOT / "reports"
# Candidate model artifacts. Kept out of the app bundle: nothing in the Next.js app loads
# them until a model passes the promotion gate and integration is explicitly approved.
ARTIFACT_DIR = ML_ROOT / "artifacts"
