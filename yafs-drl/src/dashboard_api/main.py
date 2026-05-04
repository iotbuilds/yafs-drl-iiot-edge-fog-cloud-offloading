from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

ROOT = Path(__file__).resolve().parents[2]
DASH = ROOT / "dashboard_exports"
RESULTS = ROOT / "results"
GRAPHS = ROOT / "graphs"
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
    "decision_factors_7f": [
        "delay",
        "hop_count",
        "network_condition_congestion",
        "energy_consumption",
        "task_size",
        "bandwidth",
        "node_computing_capacity",
    ],
    "offloading_paths": ["local_edge", "edge_to_edge", "edge_to_fog", "fog_to_fog", "cloud_escalation"],
    "event_count": 10000,
    "cloud_role": "local cloud/API layer emulating centralized cloud analytics and dashboard access",
}

app = FastAPI(
    title="Integrated IIoT DRL/YAFS Local Cloud API",
    version="4.0.0",
    description=(
        "Dashboard-ready API for the confirmed YAFS-style/compatible IIoT DRL offloading simulation. "
        "The API serves validated YAFS outputs: topology, 7S events, DRL decisions, 10P KPIs, "
        "baseline comparison, cloud records, and report summaries."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _read_json(path: Path, default: Any = None, *, required: bool = False) -> Any:
    if path.exists():
        try:
            return json.loads(path.read_text())
        except Exception as exc:
            if required:
                raise HTTPException(status_code=500, detail=f"Could not parse {path.name}: {exc}")
            return default if default is not None else {"status": "parse_error", "path": str(path), "error": str(exc)}
    if required:
        raise HTTPException(status_code=404, detail=f"{path.name} not found. Run the YAFS export pipeline first.")
    return default if default is not None else {"status": "missing", "path": str(path)}


def _slice_items(data: Any, limit: int | None = None) -> dict[str, Any]:
    if isinstance(data, list):
        items = data[:limit] if limit else data
        return {"count": len(data), "items": items}
    return {"count": 0, "items": [], "raw": data}


def _latest_snapshot() -> dict[str, Any]:
    latest = _read_json(LATEST / "latest.json", None)
    if isinstance(latest, dict) and latest:
        return latest
    return {
        "status": "generated_from_dashboard_exports",
        "confirmed_requirements": CONFIRMED_REQUIREMENTS,
        "kpis": _read_json(DASH / "kpis.json", {}),
        "topology": _read_json(DASH / "topology.json", {}),
        "events_sample": _read_json(DASH / "events.json", [])[:250],
        "decisions_sample": _read_json(DASH / "offloading_decisions.json", [])[:250],
        "baseline_comparison": _read_json(DASH / "baseline_comparison.json", {}),
        "cloud_records_sample": _read_json(DASH / "cloud_records.json", [])[:250],
    }


@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "Integrated IIoT DRL/YAFS Local Cloud API",
        "docs": "/docs",
        "confirmed_requirements": CONFIRMED_REQUIREMENTS,
        "key_endpoints": [
            "/health",
            "/api/latest",
            "/api/topology",
            "/api/nodes",
            "/api/events",
            "/api/decisions",
            "/api/kpis",
            "/api/baselines",
            "/api/path-distribution",
            "/api/severity",
            "/api/cloud-records",
            "/api/report",
        ],
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "root": str(ROOT),
        "dashboard_exports_exists": DASH.exists(),
        "results_exists": RESULTS.exists(),
        "latest_exists": (LATEST / "latest.json").exists(),
    }


@app.get("/api/confirmed-requirements")
def confirmed_requirements():
    return CONFIRMED_REQUIREMENTS


@app.get("/api/latest")
def latest():
    return _latest_snapshot()


@app.get("/api/kpis")
def kpis():
    return _read_json(DASH / "kpis.json", required=True)


@app.get("/api/topology")
def topology():
    return _read_json(DASH / "topology.json", required=True)


@app.get("/api/nodes")
def nodes(limit: int = Query(1000, ge=1, le=5000)):
    data = _read_json(DASH / "nodes.json", [])
    return _slice_items(data, limit)


@app.get("/api/events")
def events(limit: int = Query(500, ge=1, le=10000)):
    data = _read_json(DASH / "events.json", [])
    return _slice_items(data, limit)


@app.get("/api/decisions")
def decisions(limit: int = Query(500, ge=1, le=10000)):
    data = _read_json(DASH / "offloading_decisions.json", [])
    return _slice_items(data, limit)


@app.get("/api/cloud-records")
def cloud_records(limit: int = Query(500, ge=1, le=10000)):
    data = _read_json(DASH / "cloud_records.json", [])
    return _slice_items(data, limit)


@app.get("/api/baselines")
def baselines():
    return _read_json(DASH / "baseline_comparison.json", required=True)


@app.get("/api/baseline-comparison")
def baseline_comparison():
    return _read_json(DASH / "baseline_comparison.json", required=True)


@app.get("/api/comparison")
def comparison():
    return _read_json(DASH / "comparison.json", required=True)


@app.get("/api/main-comparison")
def main_comparison():
    return _read_json(DASH / "main_comparison.json", _read_json(DASH / "baseline_comparison.json", {}))


@app.get("/api/path-distribution")
def path_distribution():
    k = _read_json(DASH / "kpis.json", {})
    return {
        "path_distribution_counts": k.get("path_distribution", {}),
        "path_distribution_ratio": k.get("confirmed_10p", {}).get("offloading_ratio_path_distribution", {}),
        "layer_offloading_ratios": k.get("offloading_ratios", {}),
    }


@app.get("/api/severity")
def severity():
    k = _read_json(DASH / "kpis.json", {})
    return {
        "classification": "3L only: normal, warning, critical",
        "severity_counts_3l": k.get("severity_counts_3l", {}),
        "total_events": k.get("total_events"),
    }


@app.get("/api/status-metrics")
def status_metrics():
    return _read_json(DASH / "status_metrics.json", {})


@app.get("/api/priority-analysis")
def priority_analysis():
    return _read_json(DASH / "priority_analysis.json", {})


@app.get("/api/paths")
def paths():
    return _read_json(DASH / "paths.json", {})


@app.get("/api/scenarios")
def scenarios():
    return _read_json(DASH / "scenario_validation.json", {})


@app.get("/api/scalability")
def scalability():
    return _read_json(DASH / "scalability_validation.json", {})


@app.get("/api/drl-efficiency")
def drl_efficiency():
    return _read_json(DASH / "drl_efficiency.json", {})


@app.get("/api/requirements-validation")
def requirements_validation():
    return _read_json(DASH / "requirements_validation.json", {})


@app.get("/api/final-demo-readiness")
def final_demo_readiness():
    return _read_json(DASH / "final_demo_readiness.json", {})


@app.get("/api/report")
def report():
    return _read_json(DASH / "report_summary.json", _read_json(DASH / "shift_report.json", {}))


@app.get("/api/shift-report")
def shift_report():
    return _read_json(DASH / "shift_report.json", {})


@app.get("/api/status-trace")
def status_trace(limit: int = Query(500, ge=1, le=10000)):
    data = _read_json(DASH / "status_condition_trace.json", [])
    return _slice_items(data, limit)


@app.get("/api/exports")
def exports():
    items = []
    if EXPORTS.exists():
        items = [{"name": p.name, "size_bytes": p.stat().st_size} for p in sorted(EXPORTS.glob("*.json"), reverse=True)]
    return {"count": len(items), "items": items[:200]}


@app.get("/api/graphs")
def graphs():
    items = []
    if GRAPHS.exists():
        items = [{"name": p.name, "url": f"/api/graphs/{p.name}", "size_bytes": p.stat().st_size} for p in sorted(GRAPHS.glob("*.png"))]
    return {"count": len(items), "items": items}


@app.get("/api/graphs/{filename}")
def graph_file(filename: str):
    path = GRAPHS / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"{filename} not found")
    return FileResponse(path)
