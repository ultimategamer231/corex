#!/bin/bash
# SessionStart hook for Claude Code cloud sessions: installs workspace
# dependencies and starts Docker so lint, typecheck, tests, builds and the
# local Supabase stack work. Does nothing on local machines.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Dependencies (non-interactive; reuses the cached store when present).
corepack enable >/dev/null 2>&1 || true
pnpm install --prefer-offline

# Docker daemon for the local Supabase stack (pnpm db:local:start).
if command -v dockerd >/dev/null 2>&1 && ! docker info >/dev/null 2>&1; then
  nohup dockerd >/tmp/dockerd.log 2>&1 &
  for _ in $(seq 1 30); do
    docker info >/dev/null 2>&1 && break
    sleep 1
  done
  if docker info >/dev/null 2>&1; then
    echo "Docker daemon started."
  else
    echo "Docker daemon did not start; see /tmp/dockerd.log. Local Supabase will be unavailable." >&2
  fi
fi

# Pull Supabase images from Docker Hub (public.ecr.aws is rate-limited here).
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo 'export SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io' >> "$CLAUDE_ENV_FILE"
fi
