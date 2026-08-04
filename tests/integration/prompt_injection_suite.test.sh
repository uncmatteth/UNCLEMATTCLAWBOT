#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SUITE="$ROOT/tests/prompt_injection_suite.md"

SUITE="$SUITE" node - <<'NODE'
const fs = require("node:fs");

const suite = fs.readFileSync(process.env.SUITE, "utf8");
const rows = [...suite.matchAll(/^\| (PI-\d{3}) \| ([^|]+) \| ([^|]+) \|$/gm)];
const ids = rows.map((row) => row[1]);
const expected = new Set(["AGENT_REFUSE", "TOOL_DENY", "SANDBOX_DENY", "BROKER_DENY", "SAFE_READ_ONLY"]);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
const missingOutcome = rows.filter((row) => ![...expected].some((label) => row[3].includes(`\`${label}\``)));

if (rows.length < 50) throw new Error(`prompt injection suite requires at least 50 cases; found ${rows.length}`);
if (duplicateIds.length) throw new Error(`duplicate prompt injection IDs: ${[...new Set(duplicateIds)].join(", ")}`);
if (missingOutcome.length) throw new Error(`cases missing an expected outcome: ${missingOutcome.map((row) => row[1]).join(", ")}`);
if (!suite.includes("A written case is not runtime proof by itself.")) throw new Error("suite must preserve the runtime-proof boundary");

console.log(`prompt-injection-suite-ok cases=${rows.length} unique=${new Set(ids).size}`);
NODE
