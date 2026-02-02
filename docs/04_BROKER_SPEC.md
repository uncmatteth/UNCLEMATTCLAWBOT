# Broker Spec (Secrets Proxy)

## Purpose
The Broker is the only component that may hold third-party API keys. It performs outbound API calls
on behalf of OpenClaw under strict controls.

## Security controls (must implement)
- mTLS required (client cert signed by local CA)
- bind loopback by default
- action-based API only (no arbitrary URL)
- block private/localhost/metadata IPs even if action config is wrong
- deny redirects
- deny caller-supplied Authorization headers
- strict allowlists: host, path, method, content-type
- request/response size caps
- rate limits + budgets
- logging redaction
- fail startup if required secrets or redaction patterns are missing

## HTTP interface
- `GET /healthz` -> `{ ok: true }`
- `GET /v1/actions` -> `{ actions: [ "id1", "id2" ] }`
- `POST /v1/action/:id` -> executes the action

## Actions config (validated by JSON schema)
Each action includes:
- id
- upstream host
- method
- allowlisted path(s)
- request constraints (body size, content-types)
- auth injection (secretRef from docker secrets)
- rate/budget limits
- response caps

## Secrets
- Use Docker secrets in v0.1:
  - `/run/secrets/<name>`
- Broker should refuse to start if any `auth.secretRef` file is missing/empty.
- NEVER log secrets.
- NEVER echo secrets to caller.

## Recommended hardening
- run as non-root
- read-only container filesystem
- tmpfs /tmp
- minimal base image
