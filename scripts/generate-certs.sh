#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTDIR="$ROOT/_artifacts/certs"
FORCE=0

umask 077

while [[ $# -gt 0 ]]; do
  case "$1" in
    --out)
      OUTDIR="$2"
      shift 2
      ;;
    --force)
      FORCE=1
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

mkdir -p "$OUTDIR"

CA_KEY="$OUTDIR/ca.key"
CA_CERT="$OUTDIR/ca.crt"
SERVER_KEY="$OUTDIR/server.key"
SERVER_CSR="$OUTDIR/server.csr"
SERVER_CERT="$OUTDIR/server.crt"
CLIENT_KEY="$OUTDIR/client.key"
CLIENT_CSR="$OUTDIR/client.csr"
CLIENT_CERT="$OUTDIR/client.crt"
EXTFILE="$OUTDIR/server.ext"

if [[ "$FORCE" != "1" ]]; then
  for f in "$CA_KEY" "$CA_CERT" "$SERVER_KEY" "$SERVER_CERT" "$CLIENT_KEY" "$CLIENT_CERT"; do
    if [[ -f "$f" ]]; then
      echo "Refusing to overwrite existing certs. Use --force to overwrite." >&2
      exit 1
    fi
  done
fi

# CA
openssl genrsa -out "$CA_KEY" 4096
openssl req -x509 -new -nodes -key "$CA_KEY" -sha256 -days 3650 -subj "/CN=uncle-matt-ca" -out "$CA_CERT"

# Server cert with SANs
openssl genrsa -out "$SERVER_KEY" 2048
openssl req -new -key "$SERVER_KEY" -subj "/CN=uncle-matt-broker" -out "$SERVER_CSR"
cat > "$EXTFILE" <<EOT
subjectAltName=DNS:localhost,IP:127.0.0.1
EOT
openssl x509 -req -in "$SERVER_CSR" -CA "$CA_CERT" -CAkey "$CA_KEY" -CAcreateserial -out "$SERVER_CERT" -days 825 -sha256 -extfile "$EXTFILE"

# Client cert
openssl genrsa -out "$CLIENT_KEY" 2048
openssl req -new -key "$CLIENT_KEY" -subj "/CN=openclaw-client" -out "$CLIENT_CSR"
openssl x509 -req -in "$CLIENT_CSR" -CA "$CA_CERT" -CAkey "$CA_KEY" -CAcreateserial -out "$CLIENT_CERT" -days 825 -sha256

chmod 600 "$CA_KEY" "$SERVER_KEY" "$CLIENT_KEY"
rm -f "$SERVER_CSR" "$CLIENT_CSR" "$EXTFILE"

echo "Wrote certs to: $OUTDIR"
