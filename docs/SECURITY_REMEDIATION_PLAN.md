# Security Remediation Plan (2026-02-02)

This document enumerates every issue and unknown from the audit and provides an actionable plan to address each item, including verification steps. It is intended to be tracked until all items are closed.

## Scope
- Repo: UNCLEMATTCLAWBOT
- Audit date: 2026-02-02
- Goal: Align implementation with stated security claims and make the project safe to ship.

## Status Legend
- TODO: not started
- IN-PROGRESS: work underway
- DONE: verified with evidence
- BLOCKED: waiting on dependency

## Workstreams
1) Installer + OpenClaw integration
2) Broker hardening
3) Secrets + key handling
4) Docs + release hygiene
5) Tests + CI
6) Verification (operator-run)

## Detailed Plan (All Findings + Unknowns)

### F-HIGH-01 Installer is TODO (unsafe to rely on)
- Evidence: `installer/setup.sh:8`; `installer/setup.ps1:17`; `README.md:44`
- Risk: Operators run “installer” but nothing is configured; OpenClaw remains permissive.
- Owner: TODO
- Status: TODO
- Actions:
  - Implement the installer per `docs/06_INSTALLER_SPEC.md`.
  - Or fail-fast with explicit error until implemented.
  - Ensure it:
    - Verifies Docker and OpenClaw presence.
    - Generates certs.
    - Creates Docker secrets or instructs on local secrets dir.
    - Starts broker with loopback bind.
    - Installs the plugin into the correct OpenClaw extension path.
    - Patches OpenClaw config to safe defaults.
    - Generates ACTIONS.generated.md via mTLS.
    - Runs validation tests.
- Verification:
  - `tests/integration/openclaw_tool_policy.test.sh`
  - `tests/integration/sandbox_no_egress.test.sh`
  - `tests/integration/audit_must_pass.test.sh`

### F-HIGH-02 OpenClaw plugin is a skeleton
- Evidence: `openclaw/extensions/uncle-matt/index.ts:1-2`
- Risk: Tool never registers; OpenClaw remains with default tools/egress.
- Owner: TODO
- Status: TODO
- Actions:
  - Implement plugin using official OpenClaw SDK.
  - Build and ship compiled artifacts (JS) or ensure OpenClaw loads TS with runtime support.
  - Update installer to install the built plugin in the correct directory.
- Verification:
  - `openclaw tools list` shows `uncle_matt_action`.
  - Test call reaches broker via mTLS and returns expected response.

### F-MED-01 Redaction path mismatch in action handler
- Evidence: `broker/src/actions/index.ts:32`; `broker/src/server.ts:44-46`
- Risk: Custom `BROKER_REDACT_PATTERNS_PATH` is ignored for response redaction.
- Owner: TODO
- Status: TODO
- Actions:
  - Load redact patterns using `BROKER_REDACT_PATTERNS_PATH` inside action handler.
- Verification:
  - Set custom patterns path and confirm redaction occurs on action responses.

### F-MED-02 Startup does not validate private/localhost upstreams
- Evidence: `README.md:5-9`; `broker/src/server.ts:41-47`; `broker/src/actions/index.ts:100-105`
- Risk: Misconfigured action targets are not caught at startup.
- Owner: TODO
- Status: TODO
- Actions:
  - Add startup validation: when `BROKER_ALLOW_PRIVATE_IPS=0`, resolve each action host and fail fast if private/localhost/metadata IPs are found.
- Verification:
  - Create an action with `host: "127.0.0.1"` and confirm broker fails to start.

### F-MED-03 No concurrency caps (only rate/budget windows)
- Evidence: `broker/src/actions/index.ts:36-55`
- Risk: Burst of parallel requests can exhaust broker/upstream resources.
- Owner: TODO
- Status: TODO
- Actions:
  - Add in-flight concurrency limits (global + per-action).
  - Extend `actions.schema.json` to include limits (e.g., `maxInFlight`).
  - Add request queue or immediate 429 on saturation.
- Verification:
  - Add a test that fires N parallel requests and asserts the cap triggers.

### F-MED-04 Cert generation does not enforce key file permissions
- Evidence: `scripts/generate-certs.sh:47-61`
- Risk: Keys could be world-readable on permissive umask.
- Owner: TODO
- Status: TODO
- Actions:
  - Set `umask 077` before key generation and `chmod 600` on key files.
- Verification:
  - Run script and check key file permissions are `600`.

### F-LOW-01 Safe OpenClaw config template lacks explicit allow/profile
- Evidence: `openclaw/config/openclaw.safe.jsonc:22-28`
- Risk: Operators copy template and still have unsafe tools enabled by default.
- Owner: TODO
- Status: RESOLVED 2026-08-04
- Actions:
  - Use `tools.profile: "full"` because OpenClaw filters optional plugin tools
    out of `minimal` before applying the explicit allowlist.
  - Keep the explicit allowlist restricted to `uncle_matt_action`, retain the
    runtime/filesystem/UI/browser deny groups, and add only
    `uncle_matt_action` to `tools.sandbox.tools.alsoAllow`.
- Verification:
  - `tests/integration/openclaw_tool_policy.test.sh`

### F-LOW-02 Test fixtures include private keys
- Evidence: `broker/test/fixtures/client.key:1`; `broker/test/fixtures/server.key:1`
- Risk: Operators might use fixtures in production.
- Owner: TODO
- Status: TODO
- Actions:
  - Add explicit warnings in docs and installer checks to reject fixture paths.
  - Optionally generate fixtures at test-time instead of committing keys.
- Verification:
  - Documentation update; installer refuses fixture paths.

### F-LOW-03 Missing SECURITY.md and CI
- Evidence: `rg --files -g 'SECURITY.md'` -> none; `rg --files -g '.github/workflows/*'` -> none
- Risk: No vulnerability disclosure path; tests not enforced automatically.
- Owner: TODO
- Status: TODO
- Actions:
  - Add `SECURITY.md` (reporting instructions, supported versions).
  - Add CI workflow to run broker tests; conditionally run integration tests if `openclaw` is on PATH.
- Verification:
  - CI pipeline visible and passing.

### UNKNOWN-01 OpenClaw CLI not on PATH during audit
- Evidence: `command -v openclaw` -> not found
- Risk: Integration tests not run; safety guarantees unverified.
- Owner: Operator
- Status: BLOCKED
- Actions:
  - Install OpenClaw or expose CLI in PATH.
  - Run integration tests.
- Verification:
  - `tests/integration/audit_must_pass.test.sh`
  - `tests/integration/openclaw_tool_policy.test.sh`
  - `tests/integration/sandbox_no_egress.test.sh`

### UNKNOWN-02 Sandbox egress and tool policy are only documented
- Evidence: `docs/CONFIGURATION.md:26-39`; `openclaw/config/openclaw.safe.jsonc:10-29`
- Risk: Actual OpenClaw config may allow egress or unsafe tools.
- Owner: Operator
- Status: BLOCKED
- Actions:
  - Validate with OpenClaw CLI.
- Verification:
  - `openclaw sandbox explain --json`
  - `openclaw config get tools.allow --json`
  - `openclaw config get tools.deny --json`

### UNKNOWN-03 No evidence of “OpenClaw never holds secrets” at runtime
- Evidence: The broker uses secrets, but OpenClaw runtime state not validated.
- Risk: Secrets could still be present in OpenClaw env/logs/config.
- Owner: Operator
- Status: BLOCKED
- Actions:
  - Run `openclaw security audit --deep` and remediate if required.
  - Check OpenClaw config and environment for secret leakage.
- Verification:
  - `tests/integration/audit_must_pass.test.sh`

## Sequencing (Suggested Order)
1) Implement installer and plugin (F-HIGH-01, F-HIGH-02).
2) Broker hardening and key permission fixes (F-MED-01..04).
3) Config template and fixture warnings (F-LOW-01, F-LOW-02).
4) SECURITY.md + CI (F-LOW-03).
5) Run integration verification (UNKNOWN-01..03).

## Acceptance Criteria
- Installer fully applies safe defaults or fails closed.
- OpenClaw plugin loads and `uncle_matt_action` is available.
- Broker fails startup on private/localhost upstreams by default.
- Redaction uses configured pattern path for all responses and logs.
- Concurrency caps enforced.
- Key permissions are locked to 600.
- SECURITY.md exists; CI runs broker tests.
- Integration tests pass with OpenClaw installed.

## Notes
- This plan is intentionally exhaustive; do not remove items without an explicit risk acceptance decision.
