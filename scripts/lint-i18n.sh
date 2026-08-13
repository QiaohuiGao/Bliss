#!/usr/bin/env bash
# CI gates for the i18n layer (US-MARKET-PLAN Phase 6).
#
#   1. No CJK characters anywhere in code paths.
#   2. No hardcoded user-facing strings in web JSX.
#   3. Catalog parity across locales.
#
# Run: bun run lint:i18n

set -uo pipefail
cd "$(dirname "$0")/.."

fail=0

echo "── gate 1: no CJK in code ──────────────────────────────────────"
cjk=$(grep -rlP '[\x{4e00}-\x{9fff}]' apps packages \
  --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" 2>/dev/null \
  | grep -v node_modules \
  | grep -v '/\.next/' \
  | grep -v '/\.expo/' \
  | grep -v 'locales/zh/' \
  | grep -v 'content/zh/' || true)

if [ -n "$cjk" ]; then
  echo "FAIL: Chinese characters found in code paths:"
  echo "$cjk" | sed 's/^/       /'
  fail=1
else
  echo "ok: no CJK outside zh catalogs"
fi

echo
echo "── gate 2: no hardcoded strings in web JSX ─────────────────────"
# Heuristic: a JSX text node of two or more letter-words that is not a {t(...)}
# call. Deliberately conservative — it is a tripwire, not a parser.
hardcoded=$(grep -rnE '^\s*[A-Z][A-Za-z]+( [A-Za-z,.!?'"'"']+){1,}\s*$' \
  apps/web/app apps/web/components --include="*.tsx" 2>/dev/null \
  | grep -v 'className' \
  | grep -v '//' || true)

if [ -n "$hardcoded" ]; then
  echo "FAIL: possible hardcoded user-facing strings:"
  echo "$hardcoded" | sed 's/^/       /'
  fail=1
else
  echo "ok: no bare JSX text nodes detected"
fi

echo
echo "── gate 3: catalog parity ──────────────────────────────────────"
if ! (cd packages/i18n && bun run scripts/check-parity.ts); then
  fail=1
fi

echo
if [ "$fail" -ne 0 ]; then
  echo "i18n lint FAILED"
  exit 1
fi
echo "i18n lint PASSED"
