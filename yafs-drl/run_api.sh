#!/usr/bin/env bash
set -euo pipefail
PORT="${YAFS_API_PORT:-8002}"
uvicorn src.dashboard_api.main:app --host 0.0.0.0 --port "$PORT" --reload
