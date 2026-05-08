import { describe, expect, it } from 'vitest';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function setupIntegrationWrapperSandbox() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'remnote-mcp-server-integration-wrapper-'));
  const binDir = join(tempRoot, 'bin');
  mkdirSync(binDir, { recursive: true });

  const scriptPath = join(tempRoot, 'run-integration-test.sh');
  const nodeCheckPath = join(tempRoot, 'node-check.sh');
  const commandLogPath = join(tempRoot, 'commands.log');

  cpSync(resolve(process.cwd(), 'run-integration-test.sh'), scriptPath);
  chmodSync(scriptPath, 0o755);

  writeFileSync(nodeCheckPath, '#!/usr/bin/env bash\nreturn 0\n');
  chmodSync(nodeCheckPath, 0o755);

  writeFileSync(
    join(binDir, 'npm'),
    `#!/usr/bin/env bash
set -euo pipefail
echo "$*" >> "${commandLogPath}"
cmd="$*"
if [[ "$cmd" == "run build" ]]; then
  exit 0
fi
if [[ "$cmd" == "run test:integration:mcp -- "* ]] || [[ "$cmd" == "run test:integration:mcpb -- "* ]] || [[ "$cmd" == "run test:integration:cli -- "* ]]; then
  exit 0
fi
echo "unexpected npm invocation: $cmd" >&2
exit 1
`
  );
  chmodSync(join(binDir, 'npm'), 0o755);

  return {
    scriptPath,
    commandLogPath,
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ''}`,
      HOME: tempRoot,
    },
  };
}

describe('run-integration-test.sh', () => {
  it('runs MCP and CLI integration suites by default', () => {
    const sandbox = setupIntegrationWrapperSandbox();

    const result = spawnSync('bash', [sandbox.scriptPath, '--yes'], {
      cwd: resolve(process.cwd()),
      encoding: 'utf-8',
      env: sandbox.env,
    });

    const commandLog = readFileSync(sandbox.commandLogPath, 'utf-8');
    expect(result.status).toBe(0);
    expect(commandLog).toContain('run build');
    expect(commandLog).toContain('run test:integration:mcp -- --yes');
    expect(commandLog).toContain('run test:integration:mcpb -- --yes');
    expect(commandLog).toContain('run test:integration:cli -- --yes');
  });

  it('can run only the selected suite', () => {
    const sandbox = setupIntegrationWrapperSandbox();

    const result = spawnSync('bash', [sandbox.scriptPath, '--yes', '--suite', 'cli'], {
      cwd: resolve(process.cwd()),
      encoding: 'utf-8',
      env: sandbox.env,
    });

    const commandLog = readFileSync(sandbox.commandLogPath, 'utf-8');
    expect(result.status).toBe(0);
    expect(commandLog).toContain('run build');
    expect(commandLog).not.toContain('run test:integration:mcp');
    expect(commandLog).toContain('run test:integration:cli -- --yes');
  });

  it('can run only the MCPB suite', () => {
    const sandbox = setupIntegrationWrapperSandbox();

    const result = spawnSync('bash', [sandbox.scriptPath, '--yes', '--suite', 'mcpb'], {
      cwd: resolve(process.cwd()),
      encoding: 'utf-8',
      env: sandbox.env,
    });

    const commandLog = readFileSync(sandbox.commandLogPath, 'utf-8');
    expect(result.status).toBe(0);
    expect(commandLog).toContain('run build');
    expect(commandLog).not.toContain('run test:integration:mcp --');
    expect(commandLog).toContain('run test:integration:mcpb -- --yes');
    expect(commandLog).not.toContain('run test:integration:cli');
  });

  it('rejects invalid suite names', () => {
    const sandbox = setupIntegrationWrapperSandbox();

    const result = spawnSync('bash', [sandbox.scriptPath, '--yes', '--suite', 'nope'], {
      cwd: resolve(process.cwd()),
      encoding: 'utf-8',
      env: sandbox.env,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Invalid --suite value');
  });
});
