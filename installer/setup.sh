#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DRY_RUN=0

for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN=1
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

echo "Uncle Matt setup starting..."

run() {
  echo "+ $*"
  if [[ "$DRY_RUN" -eq 0 ]]; then
    "$@"
  fi
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

expand_path() {
  local p="$1"
  if [[ "$p" == "~" ]]; then
    echo "$HOME"
    return
  fi
  if [[ "$p" == "~/"* ]]; then
    echo "$HOME/${p:2}"
    return
  fi
  echo "$p"
}

require_cmd docker
require_cmd openssl
require_cmd curl
require_cmd openclaw

COMPOSE_CMD=""
if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  echo "Docker Compose not found (docker compose or docker-compose)." >&2
  exit 1
fi

OPENCLAW_EXT_DIR="$(expand_path "${OPENCLAW_EXT_DIR:-$HOME/.openclaw/extensions}")"
CERT_DIR="$(expand_path "${UNCLEMATT_CERT_DIR:-$HOME/.secure-openclaw/certs}")"
BROKER_URL="${UNCLEMATT_BROKER_URL:-https://127.0.0.1:8443}"
BROKER_TIMEOUT_MS="${UNCLEMATT_BROKER_TIMEOUT_MS:-15000}"
VOICE_PACK_ENABLED="${UNCLEMATT_VOICE_PACK_ENABLED:-false}"
SANDBOX_MODE="${UNCLEMATT_SANDBOX_MODE:-all}"
SKIP_VALIDATION="${UNCLEMATT_SKIP_VALIDATION:-0}"

echo "OpenClaw extension dir: $OPENCLAW_EXT_DIR"
echo "Cert dir: $CERT_DIR"
echo "Broker URL: $BROKER_URL"

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running or not accessible." >&2
  exit 1
fi

run mkdir -p "$CERT_DIR"
if [[ ! -f "$CERT_DIR/ca.crt" || ! -f "$CERT_DIR/client.crt" || ! -f "$CERT_DIR/client.key" ]]; then
  CERT_FORCE="${UNCLEMATT_FORCE_CERTS:-0}"
  if [[ "$CERT_FORCE" == "1" ]]; then
    run "$ROOT/scripts/generate-certs.sh" --out "$CERT_DIR" --force
  else
    run "$ROOT/scripts/generate-certs.sh" --out "$CERT_DIR"
  fi
fi

BROKER_CERT_DIR="$ROOT/broker/certs"
run mkdir -p "$BROKER_CERT_DIR"
run cp "$CERT_DIR/ca.crt" "$BROKER_CERT_DIR/ca.crt"
run cp "$CERT_DIR/server.crt" "$BROKER_CERT_DIR/server.crt"
run cp "$CERT_DIR/server.key" "$BROKER_CERT_DIR/server.key"
run chmod 600 "$BROKER_CERT_DIR/server.key"

PLUG_SRC="$ROOT/openclaw/extensions/uncle-matt"
PLUG_DEST="$OPENCLAW_EXT_DIR/uncle-matt"
run mkdir -p "$OPENCLAW_EXT_DIR"
run rm -rf "$PLUG_DEST"
run cp -R "$PLUG_SRC" "$PLUG_DEST"

echo "Configuring OpenClaw..."
run openclaw config set plugins.enabled true
run openclaw config set plugins.allow '["uncle-matt"]' --json
run openclaw config set plugins.load.paths "[\"$PLUG_DEST\"]" --json
run openclaw config set plugins.entries.\"uncle-matt\".enabled true
run openclaw config set plugins.entries.\"uncle-matt\".config.baseUrl "$BROKER_URL"
run openclaw config set plugins.entries.\"uncle-matt\".config.caPath "$CERT_DIR/ca.crt"
run openclaw config set plugins.entries.\"uncle-matt\".config.clientCertPath "$CERT_DIR/client.crt"
run openclaw config set plugins.entries.\"uncle-matt\".config.clientKeyPath "$CERT_DIR/client.key"
run openclaw config set plugins.entries.\"uncle-matt\".config.timeoutMs "$BROKER_TIMEOUT_MS"
run openclaw config set plugins.entries.\"uncle-matt\".config.voicePackEnabled "$VOICE_PACK_ENABLED"

run openclaw config set agents.defaults.sandbox.mode "$SANDBOX_MODE"
run openclaw config set agents.defaults.sandbox.workspaceAccess "none"
run openclaw config set agents.defaults.sandbox.docker.network "none"
run openclaw config set agents.defaults.sandbox.docker.readOnlyRoot true

run openclaw config set tools.profile "minimal"
run openclaw config set tools.allow '["uncle_matt_action"]' --json
run openclaw config set tools.deny '["group:runtime","group:fs","group:ui","group:browser"]' --json

ACTION_FILE="$ROOT/broker/config/actions.default.json"
if [[ ! -f "$ACTION_FILE" ]]; then
  TEMPLATE="$ROOT/installer/templates/broker.actions.example.json"
  echo "Actions file missing; copying template to $ACTION_FILE"
  run cp "$TEMPLATE" "$ACTION_FILE"
fi

echo "Validating actions config..."
run "$ROOT/scripts/validate-actions.sh" --actions "$ACTION_FILE" --schema "$ROOT/broker/config/actions.schema.json"

if command -v python3 >/dev/null 2>&1; then
  mapfile -t SECRET_REFS < <(python3 - "$ACTION_FILE" <<'PY'
import json,sys
path=sys.argv[1]
data=json.load(open(path))
refs=set()
for policy in (data.get("actions") or {}).values():
    auth=policy.get("auth") or {}
    if auth.get("kind") and auth.get("kind") != "none":
        ref=auth.get("secretRef")
        if isinstance(ref,str) and ref:
            refs.add(ref)
print("\n".join(sorted(refs)))
PY
)
else
  SECRET_REFS=()
  echo "python3 not found; skipping secretRef extraction. If actions require secrets, create them manually." >&2
fi

if [[ "${#SECRET_REFS[@]}" -gt 0 ]]; then
  ALLOWED_SECRETS=("OPENAI_API_KEY" "ANTHROPIC_API_KEY" "BRAVE_API_KEY")
  for ref in "${SECRET_REFS[@]}"; do
    if [[ ! " ${ALLOWED_SECRETS[*]} " =~ " ${ref} " ]]; then
      echo "Secret '$ref' not declared in docker-compose.yml. Add it to compose or mount a secrets dir." >&2
      exit 1
    fi
  done

  SWARM_STATE="$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null || true)"
  if [[ "$SWARM_STATE" != "active" ]]; then
    echo "Docker Swarm is not active; Docker secrets are unavailable." >&2
    echo "Enable Swarm (docker swarm init) or use a local secrets directory as described in docs/INSTALL.md." >&2
    exit 1
  fi

  EXISTING_SECRETS="$(docker secret ls --format '{{.Name}}' || true)"
  for ref in "${SECRET_REFS[@]}"; do
    if echo "$EXISTING_SECRETS" | grep -qx "$ref"; then
      echo "Docker secret exists: $ref"
      continue
    fi
    if [[ "${UNCLEMATT_SECRETS_FROM_ENV:-0}" == "1" ]]; then
      val="${!ref:-}"
      if [[ -z "$val" ]]; then
        echo "Missing env var for secret $ref (expected \$$ref)." >&2
        exit 1
      fi
      printf "%s" "$val" | run docker secret create "$ref" -
      unset val
    else
      echo -n "Enter value for secret $ref: "
      read -rs val
      echo
      if [[ -z "$val" ]]; then
        echo "Empty secret value for $ref; aborting." >&2
        exit 1
      fi
      printf "%s" "$val" | run docker secret create "$ref" -
      unset val
    fi
  done
fi

echo "Starting broker via Docker Compose..."
if [[ "$COMPOSE_CMD" == "docker compose" ]]; then
  run docker compose -f "$ROOT/docker-compose.yml" up -d --build
else
  run docker-compose -f "$ROOT/docker-compose.yml" up -d --build
fi

echo "Generating ACTIONS.generated.md..."
ACTIONS_OUT="$ROOT/openclaw/skills/uncle-matt/ACTIONS.generated.md"
if [[ "$DRY_RUN" -eq 0 ]]; then
  ACTIONS_JSON="$(curl --silent --show-error --fail \
    --cacert "$CERT_DIR/ca.crt" \
    --cert "$CERT_DIR/client.crt" \
    --key "$CERT_DIR/client.key" \
    "$BROKER_URL/v1/actions")"
  {
    echo "# Actions (Generated)"
    echo
    echo "Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo
    echo '```json'
    if command -v python3 >/dev/null 2>&1; then
      echo "$ACTIONS_JSON" | python3 -m json.tool
    else
      echo "$ACTIONS_JSON"
    fi
    echo '```'
  } > "$ACTIONS_OUT"
  echo "Wrote $ACTIONS_OUT"
fi

if [[ "$SKIP_VALIDATION" != "1" ]]; then
  echo "Running validation checks..."
  if openclaw security audit --deep; then
    echo "OpenClaw security audit passed."
  elif [[ "${OPENCLAW_AUDIT_FIX:-0}" == "1" ]]; then
    openclaw security audit --fix
    openclaw security audit --deep
  else
    echo "OpenClaw security audit failed. Set OPENCLAW_AUDIT_FIX=1 to auto-fix." >&2
    exit 1
  fi

  "$ROOT/tests/integration/openclaw_tool_policy.test.sh"
  "$ROOT/tests/integration/sandbox_no_egress.test.sh"
else
  echo "Validation skipped (UNCLEMATT_SKIP_VALIDATION=1)."
fi

echo "Setup complete."
