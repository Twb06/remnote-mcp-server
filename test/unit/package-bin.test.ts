import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

describe('package executables', () => {
  it('publishes the server, CLI, and stdio proxy bins', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf-8')) as {
      bin: Record<string, string>;
    };
    const packageLock = JSON.parse(readFileSync('package-lock.json', 'utf-8')) as {
      packages: { '': { bin: Record<string, string> } };
    };

    expect(packageJson.bin).toMatchObject({
      'remnote-mcp-server': 'dist/index.js',
      'remnote-cli': 'dist/remnote-cli/index.js',
      'remnote-mcp-stdio': 'mcpb/remnote-local/server/index.js',
    });
    expect(packageLock.packages[''].bin).toEqual(packageJson.bin);
    expect(existsSync(packageJson.bin['remnote-mcp-stdio'])).toBe(true);
  });
});
