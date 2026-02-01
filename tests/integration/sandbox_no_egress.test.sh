#!/usr/bin/env bash
set -euo pipefail
if ! command -v openclaw >/dev/null 2>&1; then
  echo "openclaw CLI not found on PATH"
  exit 1
fi

openclaw sandbox explain --json | node -e '
  const fs = require("fs");
  const input = fs.readFileSync(0, "utf8").trim();
  if (!input) {
    console.error("no JSON output from openclaw sandbox explain --json");
    process.exit(1);
  }
  let data;
  try {
    data = JSON.parse(input);
  } catch (err) {
    console.error("failed to parse sandbox explain output as JSON");
    process.exit(1);
  }
  const networks = [];
  function walk(node) {
    if (!node || typeof node !== "object") return;
    if (node.docker && typeof node.docker === "object" && Object.prototype.hasOwnProperty.call(node.docker, "network")) {
      networks.push(node.docker.network);
    }
    for (const v of Object.values(node)) walk(v);
  }
  walk(data);
  if (networks.length === 0) {
    console.error("no docker.network fields found in sandbox explain output");
    process.exit(1);
  }
  const bad = networks.filter((n) => n !== "none");
  if (bad.length) {
    console.error(`sandbox egress enabled (docker.network): ${bad.join(", ")}`);
    process.exit(1);
  }
  process.exit(0);
'
