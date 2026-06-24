/**
 * Workflow 08: Set Property
 *
 * Validates remnote-cli set-property through the shared Automation Bridge Test
 * Tag fixture. The fixture must be a property-bearing tag/table with an
 * automation-level property.
 */

import { assertEqual, assertHasField, assertIsArray, assertTruthy } from '../assertions.js';
import type { WorkflowContext, WorkflowResult, SharedState, StepResult } from '../types.js';

const PROPERTY_FIXTURE_TAG_TITLE = 'Automation Bridge Test Tag';
const PROPERTY_FIXTURE_NAME = 'automation-level';
const READ_TABLE_PAGE_SIZE = 150;

interface ReadTableColumn {
  name: string;
  propertyId: string;
  type: string;
}

interface ReadTableRow {
  name: string;
  remId: string;
  values: Record<string, string>;
}

interface ReadTableResponse {
  columns: ReadTableColumn[];
  rows: ReadTableRow[];
  tableId: string;
  tableName: string;
  totalRows: number;
  rowsReturned: number;
}

function normalizeTitle(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

function makePropertyValue(runId: string): string {
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  return `cli-set-property-${runId}-${randomSuffix}`;
}

function getExactTitleMatches(
  results: Array<Record<string, unknown>>,
  title: string
): Array<Record<string, unknown>> {
  const expectedTitle = normalizeTitle(title);
  return results.filter(
    (item) =>
      typeof item.remId === 'string' &&
      typeof item.title === 'string' &&
      normalizeTitle(item.title) === expectedTitle
  );
}

function findColumn(table: ReadTableResponse, propertyName: string): ReadTableColumn | undefined {
  const expectedName = normalizeTitle(propertyName);
  return table.columns.find((column) => normalizeTitle(column.name) === expectedName);
}

async function findVerifiedPropertyRow(
  ctx: WorkflowContext,
  tableRemId: string,
  propertyName: string,
  propertyRemId: string,
  targetRemId: string,
  expectedValue: string
): Promise<void> {
  let offset = 0;
  let totalRows: number | undefined;

  do {
    const page = (await ctx.cli.runExpectSuccess([
      'read-table',
      '--rem-id',
      tableRemId,
      '--properties',
      propertyName,
      '--limit',
      String(READ_TABLE_PAGE_SIZE),
      '--offset',
      String(offset),
    ])) as ReadTableResponse;

    assertEqual(page.tableId, tableRemId, 'verification tableId');
    assertEqual(page.columns.length, 1, 'verification should return one filtered column');
    assertEqual(page.columns[0].propertyId, propertyRemId, 'verification propertyId');
    assertIsArray(page.rows, 'verification rows');

    const row = page.rows.find((candidate) => candidate.remId === targetRemId);
    if (row) {
      assertEqual(row.values[propertyRemId], expectedValue, 'property value readback');
      return;
    }

    totalRows = page.totalRows;
    offset += page.rowsReturned;
  } while (totalRows !== undefined && offset < totalRows && offset > 0);

  throw new Error(
    `Could not find row ${targetRemId} with ${propertyName}=${JSON.stringify(expectedValue)}`
  );
}

export async function setPropertyWorkflow(
  ctx: WorkflowContext,
  state: SharedState
): Promise<WorkflowResult> {
  const steps: StepResult[] = [];

  if (!state.noteAId) {
    return {
      name: 'Set Property',
      steps: [
        {
          label: 'Skipped — simple note not initialized',
          passed: false,
          durationMs: 0,
          error: 'No noteAId in shared state',
        },
      ],
      skipped: true,
    };
  }

  const targetRemId = state.noteAId;
  let propertyFixtureTagRemId: string | undefined;
  let automationLevelPropertyRemId: string | undefined;
  let automationLevelValue: string | undefined;
  let automationLevelRenderedValue: string | undefined;

  // Step 1: Resolve the property-bearing test tag by exact title.
  {
    const start = Date.now();
    try {
      const result = (await ctx.cli.runExpectSuccess([
        'search',
        PROPERTY_FIXTURE_TAG_TITLE,
        '--limit',
        '150',
        '--content-mode',
        'none',
      ])) as Record<string, unknown>;

      assertHasField(result, 'results', 'property fixture tag search');
      assertIsArray(result.results, 'property fixture tag search results');
      const exactMatches = getExactTitleMatches(
        result.results as Array<Record<string, unknown>>,
        PROPERTY_FIXTURE_TAG_TITLE
      );

      if (exactMatches.length === 0) {
        return {
          name: 'Set Property',
          steps: [
            {
              label: `Skipped — fixture tag "${PROPERTY_FIXTURE_TAG_TITLE}" not found`,
              passed: true,
              durationMs: Date.now() - start,
            },
          ],
          skipped: true,
        };
      }

      if (exactMatches.length > 1) {
        const duplicateIds = exactMatches.map((item) => item.remId).join(', ');
        throw new Error(
          `Duplicate property fixture tags found for "${PROPERTY_FIXTURE_TAG_TITLE}": ${duplicateIds}`
        );
      }

      propertyFixtureTagRemId = exactMatches[0].remId as string;
      steps.push({
        label: `Resolve property fixture tag (${propertyFixtureTagRemId})`,
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: 'Resolve property fixture tag',
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
      return { name: 'Set Property', steps, skipped: false };
    }
  }

  // Step 2: Resolve the automation-level property ID from the tag/table schema.
  {
    const start = Date.now();
    try {
      assertTruthy(propertyFixtureTagRemId, 'property fixture tag remId');
      const table = (await ctx.cli.runExpectSuccess([
        'read-table',
        '--rem-id',
        propertyFixtureTagRemId,
        '--limit',
        '1',
      ])) as ReadTableResponse;

      assertEqual(table.tableId, propertyFixtureTagRemId, 'property fixture tableId');
      assertIsArray(table.columns, 'property fixture columns');
      const column = findColumn(table, PROPERTY_FIXTURE_NAME);

      if (!column) {
        return {
          name: 'Set Property',
          steps: [
            ...steps,
            {
              label: `Skipped — fixture property "${PROPERTY_FIXTURE_NAME}" not found`,
              passed: true,
              durationMs: Date.now() - start,
            },
          ],
          skipped: true,
        };
      }

      automationLevelPropertyRemId = column.propertyId;
      steps.push({
        label: `Resolve ${PROPERTY_FIXTURE_NAME} property (${automationLevelPropertyRemId})`,
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: `Resolve ${PROPERTY_FIXTURE_NAME} property`,
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
      return { name: 'Set Property', steps, skipped: false };
    }
  }

  // Step 3: Set a unique text property value on the test note.
  {
    const start = Date.now();
    try {
      assertTruthy(propertyFixtureTagRemId, 'property fixture tag remId');
      assertTruthy(automationLevelPropertyRemId, 'automation-level property remId');
      assertTruthy(
        typeof state.integrationParentRemId === 'string',
        'property exact reference target remId'
      );
      assertTruthy(
        typeof state.integrationParentTitle === 'string',
        'property exact reference target title'
      );
      const propertyValuePrefix = makePropertyValue(ctx.runId);
      automationLevelValue = `${propertyValuePrefix} [[id:${state.integrationParentRemId}]]`;
      automationLevelRenderedValue = `${propertyValuePrefix} [[${state.integrationParentTitle}]]`;

      const result = (await ctx.cli.runExpectSuccess([
        'set-property',
        targetRemId,
        '--tag-id',
        propertyFixtureTagRemId,
        '--property-id',
        automationLevelPropertyRemId,
        '--value',
        automationLevelValue,
      ])) as Record<string, unknown>;

      assertEqual(result.remId, targetRemId, 'set-property remId');
      assertEqual(result.tagRemId, propertyFixtureTagRemId, 'set-property tagRemId');
      assertEqual(result.propertyRemId, automationLevelPropertyRemId, 'set-property propertyRemId');
      assertEqual(result.valueKind, 'text', 'set-property valueKind');

      steps.push({
        label: `Set ${PROPERTY_FIXTURE_NAME}=${automationLevelValue}`,
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: `Set ${PROPERTY_FIXTURE_NAME}`,
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
      return { name: 'Set Property', steps, skipped: false };
    }
  }

  // Step 4: Verify the value through the tag/table read surface and keep it for manual inspection.
  {
    const start = Date.now();
    try {
      assertTruthy(propertyFixtureTagRemId, 'property fixture tag remId');
      assertTruthy(automationLevelPropertyRemId, 'automation-level property remId');
      assertTruthy(automationLevelValue, 'automation-level value');
      assertTruthy(automationLevelRenderedValue, 'automation-level rendered value');

      await findVerifiedPropertyRow(
        ctx,
        propertyFixtureTagRemId,
        PROPERTY_FIXTURE_NAME,
        automationLevelPropertyRemId,
        targetRemId,
        automationLevelRenderedValue
      );

      steps.push({
        label: `Verify kept ${PROPERTY_FIXTURE_NAME} exact reference value via read-table`,
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (e) {
      steps.push({
        label: `Verify ${PROPERTY_FIXTURE_NAME} value via read-table`,
        passed: false,
        durationMs: Date.now() - start,
        error: (e as Error).message,
      });
    }
  }

  return { name: 'Set Property', steps, skipped: false };
}
