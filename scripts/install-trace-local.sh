#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Trace local install requires Node.js 20 or newer."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Trace local install requires npm."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Installing Trace local prototype dependencies..."
  npm install
fi

echo "Starting Trace local data-plane service..."
echo "Health: http://localhost:${TRACE_PORT:-8787}/health"
echo "Fixtures: http://localhost:${TRACE_PORT:-8787}/trace/fixtures"
npm run trace:serve
