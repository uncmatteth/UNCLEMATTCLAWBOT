# Implementation Plan (No Code)

This plan is ordered by dependencies. OpenClaw-specific steps must be verified against official docs or CLI output before coding.

## 1) Plugin discovery + manifest validation
- Confirm discovery order and first-match precedence:
  plugins.load.paths -> <workspace>/.openclaw/extensions/*.ts and <workspace>/.openclaw/extensions/*/index.ts -> ~/.openclaw/extensions/*.ts and ~/.openclaw/extensions/*/index.ts -> bundled <openclaw>/extensions/* (lowest precedence). First match wins; lower precedence ignored.
- Verify openclaw.plugin.json exists in each plugin root and includes configSchema (even empty).
- Ensure unknown plugin ids in plugins.entries, plugins.allow, plugins.deny, or plugins.slots.* are treated as errors.
- Apply enablement defaults: bundled plugins disabled by default, installed plugins enabled by default; Memory (Core) enabled via plugins.slots.memory.

## 2) Config patching + tool policy (depends on step 1)
- Write plugins.entries.<id>.config, plugins.allow/deny, and plugins.load.paths only after discovery/manifest validation passes.
- Set `tools.profile: "full"`, restrict `tools.allow` to
  `uncle_matt_action`, and retain explicit runtime/filesystem/UI/browser denies.
  OpenClaw filters optional plugin tools out of `minimal` before applying the
  allowlist.
- Remember allowlists that only name plugin tools are opt-ins (core tools remain enabled unless explicitly allowlisted/denied or constrained by tools.profile).
- Avoid allowlists that reference only unknown or unloaded plugin tool names; OpenClaw warns and ignores the allowlist so core tools remain available.

## 3) Sandbox defaults (depends on step 2)
- Apply agents.defaults.sandbox (or per-agent overrides).
- Keep docker.network = "none" unless egress is explicitly required.
- Add only `uncle_matt_action` to `tools.sandbox.tools.alsoAllow`; sandbox tool
  policy is a second intersection and otherwise removes the plugin tool.

## 4) Audit validation (depends on steps 2-3)
- Run openclaw security audit, --deep, and --fix.
- Ensure findings are clean and guardrails applied by --fix.

## 5) Broker hardening (after OpenClaw config is stable)
- Implement timeouts, response caps, redaction wiring, rate/budget enforcement, and strict allowlists/mTLS per the broker spec.

## 6) Tests (final gate)
- Add/enable tests for tool policy behavior (deny wins, allowlist semantics).
- Add sandbox defaults/egress tests.
- Add security-audit pass/fail tests.
- Add broker mTLS/allowlist/size-cap tests.
