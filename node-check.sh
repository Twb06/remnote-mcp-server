#!/bin/bash

# Node.js Availability Check with NVM Fallback
#
# Purpose: Ensures Node.js and npm are available before running npm commands.
#          If Node is not in PATH, attempts to load it via NVM.
#          Designed to be sourced by other scripts: source ./node-check.sh
#
# Exit Codes:
#   0 - Success: Node.js and npm are available
#   1 - Failure: Node.js not available and couldn't be loaded
#
# Usage:
#   source "$(dirname "$0")/node-check.sh" || exit 1

MIN_NODE_VERSION="22.13.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

version_is_supported() {
  local current_version="$1"
  local current_major current_minor current_patch
  local minimum_major minimum_minor minimum_patch

  IFS='.' read -r current_major current_minor current_patch <<< "$current_version"
  IFS='.' read -r minimum_major minimum_minor minimum_patch <<< "$MIN_NODE_VERSION"

  ((current_major > minimum_major)) ||
    ((current_major == minimum_major && current_minor > minimum_minor)) ||
    ((current_major == minimum_major && current_minor == minimum_minor && current_patch >= minimum_patch))
}

current_node_version() {
  node -p 'process.versions.node'
}

activate_project_node() {
  if [ ! -s "$HOME/.nvm/nvm.sh" ]; then
    return 1
  fi

  source "$HOME/.nvm/nvm.sh" &> /dev/null
  nvm use "$(cat "$SCRIPT_DIR/.nvmrc")" &> /dev/null
}

commands_available() {
  command -v node &> /dev/null && command -v npm &> /dev/null
}

if commands_available && version_is_supported "$(current_node_version)"; then
  return 0 2>/dev/null || exit 0
fi

if activate_project_node && commands_available && version_is_supported "$(current_node_version)"; then
  return 0 2>/dev/null || exit 0
fi

if commands_available; then
  echo "Error: Node.js >= $MIN_NODE_VERSION is required; found $(current_node_version)." >&2
else
  echo "Error: Node.js >= $MIN_NODE_VERSION and npm are required." >&2
fi

echo "Install the project version with: nvm install $(cat "$SCRIPT_DIR/.nvmrc")" >&2
return 1 2>/dev/null || exit 1
