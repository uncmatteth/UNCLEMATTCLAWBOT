#!/usr/bin/env bash
set -euo pipefail
if ! command -v openclaw >/dev/null 2>&1; then
  echo "openclaw CLI not found on PATH"
  exit 1
fi

DEFAULT_NET="$(openclaw config get agents.defaults.sandbox.docker.network --json 2>/dev/null || true)"
LIST_RAW="$(openclaw config get agents.list --json 2>/dev/null || true)"

DEFAULT_NET="${DEFAULT_NET:-null}" LIST_RAW="${LIST_RAW:-null}" node -e '
  const defaultRaw = process.env.DEFAULT_NET ?? "null";
  const listRaw = process.env.LIST_RAW ?? "null";
  function parseJson(raw) {
    try { return JSON.parse(raw); } catch { return null; }
  }
  const defaultNet = parseJson(defaultRaw);
  if (typeof defaultNet !== "string") {
    console.error("agents.defaults.sandbox.docker.network is missing");
    process.exit(1);
  }
  if (defaultNet !== "none") {
    console.error(`agents.defaults.sandbox.docker.network must be \"none\", got: ${defaultNet}`);
    process.exit(1);
  }
  const agents = parseJson(listRaw);
  if (Array.isArray(agents)) {
    const bad = [];
    for (const a of agents) {
      const net = a && a.sandbox && a.sandbox.docker && a.sandbox.docker.network;
      if (net && net !== "none") bad.push(net);
    }
    if (bad.length) {
      console.error(`agent sandbox egress enabled (docker.network): ${bad.join(", ")}`);
      process.exit(1);
    }
  }
'
