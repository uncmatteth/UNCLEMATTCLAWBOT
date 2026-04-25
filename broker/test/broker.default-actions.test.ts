import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const brokerRoot = path.resolve(__dirname, "..", "..");
const actionsPath = path.resolve(brokerRoot, "config/actions.default.json");

const EXPECTED_ACTIONS = [
  "tommy_public_proof_read",
  "tommy_site_health_read",
  "tommy_stop_epoch_read",
  "tommy_stop_status_read",
];

function loadDefaultActions() {
  return JSON.parse(fs.readFileSync(actionsPath, "utf8"));
}

test("default broker action list exposes Tommy read-only actions and no demo action", () => {
  const config = loadDefaultActions();
  const actionIds = Object.keys(config.actions ?? {}).sort();

  assert.deepEqual(actionIds, EXPECTED_ACTIONS);
  assert.equal(actionIds.includes("demo_ping"), false);
});

test("default broker actions are public GET reads without secrets", () => {
  const config = loadDefaultActions();

  for (const [actionId, policy] of Object.entries(config.actions ?? {}) as [string, any][]) {
    assert.equal(policy.method, "GET", `${actionId} must stay read-only`);
    assert.equal(policy.auth?.kind, "none", `${actionId} must not require or inject secrets`);
    assert.equal(policy.upstream?.host, "hamburgersite.vercel.app");
    assert.deepEqual(policy.pathAllowlist, [policy.upstream.path]);
    assert.match(policy.upstream.path, /^\/(api|arcade|stoptommyfromdatingyourmom)\//);
  }
});
