#!/usr/bin/env bash
# Phase 2 exit criterion: "a build artefact grep confirms no AI provider
# key in any client chunk." See docs/adr/ADR-009-deployment-environments-secrets.md.
#
# Reads every server-only variable name from .env.example (anything not
# prefixed NEXT_PUBLIC_) and greps the built client bundle for that name.
# Run after `npm run build`.
set -euo pipefail

CLIENT_DIR=".next/static"

if [ ! -d "$CLIENT_DIR" ]; then
  echo "error: $CLIENT_DIR not found — run 'npm run build' first" >&2
  exit 1
fi

vars=$(grep -E '^[A-Z_]+=' .env.example | cut -d= -f1 | grep -v '^NEXT_PUBLIC_' || true)

if [ -z "$vars" ]; then
  echo "No server-only variable names declared in .env.example — nothing to check."
  exit 0
fi

found=0
while IFS= read -r var; do
  [ -z "$var" ] && continue
  if grep -r -l "$var" "$CLIENT_DIR" > /dev/null 2>&1; then
    echo "FAIL: server-only variable name '$var' appears in $CLIENT_DIR" >&2
    found=1
  fi
done <<< "$vars"

if [ "$found" -ne 0 ]; then
  exit 1
fi

echo "OK: no server-only env var names found in $CLIENT_DIR"
