#!/usr/bin/env bash
# Proves no server-only secret *value* reaches the browser bundle
# (docs/adr/ADR-009-deployment-environments-secrets.md, PRD §1.9).
#
# Builds the app with a unique sentinel value in every secret variable
# from .env.example, then searches the client bundle for those sentinels.
#
# Why values, not names: the realistic leak is app code handing a secret to
# a client component (a prop, a serialized object) — only the *value*
# reaches the bundle then. And libraries legitimately mention variable
# names in shared code (Better Auth's env accessor reads BETTER_AUTH_SECRET
# by name in the browser bundle, where it returns nothing), so a name
# search both misses real leaks and flags harmless references.
#
# Rebuilds .next with sentinel env; run it as its own step.
set -euo pipefail

# Configuration, not secrets: safe (and sometimes intended) in the browser.
PUBLIC_CONFIG='^(BETTER_AUTH_URL|AUTH_EMAIL_PROVIDER|AUTH_EMAIL_FROM|AWS_REGION)$'

secrets=$(grep -E '^[A-Z_]+=' .env.example | cut -d= -f1 | grep -v '^NEXT_PUBLIC_' | grep -Ev "$PUBLIC_CONFIG" || true)
if [ -z "$secrets" ]; then
  echo "No server-only secrets declared in .env.example — nothing to check."
  exit 0
fi

# od reads a fixed byte count, so no SIGPIPE under pipefail (tr|head aborts silently).
run_id=$(od -An -N6 -tx1 /dev/urandom | tr -d ' \n')
declare -a assignments=()
declare -a sentinels=()
while IFS= read -r var; do
  [ -z "$var" ] && continue
  token="sentinel_$(echo "$var" | tr 'A-Z' 'a-z')_${run_id}_secret_value_padding"
  case "$var" in
    *DATABASE_URL*) value="postgresql://${token}:${token}@sentinel.invalid:5432/${token}" ;;
    *) value="$token" ;;
  esac
  assignments+=("$var=$value")
  sentinels+=("$var:$token")
done <<< "$secrets"

echo "Building with sentinel values for: $(echo "$secrets" | tr '\n' ' ')"
env "${assignments[@]}" npm run build > /tmp/check-client-bundle-build.log 2>&1 || {
  echo "error: build with sentinel env failed — see /tmp/check-client-bundle-build.log" >&2
  exit 1
}

# Everything a browser can receive from the build: client JS in .next/static,
# plus prerendered pages' HTML and RSC payloads in .next/server/app (a
# secret passed as a prop to a client component on a static page lands
# there, not in .next/static). Server JS is excluded — it never ships.
browser_files() {
  find .next/static -type f
  find .next/server/app -type f \( -name '*.html' -o -name '*.rsc' -o -name '*.body' -o -name '*.meta' \) 2>/dev/null
}

found=0
for pair in "${sentinels[@]}"; do
  var="${pair%%:*}"
  token="${pair#*:}"
  hits=$(browser_files | xargs grep -l -F "$token" 2>/dev/null || true)
  if [ -n "$hits" ]; then
    echo "FAIL: the value of $var reached browser-facing build output:" >&2
    echo "$hits" | sed 's/^/  /' >&2
    found=1
  fi
done

[ "$found" -eq 0 ] && echo "OK: no server-only secret values in client JS or prerendered pages"
# Limit: pages rendered per request aren't in build output; a leak there
# can only be caught at runtime (or in review).
exit "$found"
