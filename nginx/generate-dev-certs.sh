#!/usr/bin/env bash
# Generate self-signed TLS certificates for local development.
# For production, use Let's Encrypt via certbot or similar.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERT_DIR="${SCRIPT_DIR}/certs"

mkdir -p "${CERT_DIR}"

if [ -f "${CERT_DIR}/cert.pem" ] && [ -f "${CERT_DIR}/key.pem" ]; then
  echo "Certificates already exist in ${CERT_DIR}. Delete them to regenerate."
  exit 0
fi

echo "Generating self-signed TLS certificate for local development..."

openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout "${CERT_DIR}/key.pem" \
  -out "${CERT_DIR}/cert.pem" \
  -subj "/C=US/ST=Dev/L=Local/O=AgentPoker/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

echo "Self-signed certificates generated:"
echo "  Certificate: ${CERT_DIR}/cert.pem"
echo "  Private key: ${CERT_DIR}/key.pem"
echo ""
echo "NOTE: These are for development only. For production, use Let's Encrypt."
