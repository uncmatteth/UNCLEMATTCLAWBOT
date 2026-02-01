# PMLOG - UncleMattClawBot

Last updated: 2026-02-01

## Mission (plain English)
Build a secure-by-default wrapper for OpenClaw that keeps third-party API keys out of OpenClaw by routing all external API calls through a hardened local Broker via mTLS. OpenClaw runs with no outbound internet by default. The Broker exposes **action-based** endpoints only; no arbitrary URLs or headers.

## Roles & Responsibilities

### PM / Lead Engineer (you)
- Own the security model, priorities, and acceptance criteria.
- Decide what gets built first and what can wait.
- Validate that OpenClaw config keys/behavior match the official docs before coding.
- Require evidence for any claim; nothing is accepted at face value.

### Implementation Agent (the other assistant)
- Executes the tasks you assign **exactly**, including: code changes, tests, installer, docs.
- Must verify OpenClaw config keys and plugin APIs against official docs before touching code.
- Must report back with citations or exact doc references for all OpenClaw-specific behavior.
- Must not "assume" defaults; if unknown, run discovery or ask.

### Secretary (user)
- Relays instructions and outputs between PM and implementation agent.
- Does not make technical decisions.

## Ground Rules
- Assume the repository is a scaffold; nothing is trusted until verified.
- All OpenClaw behaviors must be checked against official docs or CLI output.
- Security invariants are non-negotiable.
- Tests must **fail** when invariants are broken; placeholders are unacceptable.
- Separate **spec** from **implementation**: no coding until the spec is aligned with docs.
- Freeze the OpenClaw target version and record the exact CLI version used for verification.

## Verified OpenClaw Facts (from official docs)
- Plugins run **in-process** with the Gateway (trusted code).
- Plugin config is validated via `openclaw.plugin.json` `configSchema` and `plugins.entries.<id>.config`.
- Tools can be allow/deny gated via `tools.allow` / `tools.deny` (deny wins).
- Tool groups (e.g., `group:runtime`, `group:fs`, `group:web`, `group:ui`) are supported in tool policy.
- If `tools.allow` only references unknown or unloaded plugin tools, OpenClaw logs a warning and ignores the allowlist (core tools stay available).
- Allowlists that only name plugin tools are treated as plugin opt-ins; core tools remain enabled unless you also include core tools/groups in the allowlist.
- `tools.profile` sets a base allowlist (e.g., `minimal`) before `tools.allow`/`tools.deny`.
- Sandboxing runs tool execution in Docker; default `sandbox.docker.network` is **"none"** (no egress).
- Per-agent overrides exist for sandbox + tools.
- Plugin discovery order is: `plugins.load.paths` -> `<workspace>/.openclaw/extensions/*.ts` and `<workspace>/.openclaw/extensions/*/index.ts` -> `~/.openclaw/extensions/*.ts` and `~/.openclaw/extensions/*/index.ts` -> bundled extensions.
- Plugin discovery order is: `plugins.load.paths` -> `<workspace>/.openclaw/extensions/*.ts` and `<workspace>/.openclaw/extensions/*/index.ts` -> `~/.openclaw/extensions/*.ts` and `~/.openclaw/extensions/*/index.ts` -> bundled extensions.
- Plugins are TypeScript modules loaded at runtime via jiti; `.ts` entrypoints are supported.
- Every plugin must include `openclaw.plugin.json` in the plugin root; if a path points to a file, the root is that file's directory.
- Config validation is strict: unknown plugin ids in `plugins.entries`, `plugins.allow`, `plugins.deny`, or `plugins.slots` are errors.
- If multiple plugins resolve to the same id, the first match in discovery order wins; lower-precedence copies are ignored.
- Bundled plugins ship disabled by default and must be explicitly enabled; installed plugins are enabled by default (can be disabled).
- Memory (Core) is bundled but enabled by default via `plugins.slots.memory`.
- Sandbox modes include `off`, `non-main`, `all` and live under `agents.defaults.sandbox.mode`.
- Security audit commands: `openclaw security audit`, `--deep`, `--fix`. The audit flags common footguns (Gateway auth exposure, browser control exposure, elevated allowlists, filesystem permissions); `--fix` applies guardrails.

(Implementation agent should cite docs when reporting these facts.)

## Repo Status (current)
- Code is a scaffold; many critical controls and tests are placeholders.
- Installer scripts are stubs; Windows script has a stray leading `\`.
- Broker defaults bind to `0.0.0.0` (violates loopback-by-default).
- Rate limits, budgets, and log redaction are not wired.

## Known Critical Findings (must fix before release)
- Integration tests and broker tests are TODO placeholders; invariants aren't enforced.
- Prompt-injection suite is incomplete (< 50 prompts).
- Broker bind defaults unsafe; compose sets `BROKER_BIND=0.0.0.0`.
- Broker lacks rate limiting, budgets, and real log redaction.
- Upstream request safety gaps: timeout, response size enforcement uses char length, full buffering.
- Dockerfile uses `npm ci` without lockfile; start path likely wrong.

## Immediate Priorities (ordered)
1. **Map OpenClaw config keys to actual docs**; correct `openclaw.safe.jsonc` and per-agent templates.
2. **Define minimal working Broker + plugin spec** (API, mTLS, action format, install flow).
3. **Implement missing security controls** (rate limits, budgets, redaction, strict caps).
4. **Replace placeholder tests** with real enforcement.
5. **Installer**: generate certs, create secrets, patch config, run validations.

## Deliverables Required from Implementation Agent
- A doc that maps current scaffold to **official OpenClaw config keys** and plugin API (with citations).
- A minimal working broker + plugin design: endpoints, configs, cert flow, and exact config examples.
- A list of code changes needed in this repo, tied to the security invariants.
- A plan for integration tests that **actually fail** when invariants are broken.

## Open Questions
- Does OpenClaw load TypeScript extensions directly in all installs, or must plugins be built to JS?
- What is the user's OpenClaw install location (needed for installer pathing)?
- Are rate limits/budgets required for v0.1, or can they be deferred?

## Decision Log
- 2026-02-01: Use official OpenClaw docs as the source of truth for config keys and plugin APIs.
- 2026-02-01: Require explicit citations or CLI output for every OpenClaw-specific claim.

## Current Status (handoff)
- 2026-02-01: Deliverables 1-3 are locked in docs/09_OPENCLAW_COMPAT.md.
- 2026-02-01: Plan is locked in docs/10_IMPLEMENTATION_PLAN.md.
- Step 1 (plugin discovery + manifest validation) is accepted based on the plan file.
- Step 2 verification (config patching + tool policy) is next. No code changes yet.

## PM Process Risks / Blind Spots (and fixes)
- Risk: Mixing docs/spec with coding leads to building the wrong thing. Fix: require a signed-off spec doc before code changes.
- Risk: Trusting second-hand claims without checking. Fix: every OpenClaw-specific claim must cite docs or CLI output.
- Risk: Target drift (OpenClaw config keys change). Fix: pin a specific OpenClaw version and record it.
- Risk: "Security" features are listed but not enforced. Fix: write tests that fail without those controls.
- Risk: Installer scope creep. Fix: define "minimal safe installer" vs "nice-to-have".
- Risk: No clear MVP. Fix: define a smallest working set (broker mTLS + tool allowlist + no egress).
- Risk: Citing non-official sources for OpenClaw behavior. Fix: only official OpenClaw docs/CLI output for OpenClaw-specific claims.

## MVP Definition (minimum safe release)
- Broker: mTLS required, action allowlist, deny caller auth headers, no redirects, size caps, loopback bind default.
- OpenClaw: tool allowlist denies everything except uncle_matt_action, sandbox docker network none, workspaceAccess none.
- Installer: generates certs, writes config, installs plugin, validates broker + audit pass.
- Tests: broker mTLS fails without client cert, tool policy deny wins, sandbox no egress.

## Next Actions (for Implementation Agent)
- Produce the **Feasibility Checklist** mapping official OpenClaw config/tool keys to this repo (no code).
- Draft the **Minimal Working Broker + Plugin Spec** (exact API + cert flow + config).
