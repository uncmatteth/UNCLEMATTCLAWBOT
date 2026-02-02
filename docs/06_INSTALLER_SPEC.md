# Installer Spec

## Goals
- “One-click-ish” setup for Windows/macOS/Linux
- No secrets written to disk by the installer
- Safe defaults enforced

## Responsibilities
1. Verify prerequisites: Docker running, OpenClaw installed.
2. Generate certs:
   - local CA
   - broker server cert (SAN: localhost + 127.0.0.1)
   - openclaw client cert (CN: openclaw-client)
3. Create Docker secrets:
   - prompt user for external API keys (required)
   - if Docker secrets are unavailable, instruct user to provide a local secrets directory (installer should not write secrets)
4. Write broker actions config:
   - start from template (no enabled actions by default)
5. Start broker with docker-compose:
   - bind `127.0.0.1:8443` only
6. Install OpenClaw extension:
   - copy `openclaw/extensions/uncle-matt` into user OpenClaw extensions directory
7. Apply safe OpenClaw config patch:
   - sandbox mode all
   - workspaceAccess none
   - docker network none
   - tool deny by default (only allow what’s safe)
8. Generate skill action list:
   - call broker `GET /v1/actions` over mTLS
   - write `ACTIONS.generated.md`
9. Validate:
   - broker mTLS works
   - sandbox has no egress
   - OpenClaw security audit passes

## Important: No guessing
- If OpenClaw tool names differ between versions, installer must query and write allowlist accordingly.
