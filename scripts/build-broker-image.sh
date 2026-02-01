#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(cat "$ROOT/VERSION")"
IMAGE="uncle-matt-broker:${VERSION}"
SAVE=0
OUTDIR="$ROOT/_artifacts/images"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --save)
      SAVE=1
      shift
      ;;
    --out)
      OUTDIR="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

docker build -t "$IMAGE" "$ROOT/broker"

echo "Built image: $IMAGE"

if [[ "$SAVE" == "1" ]]; then
  mkdir -p "$OUTDIR"
  OUTFILE="$OUTDIR/uncle-matt-broker-${VERSION}.tar"
  docker save -o "$OUTFILE" "$IMAGE"
  echo "Saved image: $OUTFILE"
fi
