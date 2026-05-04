from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from local_cloud_exporter import export_once  # noqa: E402

if __name__ == "__main__":
    export_once()
