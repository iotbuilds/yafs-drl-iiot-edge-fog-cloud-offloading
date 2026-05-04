#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
python scripts/prepare_cloud_exports.py
