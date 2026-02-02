# Install (Operator Guide)

This repo is still a scaffold. The installer scripts are not complete yet, so treat this as an operator checklist and manual guide.

## Prereqs
- OpenClaw installed (follow upstream docs)
- Docker installed and running
- OpenSSL available

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
