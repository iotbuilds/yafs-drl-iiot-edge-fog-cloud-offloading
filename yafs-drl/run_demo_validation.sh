#!/usr/bin/env bash
set -euo pipefail
# Set RUN_CORE=0 to skip simulation and regenerate validation only from existing results.
if [[ "${RUN_CORE:-1}" == "1" ]]; then
  python main.py
fi
python -m analysis.validate_requirements
python -m analysis.validate_proposal_metrics
python topology/visualize_topology.py
printf '\n[OK] Confirmed requirements validation completed.\n'
printf 'Open API with: bash run_api.sh then http://localhost:8000/docs\n'
