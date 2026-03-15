/**
 * Workflow 04: Journal
 *
 * Appends entries to today's daily document with and without timestamps.
 */

import { assertTruthy, assertHasField, assertIsArray } from '../assertions.js';
import type { WorkflowContext, WorkflowResult, SharedState, StepResult } from '../types.js';

export async function journalWorkflow(
  ctx: WorkflowContext,
  _state: SharedState
): Promise<WorkflowResult> {
  const steps: StepResult[] = [];

  // Step 1: Append with timestamp (default)
  {
    const start = Date.now();
    try {
      const result = (await ctx.client.callTool('remnote_append_journal', {
        content: `[MCP-TEST] Journal entry ${ctx.runId}`,
      })) as { remIds: string[] };
      assertHasField(result, 'remIds', 'journal append with timestamp');
      assertIsArray(result.remIds, 'remIds should be an array');
      steps.push({ label: 'Append with timestamp', passed: true, durationMs: Date.now() - start });
    } catch (e) {
      steps.push({
        label: 'Append with timestamp',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Step 2: Append without timestamp
  {
    const start = Date.now();
    try {
      const result = (await ctx.client.callTool('remnote_append_journal', {
        content: `[MCP-TEST] No-timestamp entry ${ctx.runId}`,
        timestamp: false,
      })) as { remIds: string[] };
      assertHasField(result, 'remIds', 'journal append without timestamp');
      assertIsArray(result.remIds, 'remIds should be an array');
      steps.push({
        label: 'Append without timestamp',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: 'Append without timestamp',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  // Step 3: Append with markdown
  {
    const start = Date.now();
    try {
      const result = (await ctx.client.callTool('remnote_append_journal', {
        content: `[MCP-TEST] Markdown entry ${ctx.runId}\n\n## Section\n- Item 1\n- Item 2`,
      })) as { remIds: string[] };
      assertHasField(result, 'remIds', 'journal append with markdown');
      assertIsArray(result.remIds, 'remIds should be an array');
      assertTruthy(result.remIds.length >= 3, 'should create multiple rems for markdown');
      steps.push({
        label: 'Append with markdown',
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: 'Append with markdown',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  return { name: 'Journal', steps, skipped: false };
}
