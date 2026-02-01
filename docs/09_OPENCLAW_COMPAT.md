# OpenClaw Compatibility + Feasibility (No Code)

This document captures the verified OpenClaw config keys and behaviors that the Uncle Matt scaffold must align with, plus the minimal broker+plugin spec and an MVP punch list. All OpenClaw-specific claims must be checked against official OpenClaw docs or CLI output.

## Deliverable 1 - Feasibility Checklist (scaffold ↔ exact OpenClaw keys)

- Discovery order + explicit path-globs + first-match wins:
  plugins.load.paths → <workspace>/.openclaw/extensions/*.ts and <workspace>/.openclaw/extensions/*/index.ts → ~/.openclaw/extensions/*.ts and ~/.openclaw/extensions/*/index.ts → bundled <openclaw>/extensions/* (lowest precedence). If multiple plugins resolve to the same id, the first match wins and lower-precedence copies are ignored.
- Plugin enablement rules: bundled plugins are disabled by default and must be explicitly enabled; installed plugins are enabled by default but can be disabled; Memory (Core) is bundled and enabled via plugins.slots.memory.
- Manifest requirement + schema: every plugin must ship openclaw.plugin.json in the plugin root (file path -> directory root). The manifest must include an inline JSON Schema (configSchema), even if empty; missing/invalid manifests or schemas prevent plugin loading and fail config validation.
- .ts entrypoints + validation behavior: plugins are TypeScript modules loaded via jiti; config validation uses the manifest + JSON Schema and does not execute plugin code.
- Config location + strict validation: plugin config lives under plugins.entries.<id>.config; unknown plugin ids in plugins.entries, plugins.allow, plugins.deny, or plugins.slots.* are errors.
- Tool policy basics: tools.allow / tools.deny are supported and deny wins; tool groups are available via group:*.
- Allowlist opt-in nuance: allowlists that only name plugin tools are treated as plugin opt-ins; core tools remain enabled unless you also include core tools/groups (or use a restrictive profile).
- Allowlist warning nuance: if tools.allow only references unknown/unloaded plugin tool names, OpenClaw warns and ignores the allowlist, leaving core tools enabled.
- Sandbox keys + default egress: sandboxing is configured under agents.defaults.sandbox (or agents.list[].sandbox), and sandbox containers default to docker.network = "none" unless overridden.
- Security audit commands + checks: openclaw security audit, --deep, --fix; it flags Gateway auth exposure, browser control exposure, elevated allowlists, and filesystem permissions, and --fix tightens group policy, restores logging.redactSensitive="tools", and fixes local file permissions.
- Official plugin list (deduped) + Teams note: Memory (Core), Memory (LanceDB), Voice Call, Zalo Personal, Matrix, Nostr, Zalo, Microsoft Teams, Google Antigravity OAuth, Gemini CLI OAuth, Qwen OAuth, Copilot Proxy. Microsoft Teams is plugin-only as of 2026-01-15.

## Deliverable 2 - Minimal Working Broker + Plugin Spec (no code)

- Broker endpoints (design spec):
  - GET /healthz
  - GET /v1/actions
  - POST /v1/action/:id (action id only; caller never supplies arbitrary URL/headers)
- mTLS flow (design spec):
  - Local CA
  - Broker server cert (SAN localhost + 127.0.0.1)
  - OpenClaw client cert
  - Broker requires client cert; plugin presents client cert + key

OpenClaw config snippet (exact keys; JSON5), updated to avoid core-tool leakage:

{
  plugins: {
    enabled: true,
    allow: ["uncle-matt"],
    load: { paths: ["/ABS/PATH/UNCLEMATTCLAWBOT/openclaw/extensions/uncle-matt"] },
    entries: {
      "uncle-matt": {
        enabled: true,
        config: {
          baseUrl: "https://127.0.0.1:8443",
          caPath: "~/.secure-openclaw/certs/ca.crt",
          clientCertPath: "~/.secure-openclaw/certs/openclaw-client.crt",
          clientKeyPath: "~/.secure-openclaw/certs/openclaw-client.key",
          timeoutMs: 15000
        }
      }
    }
  },
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main",
        workspaceAccess: "none",
        docker: { network: "none", readOnlyRoot: true }
      }
    }
  },
  tools: {
    profile: "minimal",
    allow: ["uncle_matt_action"],
    deny: ["group:runtime", "group:fs", "group:ui"]
  }
}

Notes (must honor):
- Allowlists that only name plugin tools are plugin opt-ins; core tools remain enabled unless you also include core tools/groups or set a restrictive tools.profile (like "minimal").
- If tools.allow only references unknown/unloaded plugin tool names, the allowlist is ignored and core tools remain enabled.
- Bundled plugins are disabled by default; installed plugins are enabled by default; Memory (Core) is bundled but enabled via plugins.slots.memory.

## Deliverable 3 - MVP Punch List (code changes required)

- Installer: enforce the exact discovery order and manifest presence before writing plugin config; missing/invalid manifests or schemas prevent plugin loading and fail config validation.
- Installer: account for enablement defaults - bundled plugins disabled by default, installed plugins enabled by default, Memory (Core) enabled via plugins.slots.memory.
- Installer/tool policy ordering: do not set tools.allow to plugin tool names until the plugin is loaded; unknown/unloaded plugin tools cause the allowlist to be ignored and core tools remain enabled.
- Tool policy safety: if you intend to restrict core tools, set tools.profile (e.g., "minimal") and/or explicitly allowlist core tools/groups; plugin-only allowlists do not restrict core tools.
- Sandbox defaults: write agents.defaults.sandbox and keep docker.network = "none" unless egress is explicitly required.
- Validation step: run openclaw security audit (and optionally --fix) to catch the documented footguns and apply the standard guardrails.
- Repo-local MVP work (non-OpenClaw-specific): implement broker timeouts/stream caps/limits, wire redaction, add rate/budget enforcement, and replace placeholder tests with real mTLS, allowlist, sandbox-egress, and audit checks.
