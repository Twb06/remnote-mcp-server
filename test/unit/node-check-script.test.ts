import { chmodSync, copyFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

function runNodeCheck(version: string) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'remnote-node-check-'));
  const binDir = join(tempRoot, 'bin');
  mkdirSync(binDir);

  copyFileSync(resolve('node-check.sh'), join(tempRoot, 'node-check.sh'));
  copyFileSync(resolve('.nvmrc'), join(tempRoot, '.nvmrc'));

  writeFileSync(
    join(binDir, 'node'),
    `#!/usr/bin/env bash
if [[ "$1" == "-p" ]]; then
  echo "${version}"
  exit 0
fi
echo "v${version}"
`
  );
  writeFileSync(join(binDir, 'npm'), '#!/usr/bin/env bash\nexit 0\n');
  chmodSync(join(binDir, 'node'), 0o755);
  chmodSync(join(binDir, 'npm'), 0o755);

  return spawnSync('bash', ['-c', 'source ./node-check.sh && echo ready'], {
    cwd: tempRoot,
    encoding: 'utf-8',
    env: {
      PATH: `${binDir}:/bin:/usr/bin`,
      HOME: tempRoot,
    },
  });
}

describe('node-check.sh', () => {
  it.each(['22.13.0', '22.14.0', '24.0.0'])('accepts supported Node.js version %s', (version) => {
    const result = runNodeCheck(version);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('ready');
  });

  it.each(['20.19.0', '22.12.0'])('rejects unsupported Node.js version %s', (version) => {
    const result = runNodeCheck(version);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(`Node.js >= 22.13.0 is required; found ${version}.`);
    expect(result.stderr).toContain('nvm install 24');
  });
});
