# Install (Operator Guide)

This repo includes an installer. This document remains the operator checklist and manual guide.

## Prereqs
- OpenClaw installed (follow upstream docs)
- Docker installed and running
- OpenSSL available

## Installer overrides (optional)
The installer accepts environment variables for common overrides:
- `OPENCLAW_EXT_DIR` (default `~/.openclaw/extensions`)
- `UNCLEMATT_CERT_DIR` (default `~/.secure-openclaw/certs`)
- `UNCLEMATT_BROKER_URL` (default `https://127.0.0.1:8443`)
- `UNCLEMATT_BROKER_TIMEOUT_MS` (default `15000`)
- `UNCLEMATT_VOICE_PACK_ENABLED` (`true` or `false`)
- `UNCLEMATT_SANDBOX_MODE` (default `all`)
- `UNCLEMATT_SKIP_VALIDATION` (`1` to skip validation)
- `UNCLEMATT_SECRETS_FROM_ENV` (`1` to read secret values from env vars)
- `OPENCLAW_AUDIT_FIX` (`1` to auto-run `openclaw security audit --fix` on failure)

## High-level install steps (manual)
1) Generate certs:
   - local CA
   - broker server cert (SAN: localhost + 127.0.0.1)
   - OpenClaw client cert
2) Create Docker secrets for any external API keys (required).
   - Option A (recommended): Docker Swarm secrets
     - `docker secret create OPENAI_API_KEY ./secrets/openai.key`
     - `docker secret create ANTHROPIC_API_KEY ./secrets/anthropic.key`
   - Option B (non-Swarm): bind-mount a local secrets directory
     - Put files at `./broker/secrets/OPENAI_API_KEY`, etc.
     - Update your compose to mount: `./broker/secrets:/run/secrets:ro`
     - Keep `BROKER_SECRET_DIR=/run/secrets`
     - Note: this is plaintext on disk; secure the folder permissions.
3) Start the Broker (Docker).
   - Ensure `broker/config/log-redact.patterns.json` is mounted; broker fails startup if missing.
   - Validate the actions config (installer does this automatically).
4) Copy the Uncle Matt extension into an OpenClaw extension path.
5) Patch OpenClaw config to:
   - enable the plugin
   - restrict tools
   - keep sandbox docker network = none
6) Verify:
   - Broker mTLS works
   - OpenClaw security audit passes
   - sandbox has no egress

## If OpenClaw is not installed yet
You can still prepare the Broker side:
- Generate certs: `scripts/generate-certs.sh --out /path/to/certs`
- Build the Broker image: `scripts/build-broker-image.sh`
- Start Broker manually (or via docker-compose once available)

When OpenClaw is installed, return to the config/verification steps above.

## References
- `docs/06_INSTALLER_SPEC.md` (installer responsibilities)
- `docs/09_OPENCLAW_COMPAT.md` (verified config keys)
- `docs/10_IMPLEMENTATION_PLAN.md` (ordered steps)
