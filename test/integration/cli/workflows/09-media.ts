import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertEqual, assertTruthy } from '../assertions.js';
import type { SharedState, StepResult, WorkflowContext, WorkflowResult } from '../types.js';

const MEDIA_REM_ID = process.env.REMNOTE_TEST_MEDIA_REM_ID;
const MEDIA_FIELD = process.env.REMNOTE_TEST_MEDIA_FIELD === 'backText' ? 'backText' : 'text';

export async function mediaWorkflow(
  ctx: WorkflowContext,
  _state: SharedState
): Promise<WorkflowResult> {
  if (!MEDIA_REM_ID) {
    return {
      name: 'Managed Media',
      steps: [
        {
          label: 'Set REMNOTE_TEST_MEDIA_REM_ID to a Rem containing a managed image',
          passed: true,
          durationMs: 0,
        },
      ],
      skipped: true,
    };
  }

  const steps: StepResult[] = [];
  const tempDir = await mkdtemp(join(tmpdir(), 'remnote-cli-media-integration-'));
  try {
    const readStart = Date.now();
    const read = (await ctx.cli.runExpectSuccess([
      'read',
      MEDIA_REM_ID,
      '--content-mode',
      'none',
      '--include-media-metadata',
    ])) as Record<string, unknown>;
    const media = Array.isArray(read.media) ? (read.media as Array<Record<string, unknown>>) : [];
    const selected = media.find(
      (item) => item.field === MEDIA_FIELD && item.source === 'remnote_managed_local'
    );
    assertTruthy(selected?.mediaId, 'CLI read mediaId');
    steps.push({
      label: 'CLI read exposes managed-image metadata',
      passed: true,
      durationMs: Date.now() - readStart,
    });

    const outputPath = join(tempDir, 'retrieved-image');
    const getStart = Date.now();
    const result = (await ctx.cli.runExpectSuccess([
      'get-media',
      MEDIA_REM_ID,
      '--field',
      MEDIA_FIELD,
      '--media-id',
      selected!.mediaId as string,
      '--output',
      outputPath,
    ])) as Record<string, unknown>;
    const bytes = await readFile(outputPath);
    assertTruthy(bytes.length > 0, 'saved image bytes');
    assertEqual(bytes.length, result.sizeBytes, 'saved image size');
    assertEqual(result.outputPath, outputPath, 'reported output path');
    steps.push({
      label: 'CLI get-media saves exact image bytes',
      passed: true,
      durationMs: Date.now() - getStart,
    });
  } catch (error) {
    steps.push({
      label: 'CLI managed-media workflow',
      passed: false,
      durationMs: 0,
      error: (error as Error).message,
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  return { name: 'Managed Media', steps, skipped: false };
}
