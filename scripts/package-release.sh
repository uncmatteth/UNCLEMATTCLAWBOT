#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(cat "$ROOT/VERSION")"
OUTDIR="$ROOT/_artifacts/release"
OUTFILE="$OUTDIR/uncle-matt-${VERSION}.tgz"

mkdir -p "$OUTDIR"

# Create a release tarball without build artifacts.
# Note: _artifacts and node_modules are excluded by default.
tar -czf "$OUTFILE" \
  --exclude="_artifacts" \
  --exclude=".git" \
  --exclude="**/node_modules" \
  --exclude="**/dist" \
  --exclude="broker/certs" \
  --exclude="broker/certs/**" \
  --exclude="**/.env" \
  --exclude="**/.env.*" \
  --exclude="**/*.key" \
  --exclude="**/*.p12" \
  --exclude="**/*.pfx" \
  -C "$ROOT" \
  README.md LICENSE VERSION .gitleaks.toml .gitleaksignore docker-compose.yml \
  broker openclaw installer docs tests scripts

echo "Created release: $OUTFILE"
