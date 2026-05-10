from __future__ import annotations
import json
from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import FileResponse

ROOT = Path(__file__).resolve().parents[2]
DASH = ROOT / "dashboard_exports"
RESULTS = ROOT / "results"
GRAPHS = ROOT / "graphs"
LOCAL = ROOT / "local_cloud_storage"
EXPORTS = LOCAL / "exports"

app = FastAPI(
    title="YAFS IIoT DQN Dashboard and Cloud API",
    version="4.1.0-dqn",
    description="Dashboard and cloud API for the YAFS IIoT DQN offloading simulation. The API validates and serves YAFS outputs including topology, seven-sensor events, DQN decisions, 10 performance KPIs, baseline comparison, cloud records, and report summaries.",
)

def read_json(path: Path, default=None):
    if path.exists():
        return json.loads(path.read_text())
    return default if default is not None else {"status": "missing", "path": str(path)}

@app.get("/")
def root():
    return {"status":"ok","docs":"/docs","model":"DQN","confirmed":"700 sensors, 220 edge, 79 fog, 1 cloud; 7S; 3L; 7F; 10P; 10B"}

@app.get("/health")
def health():
    return {"status":"ok","dashboard_exports":DASH.exists(),"results":RESULTS.exists()}

@app.get("/api/kpis")
def kpis(): return read_json(DASH/"kpis.json")

@app.get("/api/events")
def events(limit:int=500):
    data=read_json(DASH/"events.json", [])
    return {"count":len(data),"items":data[:limit]}

@app.get("/api/decisions")
def decisions(limit:int=500):
    data=read_json(DASH/"offloading_decisions.json", [])
    return {"count":len(data),"items":data[:limit]}

@app.get("/api/nodes")
def nodes(limit:int=1000):
    data=read_json(DASH/"nodes.json", [])
    return {"count":len(data),"items":data[:limit]}

@app.get("/api/topology")
def topology(): return read_json(DASH/"topology.json")

@app.get("/api/status-metrics")
def status_metrics(): return read_json(DASH/"status_metrics.json")

@app.get("/api/comparison")
def comparison(): return read_json(DASH/"comparison.json")

@app.get("/api/paths")
def paths(): return read_json(DASH/"paths.json")

@app.get("/api/summary")
def summary(): return read_json(DASH/"baseline_validation_summary.json")

@app.get("/api/scenarios")
def scenarios(): return read_json(DASH/"scenario_validation.json")

@app.get("/api/scalability")
def scalability(): return read_json(DASH/"scalability_validation.json")

@app.get("/api/drl-efficiency")
def drl_efficiency(): return read_json(DASH/"drl_efficiency.json")

@app.get("/api/final-demo-readiness")
def final_demo_readiness(): return read_json(DASH/"final_demo_readiness.json")

@app.get("/api/requirements-validation")
def requirements_validation(): return read_json(DASH/"requirements_validation.json")

@app.get("/api/shift-report")
def shift_report(): return read_json(DASH/"shift_report.json")

@app.get("/api/report")
def report(): return read_json(DASH/"shift_report.json")

@app.get("/api/cloud-records")
def cloud_records(limit:int=500):
    data=read_json(DASH/"cloud_records.json", [])
    return {"count":len(data),"items":data[:limit]}

@app.get("/api/status-trace")
def status_trace(limit:int=500):
    data=read_json(DASH/"status_condition_trace.json", [])
    return {"count":len(data),"items":data[:limit]}

@app.get("/api/exports")
def exports():
    items=[{"name":p.name,"size_bytes":p.stat().st_size} for p in sorted(EXPORTS.glob("*.json"), reverse=True)] if EXPORTS.exists() else []
    return {"count":len(items),"items":items}

@app.get("/api/graphs")
def graphs():
    items=[{"name":p.name,"url":f"/api/graphs/{p.name}","size_bytes":p.stat().st_size} for p in sorted(GRAPHS.glob("*.png"))]
    return {"count":len(items),"items":items}

@app.get("/api/graphs/{filename}")
def graph_file(filename:str):
    path=GRAPHS/filename
    if not path.exists(): return {"status":"missing","filename":filename}
    return FileResponse(path)
