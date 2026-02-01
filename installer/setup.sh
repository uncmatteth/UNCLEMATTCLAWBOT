#!/usr/bin/env bash
set -euo pipefail

DRY_RUN="${1:-}"

echo "Uncle Matt setup starting..."

# TODO: implement:
# 1) Assert Docker running
# 2) Assert OpenClaw installed
# 3) Generate certs (openssl)
# 4) Create docker secrets (prompt)
# 5) docker compose up -d
# 6) Copy /openclaw/extensions/uncle-matt into OpenClaw extensions dir
# 7) Generate ACTIONS.generated.md by calling broker /v1/actions over mTLS
# 8) Run validations and fail if unsafe

echo "Done."
