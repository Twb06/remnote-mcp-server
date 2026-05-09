#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "${SCRIPT_DIR}/node-check.sh" || exit 1

WAIT_TIMEOUT_SECONDS="${REMNOTE_AGENT_WAIT_TIMEOUT:-45}"
POLL_INTERVAL_SECONDS="${REMNOTE_AGENT_POLL_INTERVAL:-2}"
LOG_FILE="${REMNOTE_AGENT_SERVER_LOG:-${TMPDIR:-/tmp}/remnote-mcp-server-agent.log}"

suite="all"
forwarded_args=()
started_server=0
server_pid=""
deadline=$((SECONDS + WAIT_TIMEOUT_SECONDS))
built_server=0
test_exit_code=0
cleanup_ran=0
launchd_was_running=0
must_start_local_server=0

usage() {
  cat <<'EOF'
Usage: ./run-agent-integration-test.sh [--yes] [--suite all|mcp|mcpb|cli]

Agent-safe live integration wrapper. Builds once, starts remnote-mcp-server if
needed, waits for a connected RemNote bridge, then runs the selected suite.
Default suite is "all".

Options:
  --yes                 Accepted for compatibility; agent wrapper is always non-interactive
  --suite all|mcp|mcpb|cli
                        Run all suites, only direct MCP, only MCPB stdio proxy, or only bundled CLI
  -h, --help            Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes)
      shift
      ;;
    --suite)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --suite" >&2
        exit 1
      fi
      suite="$2"
      shift 2
      ;;
    --suite=*)
      suite="${1#--suite=}"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      forwarded_args+=("$1")
      shift
      ;;
  esac
done

case "${suite}" in
  all|mcp|mcpb|cli) ;;
  *)
    echo "Invalid --suite value: ${suite}. Expected all, mcp, mcpb, or cli." >&2
    exit 1
    ;;
esac

ensure_built_server() {
  if (( built_server == 1 )); then
    return
  fi

  echo "Building MCP server and bundled CLI before startup..."
  npm run build
  built_server=1
}

status_output() {
  "${SCRIPT_DIR}/run-status-check.sh" 2>&1
}

daemon_cli() {
  node "${SCRIPT_DIR}/dist/index.js" daemon "$@"
}

is_macos() {
  [[ "$(uname -s)" == "Darwin" ]]
}

launchd_status_output() {
  daemon_cli status 2>&1
}

stop_running_launchd_server() {
  if ! is_macos; then
    return
  fi

  if ! [[ -f "${HOME}/Library/LaunchAgents/com.remnote.mcp-server.plist" ]]; then
    return
  fi

  local output
  local status_code
  set +e
  output="$(launchd_status_output)"
  status_code=$?
  set -e

  if (( status_code == 0 )) && grep -q 'launchd=installed' <<<"${output}" && grep -q 'running=true' <<<"${output}"; then
    echo "Detected running launchd-managed remnote-mcp-server. Stopping it before integration tests..."
    daemon_cli stop
    launchd_was_running=1
    must_start_local_server=1
  elif grep -q 'launchd=installed' <<<"${output}"; then
    echo "launchd-managed remnote-mcp-server is installed but not running; leaving it stopped."
  else
    echo "Unable to determine launchd-managed remnote-mcp-server state; refusing to run integration tests against an unknown server." >&2
    echo "${output}" >&2
    exit 1
  fi
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

  if (( started_server == 1 )) && [[ -n "${server_pid}" ]]; then
    if kill -0 "${server_pid}" 2>/dev/null; then
      echo "Stopping MCP server started by agent wrapper..."
      kill "${server_pid}" 2>/dev/null || true
      wait "${server_pid}" 2>/dev/null || true
    fi
  fi

  if (( launchd_was_running == 1 )); then
    echo "Restarting launchd-managed remnote-mcp-server that was running before integration tests..."
    daemon_cli start || true
  fi
}

trap cleanup EXIT INT TERM

ensure_built_server
stop_running_launchd_server

while (( SECONDS < deadline )); do
  if output="$(status_output)"; then
    if (( must_start_local_server == 1 )) && (( started_server == 0 )); then
      echo "Waiting for stopped launchd-managed MCP server to become unreachable before starting repo-local server..."
      sleep "${POLL_INTERVAL_SECONDS}"
      continue
    fi

    if grep -q '"connected": true' <<<"${output}"; then
      echo "Bridge connected. Running integration test suite: ${suite}"
      set +e
      integration_args=(--yes --suite "${suite}")
      if (( ${#forwarded_args[@]} > 0 )); then
        integration_args+=("${forwarded_args[@]}")
      fi
      REMNOTE_SKIP_BUILD=1 "${SCRIPT_DIR}/run-integration-test.sh" "${integration_args[@]}"
      test_exit_code=$?
      set -e
      exit "${test_exit_code}"
    fi

    echo "MCP server is up, but the RemNote bridge is not connected yet. Waiting..."
  else
    if (( started_server == 0 )); then
      start_server
      must_start_local_server=0
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
