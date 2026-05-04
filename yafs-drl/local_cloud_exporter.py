from __future__ import annotations

import json
import shutil
import time
from datetime import datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
DASH = ROOT / "dashboard_exports"
LOCAL = ROOT / "local_cloud_storage"
LATEST = LOCAL / "latest"
EXPORTS = LOCAL / "exports"

CONFIRMED_REQUIREMENTS = {
    "topology_distribution": {"sensor": 700, "edge": 220, "fog": 79, "cloud": 1, "total": 1000},
    "sensor_distribution_7s": {
        "vibration": 120,
        "temperature": 120,
        "pressure": 100,
        "current": 100,
        "acoustic": 100,
        "flow_rate": 80,
        "humidity": 80,
    },
    "classification_levels_3l": ["normal", "warning", "critical"],
    "cloud_transmission_policy_3l": {
        "critical": "transmit/update to cloud every 1 minute",
        "warning": "transmit/update to cloud every 3 minutes; repeated_warning is a flag, not a status level",
        "normal": "edge aggregates normal readings and sends one summary per node per 5-minute window",
    },
    "events": 10000,
    "source_of_truth": "YAFS_DRL_7F_Final_Demo_Validated_G simulation outputs",
    "cloud_role": "local cloud/API layer emulating centralized cloud analytics and dashboard access",
}

FILES = [
    "kpis.json",
    "topology.json",
    "nodes.json",
    "node_status.json",
    "events.json",
    "offloading_decisions.json",
    "baseline_comparison.json",
    "baseline_decisions.json",
    "baseline_validation_summary.json",
    "comparison.json",
    "main_comparison.json",
    "paths.json",
    "cloud_records.json",
    "status_metrics.json",
    "status_condition_trace.json",
    "priority_analysis.json",
    "scenario_validation.json",
    "scalability_validation.json",
    "drl_efficiency.json",
    "requirements_validation.json",
    "final_demo_readiness.json",
    "shift_report.json",
    "report_summary.json",
]


def read_json(path: Path, default: Any = None) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text())
    except Exception:
        return default


def export_once() -> Path:
    LATEST.mkdir(parents=True, exist_ok=True)
    EXPORTS.mkdir(parents=True, exist_ok=True)

    payload = {
        "exported_at": datetime.now().isoformat(timespec="seconds"),
        "confirmed_requirements": CONFIRMED_REQUIREMENTS,
        "source_folder": str(ROOT),
        "files": {},
        "dashboard_samples": {},
    }

    for name in FILES:
        src = DASH / name
        if not src.exists():
            continue
        dst = LATEST / name
        shutil.copy2(src, dst)
        content = read_json(src, {"copied": True})
        payload["files"][name] = {
            "path": str(dst),
            "size_bytes": dst.stat().st_size,
        }
        if name in {"kpis.json", "baseline_comparison.json", "topology.json", "shift_report.json", "requirements_validation.json"}:
            payload["dashboard_samples"][name.replace(".json", "")] = content
        elif name in {"events.json", "offloading_decisions.json", "cloud_records.json"} and isinstance(content, list):
            payload["dashboard_samples"][name.replace(".json", "")] = content[:100]

    raw = EXPORTS / f"yafs_drl_7f_integrated_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    raw.write_text(json.dumps(payload, indent=2))
    (LATEST / "latest.json").write_text(json.dumps(payload, indent=2))
    print(f"[OK] Updated latest snapshot: {LATEST / 'latest.json'}")
    print(f"[OK] Archived cloud export: {raw}")
    return raw


def main(interval: int = 60):
    while True:
        export_once()
        print(f"[WAIT] Next export in {interval} seconds...")
        time.sleep(interval)


if __name__ == "__main__":
    main()
