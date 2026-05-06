import { describe, expect, it } from 'vitest';
import { mkdtempSync, chmodSync, cpSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function setupServerWrapperSandbox(runExitCode: number) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'remnote-mcp-server-agent-wrapper-'));
  const binDir = join(tempRoot, 'bin');
  mkdirSync(binDir, { recursive: true });

  const scriptPath = join(tempRoot, 'run-agent-integration-test.sh');
  const integrationScriptPath = join(tempRoot, 'run-integration-test.sh');
  const statusCheckPath = join(tempRoot, 'run-status-check.sh');
  const nodeCheckPath = join(tempRoot, 'node-check.sh');
  const commandLogPath = join(tempRoot, 'commands.log');
  const statusCountPath = join(tempRoot, 'status-count');
  const serverPidPath = join(tempRoot, 'server.pid');

  cpSync(resolve(process.cwd(), 'run-agent-integration-test.sh'), scriptPath);
  chmodSync(scriptPath, 0o755);

  writeFileSync(nodeCheckPath, '#!/usr/bin/env bash\nreturn 0\n');
  chmodSync(nodeCheckPath, 0o755);

  writeFileSync(
    integrationScriptPath,
    `#!/usr/bin/env bash
echo "integration:$*" >> "${commandLogPath}"
exit ${runExitCode}
`
  );
  chmodSync(integrationScriptPath, 0o755);

  writeFileSync(
    statusCheckPath,
    `#!/usr/bin/env bash
set -euo pipefail
count=0
if [[ -f "${statusCountPath}" ]]; then
  count="$(cat "${statusCountPath}")"
fi
count=$((count + 1))
echo "$count" > "${statusCountPath}"
if (( count == 1 )); then
  echo "status unavailable" >&2
  exit 1
fi
echo '{"connected": true}'
`
  );
  chmodSync(statusCheckPath, 0o755);

  writeFileSync(
    join(binDir, 'npm'),
    `#!/usr/bin/env bash
set -euo pipefail
echo "$*" >> "${commandLogPath}"
cmd="$*"
if [[ "$cmd" == "run build" ]]; then
  exit 0
fi
if [[ "$cmd" == "run start -- --log-level warn --log-file "* ]]; then
  echo "$$" > "${serverPidPath}"
  trap 'exit 0' TERM INT
  while true; do
    sleep 1
  done
fi
echo "unexpected npm invocation: $cmd" >&2
exit 1
`
  );
  chmodSync(join(binDir, 'npm'), 0o755);

  return {
    scriptPath,
    commandLogPath,
    serverPidPath,
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ''}`,
      HOME: tempRoot,
    },
  };
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe('run-agent-integration-test.sh', () => {
  it('stops the MCP server it started after a successful integration run', () => {
    const sandbox = setupServerWrapperSandbox(0);

    const result = spawnSync('bash', [sandbox.scriptPath, '--yes'], {
      cwd: resolve(process.cwd()),
      encoding: 'utf-8',
      env: sandbox.env,
    });

    const commandLog = readFileSync(sandbox.commandLogPath, 'utf-8');
    const serverPid = Number.parseInt(readFileSync(sandbox.serverPidPath, 'utf-8').trim(), 10);

    expect(result.status).toBe(0);
    expect(commandLog).toContain('run start -- --log-level warn --log-file');
    expect(commandLog).toContain('integration:--yes --suite all');
    expect(isProcessAlive(serverPid)).toBe(false);
  });

  it('stops the MCP server it started after a failed integration run', () => {
    const sandbox = setupServerWrapperSandbox(9);

    const result = spawnSync('bash', [sandbox.scriptPath], {
      cwd: resolve(process.cwd()),
      encoding: 'utf-8',
      env: sandbox.env,
    });

    const serverPid = Number.parseInt(readFileSync(sandbox.serverPidPath, 'utf-8').trim(), 10);

    expect(result.status).toBe(9);
    expect(isProcessAlive(serverPid)).toBe(false);
  });

  it('passes a selected suite through to the unified integration wrapper', () => {
    const sandbox = setupServerWrapperSandbox(0);

    const result = spawnSync('bash', [sandbox.scriptPath, '--suite', 'cli'], {
      cwd: resolve(process.cwd()),
      encoding: 'utf-8',
      env: sandbox.env,
    });

    const commandLog = readFileSync(sandbox.commandLogPath, 'utf-8');
    const serverPid = Number.parseInt(readFileSync(sandbox.serverPidPath, 'utf-8').trim(), 10);

    expect(result.status).toBe(0);
    expect(commandLog).toContain('integration:--yes --suite cli');
    expect(isProcessAlive(serverPid)).toBe(false);
  });
});
