import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('project config', () => {
  it('prevents production dist emit when TypeScript reports errors', () => {
    const tsconfig = JSON.parse(readFileSync('tsconfig.json', 'utf-8')) as {
      compilerOptions: { noEmitOnError?: boolean };
    };

    expect(tsconfig.compilerOptions.noEmitOnError).toBe(true);
  });
});
