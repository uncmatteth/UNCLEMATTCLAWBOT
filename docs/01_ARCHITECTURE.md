# Architecture

## Hard security invariants (do not break)
- **INV‑0:** OpenClaw must NOT contain third‑party API keys in config/env/workspace/logs/transcripts.
- **INV‑1:** OpenClaw sandbox has **no outbound internet** by default.
- **INV‑2:** Broker must not accept arbitrary URLs/headers/redirects/callbacks. Actions only.
- **INV‑3:** Authentication everywhere:
  - OpenClaw gateway stays loopback by default; remote use via SSH tunnel by default.
  - Broker requires **mTLS client cert** and binds loopback by default.
- **INV‑4:** Dangerous tools are opt‑in and hard-stopped by tool policy (deny wins).
- **INV‑5:** Tests prove the invariants.

## Components
A) **OpenClaw** (installed separately)
- Runs agent(s)
- Loads extension/plugin: **Uncle Matt**
- Uses local model by default (recommended for “no LLM keys” setups), e.g., Ollama.

B) **Broker** (this repo)
- Holds third‑party secrets (Docker secrets by default)
- Exposes action endpoints:
  - `GET /v1/actions` (ids only)
  - `POST /v1/action/:id`
- Enforces:
  - mTLS client cert required
  - strict action allowlists (host/path/method/content-type)
  - no redirects
  - no caller-supplied auth headers
  - response size caps
  - rate limits + budgets

C) **Uncle Matt plugin** (OpenClaw extension)
- Registers an OPTIONAL tool `uncle_matt_action(actionId, json)`
- Connects to Broker over mTLS
- Does not allow URL/host/header parameters

D) **Installer**
- Generates CA/server/client certs
- Creates docker secrets (prompts user)
- Starts broker with loopback-only port binding
- Installs the plugin into OpenClaw extension path
- Applies safe OpenClaw config patch (no secrets)
- Runs validation checks and fails if unsafe

E) **Tests**
- “No egress from sandbox”
- “Broker rejects arbitrary URL attempts”
- “No secrets in logs/transcripts”
- “Security audit passes / config safe”

## Data flow
User -> chat -> OpenClaw agent -> tool call `uncle_matt_action` -> Broker -> external API -> Broker -> OpenClaw -> user

## Optional “reader/doer” pattern
For prompt-injection resistance, split the work:
- Reader agent: reads untrusted content but has no dangerous tools.
- Doer agent: executes limited actions but only sees sanitized summaries.
