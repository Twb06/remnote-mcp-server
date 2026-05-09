import { describe, expect, it } from 'vitest';
import { mkdtempSync, chmodSync, cpSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function setupServerWrapperSandbox(
  runExitCode: number,
  statusSequence: Array<'fail' | 'connected'> = ['fail', 'connected']
) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'remnote-mcp-server-agent-wrapper-'));
  const binDir = join(tempRoot, 'bin');
  const distDir = join(tempRoot, 'dist');
  mkdirSync(binDir, { recursive: true });
  mkdirSync(distDir, { recursive: true });

  const scriptPath = join(tempRoot, 'run-agent-integration-test.sh');
  const integrationScriptPath = join(tempRoot, 'run-integration-test.sh');
  const statusCheckPath = join(tempRoot, 'run-status-check.sh');
  const nodeCheckPath = join(tempRoot, 'node-check.sh');
  const commandLogPath = join(tempRoot, 'commands.log');
  const statusCountPath = join(tempRoot, 'status-count');
  const serverPidPath = join(tempRoot, 'server.pid');
  const launchdRunningPath = join(tempRoot, 'launchd-running');

  cpSync(resolve(process.cwd(), 'run-agent-integration-test.sh'), scriptPath);
  chmodSync(scriptPath, 0o755);

  writeFileSync(nodeCheckPath, '#!/usr/bin/env bash\nreturn 0\n');
  chmodSync(nodeCheckPath, 0o755);

  writeFileSync(
    join(distDir, 'index.js'),
    `const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(commandLogPath)}, \`daemon:\${args.join(' ')}\\n\`);
if (args[0] !== 'daemon') process.exit(1);
if (args[1] === 'status') {
  if (fs.existsSync(${JSON.stringify(launchdRunningPath)})) {
    console.log('launchd=installed loaded=true running=true pid=2468');
    process.exit(0);
  }
  console.log('launchd=installed loaded=false running=false');
  process.exit(1);
}
if (args[1] === 'stop') {
  fs.rmSync(${JSON.stringify(launchdRunningPath)}, { force: true });
  console.log('launchd service stopped');
  process.exit(0);
}
if (args[1] === 'start') {
  fs.writeFileSync(${JSON.stringify(launchdRunningPath)}, 'running');
  console.log('launchd service started');
  process.exit(0);
}
process.exit(0);
`
  );

  writeFileSync(join(binDir, 'uname'), '#!/usr/bin/env bash\necho Darwin\n');
  chmodSync(join(binDir, 'uname'), 0o755);

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
${statusSequence
  .map((mode, index) =>
    mode === 'fail'
      ? `if (( count == ${index + 1} )); then
  echo "status unavailable" >&2
  exit 1
fi`
      : `if (( count == ${index + 1} )); then
echo '{"connected": true}'
  exit 0
fi`
  )
  .join('\n')}
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
    launchdRunningPath,
    launchAgentPath: join(tempRoot, 'Library', 'LaunchAgents', 'com.remnote.mcp-server.plist'),
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ''}`,
      HOME: tempRoot,
      REMNOTE_AGENT_POLL_INTERVAL: '0',
      REMNOTE_AGENT_WAIT_TIMEOUT: '5',
    },
  };
}

function installLaunchAgent(
  sandbox: ReturnType<typeof setupServerWrapperSandbox>,
  running: boolean
) {
  mkdirSync(join(sandbox.env.HOME, 'Library', 'LaunchAgents'), { recursive: true });
  writeFileSync(sandbox.launchAgentPath, '<plist />');
  if (running) {
    writeFileSync(sandbox.launchdRunningPath, 'running');
  }
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

  it('passes the MCPB suite through to the unified integration wrapper', () => {
    const sandbox = setupServerWrapperSandbox(0);

    const result = spawnSync('bash', [sandbox.scriptPath, '--suite', 'mcpb'], {
      cwd: resolve(process.cwd()),
      encoding: 'utf-8',
      env: sandbox.env,
    });

    const commandLog = readFileSync(sandbox.commandLogPath, 'utf-8');
    const serverPid = Number.parseInt(readFileSync(sandbox.serverPidPath, 'utf-8').trim(), 10);

    expect(result.status).toBe(0);
    expect(commandLog).toContain('integration:--yes --suite mcpb');
    expect(isProcessAlive(serverPid)).toBe(false);
  });

  it('stops a running launchd-managed server before starting its local test server and restores it after', () => {
    const sandbox = setupServerWrapperSandbox(0, ['connected', 'fail', 'connected']);
    installLaunchAgent(sandbox, true);

    const result = spawnSync('bash', [sandbox.scriptPath, '--yes'], {
      cwd: resolve(process.cwd()),
      encoding: 'utf-8',
      env: sandbox.env,
    });

    const commandLog = readFileSync(sandbox.commandLogPath, 'utf-8');
    const serverPid = Number.parseInt(readFileSync(sandbox.serverPidPath, 'utf-8').trim(), 10);

    expect(result.status).toBe(0);
    expect(commandLog).toContain('daemon:daemon status');
    expect(commandLog).toContain('daemon:daemon stop');
    expect(commandLog).toContain('run start -- --log-level warn --log-file');
    expect(commandLog).toContain('integration:--yes --suite all');
    expect(commandLog).toContain('daemon:daemon start');
    expect(isProcessAlive(serverPid)).toBe(false);
    expect(readFileSync(sandbox.launchdRunningPath, 'utf-8')).toBe('running');
  });

  it('leaves an installed but stopped launchd service stopped after integration tests', () => {
    const sandbox = setupServerWrapperSandbox(0);
    installLaunchAgent(sandbox, false);

    const result = spawnSync('bash', [sandbox.scriptPath, '--yes'], {
      cwd: resolve(process.cwd()),
      encoding: 'utf-8',
      env: sandbox.env,
    });

    const commandLog = readFileSync(sandbox.commandLogPath, 'utf-8');
    const serverPid = Number.parseInt(readFileSync(sandbox.serverPidPath, 'utf-8').trim(), 10);

    expect(result.status).toBe(0);
    expect(commandLog).toContain('daemon:daemon status');
    expect(commandLog).not.toContain('daemon:daemon stop');
    expect(commandLog).not.toContain('daemon:daemon start');
    expect(commandLog).toContain('run start -- --log-level warn --log-file');
    expect(isProcessAlive(serverPid)).toBe(false);
  });
});
