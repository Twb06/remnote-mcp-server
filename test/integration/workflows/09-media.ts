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
  let mediaId: string | undefined;

  {
    const start = Date.now();
    try {
      const read = await ctx.client.callTool('remnote_read_note', {
        remId: MEDIA_REM_ID,
        contentMode: 'none',
        includeMediaMetadata: true,
      });
      const media = Array.isArray(read.media) ? (read.media as Array<Record<string, unknown>>) : [];
      const selected = media.find(
        (item) => item.field === MEDIA_FIELD && item.source === 'remnote_managed_local'
      );
      assertTruthy(selected, `managed ${MEDIA_FIELD} image metadata`);
      assertTruthy(selected?.mediaId, 'mediaId');
      mediaId = selected!.mediaId as string;
      steps.push({
        label: 'Read ordered managed-image metadata',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (error) {
      steps.push({
        label: 'Read ordered managed-image metadata',
        passed: false,
        durationMs: Date.now() - start,
        error: (error as Error).message,
      });
    }
  }

  if (mediaId) {
    const start = Date.now();
    try {
      const result = await ctx.client.callToolRaw('remnote_get_media', {
        remId: MEDIA_REM_ID,
        field: MEDIA_FIELD,
        mediaId,
      });
      const image = result.content?.find((item) => item.type === 'image');
      assertTruthy(image?.data, 'MCP-native image data');
      assertTruthy(image?.mimeType?.startsWith('image/'), 'MCP-native image MIME');
      assertEqual(result.structuredContent?.mediaId, mediaId, 'returned mediaId');
      const decoded = Buffer.from(image!.data!, 'base64');
      assertEqual(decoded.length, result.structuredContent?.sizeBytes, 'decoded image size');
      steps.push({
        label: 'Retrieve MCP-native managed image with matching metadata',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (error) {
      steps.push({
        label: 'Retrieve MCP-native managed image with matching metadata',
        passed: false,
        durationMs: Date.now() - start,
        error: (error as Error).message,
      });
    }

    const staleStart = Date.now();
    try {
      const errorText = await ctx.client.callToolExpectError('remnote_get_media', {
        remId: MEDIA_REM_ID,
        field: MEDIA_FIELD,
        mediaId: `${mediaId}-stale`,
      });
      assertTruthy(errorText.includes('Stale or missing media ID'), 'stale media rejection');
      steps.push({
        label: 'Reject stale media ID',
        passed: true,
        durationMs: Date.now() - staleStart,
      });
    } catch (error) {
      steps.push({
        label: 'Reject stale media ID',
        passed: false,
        durationMs: Date.now() - staleStart,
        error: (error as Error).message,
      });
    }
  }

  return { name: 'Managed Media', steps, skipped: false };
}
