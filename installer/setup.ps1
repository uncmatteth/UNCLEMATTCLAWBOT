\
# Uncle Matt installer (Windows PowerShell) — skeleton
# - Generates certs
# - Creates docker secrets (prompts)
# - Starts broker
# - Installs OpenClaw extension + writes ACTIONS.generated.md
# - Applies safe OpenClaw config patch (NO secrets)
#
# NOTE: This script is intentionally explicit. Avoid clever abstractions.

param(
  [switch]$DryRun
)

Write-Host "Uncle Matt setup starting..."

# TODO: implement:
# 1) Assert Docker running
# 2) Assert OpenClaw installed
# 3) Generate certs (openssl)
# 4) Create docker secrets (prompt)
# 5) docker compose up -d
# 6) Copy /openclaw/extensions/uncle-matt into OpenClaw extensions dir
# 7) Generate ACTIONS.generated.md by calling broker /v1/actions over mTLS
# 8) Run validations and fail if unsafe

Write-Host "Done."
