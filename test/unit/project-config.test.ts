import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vitestConfig from '../../vitest.config.js';

describe('project config', () => {
  it('prevents production dist emit when TypeScript reports errors', () => {
    const tsconfig = JSON.parse(readFileSync('tsconfig.json', 'utf-8')) as {
      compilerOptions: { noEmitOnError?: boolean };
    };

    expect(tsconfig.compilerOptions.noEmitOnError).toBe(true);
  });

  it('keeps generated output out of Vitest test discovery', () => {
    const config = vitestConfig as { test?: { exclude?: string[] } };

    expect(config.test?.exclude).toEqual(
      expect.arrayContaining(['test/integration/**', 'node_modules/**', 'dist/**', 'coverage/**'])
    );
  });
});
