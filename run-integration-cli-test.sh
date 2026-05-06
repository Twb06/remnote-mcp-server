#!/usr/bin/env bash
set -e

source "$(dirname "$0")/node-check.sh" || exit 1

echo "Building project..."
npm run build

echo ""
echo "Running CLI integration tests..."
npm run test:integration:cli -- "$@"
