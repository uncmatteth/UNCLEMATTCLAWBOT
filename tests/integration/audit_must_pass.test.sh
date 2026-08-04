#!/usr/bin/env bash
set -euo pipefail
if ! command -v openclaw >/dev/null 2>&1; then
  echo "openclaw CLI not found on PATH"
  exit 1
fi

AUDIT_ARGS=(--json)
if [[ "${OPENCLAW_AUDIT_DEEP:-0}" == "1" ]]; then
  AUDIT_ARGS+=(--deep)
fi

AUDIT_JSON="$(openclaw security audit "${AUDIT_ARGS[@]}")"

if AUDIT_JSON="$AUDIT_JSON" node -e '
    const audit = JSON.parse(process.env.AUDIT_JSON || "{}");
    const critical = Number(audit?.summary?.critical ?? 0);
    const warn = Number(audit?.summary?.warn ?? 0);
    const info = Number(audit?.summary?.info ?? 0);
    console.log(`openclaw-security-audit critical=${critical} warn=${warn} info=${info}`);
    if (critical > 0) process.exit(1);
  '; then
  exit 0
fi

if [[ "${OPENCLAW_AUDIT_FIX:-0}" == "1" ]]; then
  openclaw security audit --fix
  AUDIT_JSON="$(openclaw security audit "${AUDIT_ARGS[@]}")"
  AUDIT_JSON="$AUDIT_JSON" node -e '
    const audit = JSON.parse(process.env.AUDIT_JSON || "{}");
    if (Number(audit?.summary?.critical ?? 0) > 0) process.exit(1);
  '
  exit $?
fi

echo "openclaw security audit reported critical issues"
exit 1
