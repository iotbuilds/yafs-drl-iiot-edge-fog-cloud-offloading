from __future__ import annotations
import json, shutil, time
from datetime import datetime
from pathlib import Path
ROOT=Path(__file__).resolve().parent
DASH=ROOT/'dashboard_exports'
LOCAL=ROOT/'local_cloud_storage'; LATEST=LOCAL/'latest'; EXPORTS=LOCAL/'exports'
FILES=['kpis.json','baseline_validation_summary.json','scenario_validation.json','scalability_validation.json','drl_efficiency.json','final_demo_readiness.json','requirements_validation.json','shift_report.json','offloading_decisions.json','events.json','node_status.json','cloud_records.json','status_condition_trace.json']
def export_once():
    LATEST.mkdir(parents=True,exist_ok=True); EXPORTS.mkdir(parents=True,exist_ok=True)
    payload={'exported_at':datetime.now().isoformat(),'files':{}}
    for name in FILES:
        src=DASH/name
        if src.exists():
            shutil.copy2(src,LATEST/name)
            try: payload['files'][name]=json.loads(src.read_text())
            except Exception: payload['files'][name]={'copied':True}
    raw=EXPORTS/f"yafs_drl_7f_final_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    raw.write_text(json.dumps(payload,indent=2)); (LATEST/'latest.json').write_text(json.dumps(payload,indent=2))
    print('[OK] Exported raw snapshot:',raw); print('[OK] Updated latest:',LATEST/'latest.json')
def main(interval=120):
    while True:
        export_once(); print(f'[WAIT] Next export in {interval} seconds...'); time.sleep(interval)
if __name__=='__main__': main()
