#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
python scripts/prepare_cloud_exports.py
uvicorn src.dashboard_api.main:app --reload --host 0.0.0.0 --port 8000
