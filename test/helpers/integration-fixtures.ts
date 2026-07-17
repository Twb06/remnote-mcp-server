export const PROPERTY_FIXTURE_TITLE = 'Automation Bridge Test Tag';
export const PROPERTY_FIXTURE_NAME = 'automation-level';
export const MEDIA_FIXTURE_TITLE = 'Automation Bridge Test Media';

export interface PersistentIntegrationFixtures {
  property?: {
    tableRemId: string;
    propertyRemId: string;
  };
  media?: {
    mediaRemId: string;
    mediaField: 'text' | 'backText';
    mediaId: string;
  };
}

export interface PersistentFixtureIssue {
  fixture: 'property' | 'media';
  title: string;
  error: string;
}

export interface PersistentFixtureResolution {
  fixtures: PersistentIntegrationFixtures;
  issues: PersistentFixtureIssue[];
}

export interface PersistentFixtureReader {
  readTableByRemId(remId: string): Promise<unknown>;
  searchByTitle(title: string): Promise<unknown>;
  readNoteWithMedia(remId: string): Promise<unknown>;
}

function normalizeTitle(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} returned an invalid response`);
  }
  return value as Record<string, unknown>;
}

function resolveExactTitleRemId(value: unknown, title: string): string {
  const response = asRecord(value, `Search for fixture "${title}"`);
  const results = Array.isArray(response.results)
    ? (response.results as Array<Record<string, unknown>>)
    : [];
  const expected = normalizeTitle(title);
  const matches = results.filter(
    (item) =>
      typeof item.remId === 'string' &&
      typeof item.title === 'string' &&
      normalizeTitle(item.title) === expected
  );

  if (matches.length === 0) {
    throw new Error(
      `Required integration fixture "${title}" was not found. Create exactly one Rem with that title and rerun the suite.`
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `Duplicate integration fixtures found for "${title}": ${matches
        .map((item) => item.remId)
        .join(', ')}. Keep exactly one and rerun the suite.`
    );
  }
  return matches[0].remId as string;
}

async function resolvePropertyFixture(
  reader: PersistentFixtureReader
): Promise<NonNullable<PersistentIntegrationFixtures['property']>> {
  const tableRemId = resolveExactTitleRemId(
    await reader.searchByTitle(PROPERTY_FIXTURE_TITLE),
    PROPERTY_FIXTURE_TITLE
  );
  let tableValue: unknown;
  try {
    tableValue = await reader.readTableByRemId(tableRemId);
  } catch (error) {
    throw new Error(
      `Required integration fixture "${PROPERTY_FIXTURE_TITLE}" is missing or is not a property-bearing tag/table. Create it with a text-compatible "${PROPERTY_FIXTURE_NAME}" property and rerun the suite.`,
      { cause: error }
    );
  }

  const table = asRecord(tableValue, `Fixture "${PROPERTY_FIXTURE_TITLE}"`);
  if (typeof table.tableId !== 'string' || !Array.isArray(table.columns)) {
    throw new Error(`Fixture "${PROPERTY_FIXTURE_TITLE}" returned an invalid table response`);
  }
  if (table.tableId !== tableRemId) {
    throw new Error(`Fixture "${PROPERTY_FIXTURE_TITLE}" returned a mismatched table Rem ID`);
  }
  const expectedProperty = normalizeTitle(PROPERTY_FIXTURE_NAME);
  const property = (table.columns as Array<Record<string, unknown>>).find(
    (column) =>
      typeof column.name === 'string' &&
      typeof column.propertyId === 'string' &&
      normalizeTitle(column.name) === expectedProperty
  );
  if (!property) {
    throw new Error(
      `Fixture "${PROPERTY_FIXTURE_TITLE}" must have a text-compatible "${PROPERTY_FIXTURE_NAME}" property.`
    );
  }

  return {
    tableRemId,
    propertyRemId: property.propertyId as string,
  };
}

async function resolveMediaFixture(
  reader: PersistentFixtureReader
): Promise<NonNullable<PersistentIntegrationFixtures['media']>> {
  const mediaSearch = await reader.searchByTitle(MEDIA_FIXTURE_TITLE);
  const mediaRemId = resolveExactTitleRemId(mediaSearch, MEDIA_FIXTURE_TITLE);
  const mediaNote = asRecord(
    await reader.readNoteWithMedia(mediaRemId),
    `Fixture "${MEDIA_FIXTURE_TITLE}"`
  );
  const media = Array.isArray(mediaNote.media)
    ? (mediaNote.media as Array<Record<string, unknown>>)
    : [];
  const selected = media.find(
    (item) =>
      item.source === 'remnote_managed_local' &&
      (item.field === 'text' || item.field === 'backText') &&
      typeof item.mediaId === 'string'
  );
  if (!selected) {
    throw new Error(
      `Fixture "${MEDIA_FIXTURE_TITLE}" must contain at least one RemNote-managed local image in text or backText.`
    );
  }

  return {
    mediaRemId,
    mediaField: selected.field as 'text' | 'backText',
    mediaId: selected.mediaId as string,
  };
}

/** Resolve persistent fixtures independently so unrelated live workflows can continue. */
export async function resolvePersistentIntegrationFixtures(
  reader: PersistentFixtureReader
): Promise<PersistentFixtureResolution> {
  const fixtures: PersistentIntegrationFixtures = {};
  const issues: PersistentFixtureIssue[] = [];

  try {
    fixtures.property = await resolvePropertyFixture(reader);
  } catch (error) {
    issues.push({
      fixture: 'property',
      title: PROPERTY_FIXTURE_TITLE,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    fixtures.media = await resolveMediaFixture(reader);
  } catch (error) {
    issues.push({
      fixture: 'media',
      title: MEDIA_FIXTURE_TITLE,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return { fixtures, issues };
}
