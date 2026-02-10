#!/usr/bin/env bash
set -euo pipefail
if ! command -v openclaw >/dev/null 2>&1; then
  echo "openclaw CLI not found on PATH"
  exit 1
fi

ALLOW_RAW="$(openclaw config get tools.allow --json 2>/dev/null || true)"
DENY_RAW="$(openclaw config get tools.deny --json 2>/dev/null || true)"
PROFILE_RAW="$(openclaw config get tools.profile --json 2>/dev/null || true)"

ALLOW_RAW="${ALLOW_RAW:-null}" DENY_RAW="${DENY_RAW:-null}" PROFILE_RAW="${PROFILE_RAW:-\"\"}" node -e '
  const allowRaw = process.env.ALLOW_RAW ?? "null";
  const denyRaw = process.env.DENY_RAW ?? "null";
  const profileRaw = process.env.PROFILE_RAW ?? "\"\"";
  const required = (process.env.REQUIRED_DENY ?? "group:runtime,group:fs,group:ui,group:browser").split(",").filter(Boolean);

  function parseArray(raw) {
    try {
      const val = JSON.parse(raw);
      return Array.isArray(val) ? val : [];
    } catch {
      return [];
    }
  }

  function parseString(raw) {
    try {
      const val = JSON.parse(raw);
      return typeof val === "string" ? val : "";
    } catch {
      return String(raw ?? "");
    }
  }

  const allow = parseArray(allowRaw);
  const deny = parseArray(denyRaw);
  const profile = parseString(profileRaw);

  if (deny.length === 0) {
    console.error("tools.deny is empty; dangerous tools are not explicitly blocked");
    process.exit(1);
  }

  const missing = required.filter((r) => !deny.includes(r));
  if (missing.length) {
    console.error(`tools.deny missing required entries: ${missing.join(", ")}`);
    process.exit(1);
  }

  const overlap = allow.filter((a) => deny.includes(a));
  if (overlap.length) {
    console.error(`tools.allow overlaps tools.deny (deny should win): ${overlap.join(", ")}`);
    process.exit(1);
  }

  if (process.env.REQUIRE_PROFILE === "1" && profile !== "minimal") {
    console.error(`tools.profile must be \\"minimal\\", got: ${profile || "(empty)"}`);
    process.exit(1);
  }
'
