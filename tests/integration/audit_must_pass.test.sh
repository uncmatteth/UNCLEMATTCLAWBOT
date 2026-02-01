#!/usr/bin/env bash
set -euo pipefail
if ! command -v openclaw >/dev/null 2>&1; then
  echo "openclaw CLI not found on PATH"
  exit 1
fi

if openclaw security audit --deep; then
  exit 0
fi

if [[ "${OPENCLAW_AUDIT_FIX:-0}" == "1" ]]; then
  openclaw security audit --fix
  openclaw security audit --deep
  exit 0
fi

echo "openclaw security audit --deep reported issues"
exit 1
