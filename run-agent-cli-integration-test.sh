#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "${SCRIPT_DIR}/node-check.sh" || exit 1

WAIT_TIMEOUT_SECONDS="${REMNOTE_AGENT_WAIT_TIMEOUT:-45}"
POLL_INTERVAL_SECONDS="${REMNOTE_AGENT_POLL_INTERVAL:-2}"
MCP_URL="${REMNOTE_MCP_URL:-http://127.0.0.1:3001/mcp}"
LOG_FILE="${REMNOTE_AGENT_SERVER_LOG:-${TMPDIR:-/tmp}/remnote-mcp-server-agent.log}"

started_server=0
server_pid=""
deadline=$((SECONDS + WAIT_TIMEOUT_SECONDS))
built_server=0
test_exit_code=0
cleanup_ran=0

ensure_built_server() {
  if (( built_server == 1 )); then
    return
  fi

  echo "Building MCP server and bundled CLI before startup..."
  npm run build
  built_server=1
}

cli_status() {
  ensure_built_server
  REMNOTE_MCP_URL="${MCP_URL}" node "${SCRIPT_DIR}/dist/remnote-cli/index.js" --text status 2>&1
}

start_server() {
  ensure_built_server
  echo "MCP server not reachable. Starting a background server..."
  nohup npm run start -- --log-level warn --log-file "${LOG_FILE}" >"${LOG_FILE}" 2>&1 &
  server_pid="$!"
  started_server=1
  echo "Background MCP server started. Log: ${LOG_FILE}"
}

cleanup() {
  if (( cleanup_ran == 1 )); then
    return
  fi
  cleanup_ran=1

  if (( started_server == 0 )) || [[ -z "${server_pid}" ]]; then
    return
  fi

  if ! kill -0 "${server_pid}" 2>/dev/null; then
    return
  fi

  echo "Stopping MCP server started by CLI agent wrapper..."
  kill "${server_pid}" 2>/dev/null || true
  wait "${server_pid}" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

while (( SECONDS < deadline )); do
  if output="$(cli_status)"; then
    if grep -q 'Bridge: Connected' <<<"${output}"; then
      echo "Bridge connected through bundled CLI. Running CLI integration tests..."
      set +e
      REMNOTE_MCP_URL="${MCP_URL}" npm run test:integration:cli -- "$@"
      test_exit_code=$?
      set -e
      exit "${test_exit_code}"
    fi

    echo "MCP server is reachable, but the RemNote bridge is not connected yet. Waiting..."
  else
    if (( started_server == 0 )); then
      start_server
    else
      echo "Waiting for MCP server to become reachable..."
    fi
  fi

  sleep "${POLL_INTERVAL_SECONDS}"
done

echo "Timed out after ${WAIT_TIMEOUT_SECONDS}s waiting for a connected RemNote bridge."
echo "Ensure RemNote is open and the Automation Bridge plugin is connected to ws://127.0.0.1:3002, then rerun."
if [[ -f "${LOG_FILE}" ]]; then
  echo "Background MCP server log: ${LOG_FILE}"
fi
exit 1
