# Uncle Matt — Overview (v4.20.69)

**Goal:** A self-hosted, self-contained security wrapper for OpenClaw that reduces:
- secret leakage (env/config/logs/transcripts)
- prompt injection escalation into tool abuse
- arbitrary network exfiltration
- “open proxy” / SSRF style abuse via permissive forwarding

**Key move:** keep third-party API keys out of OpenClaw entirely by using a hardened **Broker** service
that holds the keys and exposes **action-based** endpoints over **mTLS**.

## Core idea
- OpenClaw: reasoning + orchestration, treated as compromiseable.
- Broker: minimal hardened service, holds API keys, *enforces allowlists/budgets*, does outbound calls.
- “Uncle Matt” tool: OpenClaw extension exposing only `uncle_matt_action(actionId, json)`.

## Release direction
This repo is designed to ship as a general-purpose distribution for anyone:
- works for local desktops and servers
- no hosted SaaS dependencies
- open source-first (local models encouraged; external APIs only when user opts in)

See:
- `01_ARCHITECTURE.md`
- `02_ROADMAP.md`
- `03_REPO_LAYOUT.md`
- `04_BROKER_SPEC.md`
- `05_UNCLE_MATT_PLUGIN_SKILL.md`
- `06_INSTALLER_SPEC.md`
- `07_TESTING.md`
- `08_RELEASE_CHECKLIST.md`
