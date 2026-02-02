#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(cat "$ROOT/VERSION")"
IMAGE="uncle-matt-broker:${VERSION}"

ACTIONS_PATH="$ROOT/broker/config/actions.default.json"
SCHEMA_PATH="$ROOT/broker/config/actions.schema.json"
BUILD=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --actions)
      ACTIONS_PATH="$2"
      shift 2
      ;;
    --schema)
      SCHEMA_PATH="$2"
      shift 2
      ;;
    --build)
      BUILD=1
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "$ACTIONS_PATH" ]]; then
  echo "Actions file not found: $ACTIONS_PATH" >&2
  exit 1
fi
if [[ ! -f "$SCHEMA_PATH" ]]; then
  echo "Schema file not found: $SCHEMA_PATH" >&2
  exit 1
fi

if [[ "$BUILD" == "1" ]] || ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "Building broker image for validation..."
  docker build -t "$IMAGE" "$ROOT/broker"
fi

docker run --rm \
  -v "$ACTIONS_PATH":/tmp/actions.json:ro \
  -v "$SCHEMA_PATH":/tmp/actions.schema.json:ro \
  "$IMAGE" \
  node -e "const fs=require('fs');const Ajv=require('ajv/dist/2020');const actions=JSON.parse(fs.readFileSync('/tmp/actions.json','utf8'));const schema=JSON.parse(fs.readFileSync('/tmp/actions.schema.json','utf8'));const ajv=new Ajv({allErrors:true, strict:true});const validate=ajv.compile(schema);if(!validate(actions)){console.error('Invalid actions config:');for(const e of (validate.errors||[])){const p=String(e.instancePath||'');const m=String(e.message||'');console.error(p+' '+m);}process.exit(1);}console.log('Actions config OK');"
