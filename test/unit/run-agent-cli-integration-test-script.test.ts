import { describe, expect, it } from 'vitest';
import { mkdtempSync, chmodSync, cpSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function setupCliWrapperSandbox(runExitCode: number) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'remnote-mcp-server-cli-agent-wrapper-'));
  const binDir = join(tempRoot, 'bin');
  const distCliDir = join(tempRoot, 'dist', 'remnote-cli');
  mkdirSync(binDir, { recursive: true });
  mkdirSync(distCliDir, { recursive: true });

  const scriptPath = join(tempRoot, 'run-agent-cli-integration-test.sh');
  const nodeCheckPath = join(tempRoot, 'node-check.sh');
  const commandLogPath = join(tempRoot, 'commands.log');
  const statusCountPath = join(tempRoot, 'status-count');
  const serverPidPath = join(tempRoot, 'server.pid');

  cpSync(resolve(process.cwd(), 'run-agent-cli-integration-test.sh'), scriptPath);
  chmodSync(scriptPath, 0o755);

  writeFileSync(nodeCheckPath, '#!/usr/bin/env bash\nreturn 0\n');
  chmodSync(nodeCheckPath, 0o755);

  writeFileSync(
    join(distCliDir, 'index.js'),
    `#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const logPath = '${commandLogPath}';
const countPath = '${statusCountPath}';
writeFileSync(logPath, 'cli:' + process.argv.slice(2).join(' ') + '\\n', { flag: 'a' });

let count = 0;
if (existsSync(countPath)) {
  count = Number.parseInt(readFileSync(countPath, 'utf-8'), 10);
}
count += 1;
writeFileSync(countPath, String(count));

if (count === 1) {
  console.error('Cannot connect to MCP server');
  process.exit(2);
}

console.log('Bridge: Connected (plugin v0.14.0)');
console.log('CLI: v0.14.0');
`
  );
  chmodSync(join(distCliDir, 'index.js'), 0o755);

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
if [[ "$cmd" == "run test:integration:cli -- "* ]] || [[ "$cmd" == "run test:integration:cli --" ]]; then
  exit ${runExitCode}
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

describe('run-agent-cli-integration-test.sh', () => {
  it('starts the MCP server when needed and runs CLI integration tests', () => {
    const sandbox = setupCliWrapperSandbox(0);

    const result = spawnSync('bash', [sandbox.scriptPath, '--yes'], {
      cwd: resolve(process.cwd()),
      encoding: 'utf-8',
      env: sandbox.env,
    });

    const commandLog = readFileSync(sandbox.commandLogPath, 'utf-8');
    const serverPid = Number.parseInt(readFileSync(sandbox.serverPidPath, 'utf-8').trim(), 10);

    expect(result.status).toBe(0);
    expect(commandLog).toContain('run start -- --log-level warn --log-file');
    expect(commandLog).toContain('run test:integration:cli -- --yes');
    expect(commandLog).toContain('cli:--text status');
    expect(isProcessAlive(serverPid)).toBe(false);
  });

  it('stops the MCP server it started after failed CLI integration tests', () => {
    const sandbox = setupCliWrapperSandbox(7);

    const result = spawnSync('bash', [sandbox.scriptPath], {
      cwd: resolve(process.cwd()),
      encoding: 'utf-8',
      env: sandbox.env,
    });

    const serverPid = Number.parseInt(readFileSync(sandbox.serverPidPath, 'utf-8').trim(), 10);

    expect(result.status).toBe(7);
    expect(isProcessAlive(serverPid)).toBe(false);
  });
});
