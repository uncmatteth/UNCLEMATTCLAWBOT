# Technical Roadmap (No-Guess Plan)

This roadmap is organized so Cursor can follow it without inventing behavior.

## Phase 0 — Runtime discovery (avoid guessing)
**Goal:** generate facts from the user’s environment so configuration and allowlists are accurate.

Tasks:
0.1 Add installer “--dry-run” mode that collects:
- OpenClaw version
- tool list (actual tool names)
- effective sandbox settings
- output of `openclaw security audit --deep`

0.2 Write artifacts to:
`/_artifacts/runtime-snapshots/<timestamp>/...`

Acceptance:
- dry-run creates snapshots without changing system.

---

## Phase 1 — Broker MVP (mTLS + action router)
1.1 Build Broker as a minimal HTTPS server requiring client certs (mTLS).
1.2 Define an actions config format (validated via JSON schema).
1.3 Implement:
- `GET /healthz`
- `GET /v1/actions`
- `POST /v1/action/:id`

1.4 Enforce:
- deny caller Authorization headers
- actionId must exist
- upstream host is fixed in config (caller cannot send URL)
- deny redirects (`maxRedirections: 0`)
- request size cap + allowed content types
- response size cap
- logging redaction

1.5 Docker secrets:
- broker reads secrets from `/run/secrets/<name>`
- no secrets are written to disk by installer

Acceptance:
- requests without valid client cert fail
- only allowlisted actions succeed

---

## Phase 2 — OpenClaw plugin: “Uncle Matt”
2.1 Create OpenClaw extension:
- id: `uncle-matt`
- tool: `uncle_matt_action` (optional)

2.2 Tool behavior:
- takes only `{ actionId, json }`
- posts to broker `/v1/action/:id` over mTLS
- output size capped

2.3 Skill docs:
- Provide `SKILL.md`
- Installer generates `ACTIONS.generated.md` from broker.

Acceptance:
- tool is not available unless allowlisted by tool policy
- tool cannot accept URL/headers even if prompted

---

## Phase 3 — OpenClaw safe config templates (NO secrets)
3.1 Provide safe config templates:
- sandbox mode “all”
- docker network “none”
- workspaceAccess “none”
- deny dangerous tool groups by default

3.2 Installer applies patches safely:
- backup first
- avoid overwriting entire user config
- verify with audit + runtime snapshots

Acceptance:
- sandbox has no egress
- audit passes after install

---

## Phase 4 — One-command installer
4.1 Windows-first:
- `installer/setup.ps1`

4.2 macOS/Linux:
- `installer/setup.sh`

Installer steps:
- prerequisites
- generate certs (CA, broker server, openclaw client)
- create docker secrets
- write broker action policy file
- start compose
- install extension
- patch openclaw config
- run validations

Acceptance:
- new user can run one script and end “safe and working.”

---

## Phase 5 — Tests + “attacker simulation”
5.1 prompt injection suite (>= 50 prompts)
5.2 integration tests:
- sandbox no egress
- broker allowlist
- no secret patterns in logs
- audit must pass

Acceptance:
- CI green; tests fail if invariants break.

---

## Phase 6 — Docs + release packaging
- Security model
- Threat model
- Operator guide
- Release checklist

Acceptance:
- third party can run safely with docs only.
