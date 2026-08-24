#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Branch status"
git status -sb
echo
echo "==> Commits to publish (not on origin/main yet)"
git log origin/main..HEAD --oneline || true
echo

if ! git rev-parse --verify origin/main >/dev/null 2>&1; then
  echo "Fetching origin..."
  git fetch origin
fi

AHEAD=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)
if [[ "$AHEAD" == "0" ]]; then
  echo "Nothing to push — local main matches origin/main."
  exit 0
fi

echo "==> Pushing main to origin (triggers Vercel production deploy)..."
git push origin main

echo
echo "Done. Wait ~1–2 minutes, then hard-refresh:"
echo "  https://family-atlas-cyan.vercel.app/#/journey"
