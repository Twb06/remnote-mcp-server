import { describe, expect, it, vi } from 'vitest';
import {
  MEDIA_FIXTURE_TITLE,
  PROPERTY_FIXTURE_TITLE,
  resolvePersistentIntegrationFixtures,
  type PersistentFixtureReader,
} from '../helpers/integration-fixtures.js';

function makeReader(overrides: Partial<PersistentFixtureReader> = {}): PersistentFixtureReader {
  return {
    readTableByRemId: vi.fn().mockResolvedValue({
      tableId: 'tag-1',
      columns: [{ name: 'automation-level', propertyId: 'property-1', type: 'text' }],
    }),
    searchByTitle: vi.fn().mockImplementation((title: string) =>
      Promise.resolve({
        results: [
          title === PROPERTY_FIXTURE_TITLE
            ? { remId: 'tag-1', title: PROPERTY_FIXTURE_TITLE }
            : { remId: 'media-rem-1', title: MEDIA_FIXTURE_TITLE },
        ],
      })
    ),
    readNoteWithMedia: vi.fn().mockResolvedValue({
      media: [
        {
          mediaId: 'media-1',
          field: 'backText',
          source: 'remnote_managed_local',
        },
      ],
    }),
    ...overrides,
  };
}

describe('resolvePersistentIntegrationFixtures', () => {
  it('derives all fixture IDs and the media field from fixed titles', async () => {
    const reader = makeReader();

    await expect(resolvePersistentIntegrationFixtures(reader)).resolves.toEqual({
      tableRemId: 'tag-1',
      propertyRemId: 'property-1',
      mediaRemId: 'media-rem-1',
      mediaField: 'backText',
      mediaId: 'media-1',
    });
    expect(reader.readTableByRemId).toHaveBeenCalledWith('tag-1');
    expect(reader.searchByTitle).toHaveBeenCalledWith(PROPERTY_FIXTURE_TITLE);
    expect(reader.searchByTitle).toHaveBeenCalledWith(MEDIA_FIXTURE_TITLE);
    expect(reader.readNoteWithMedia).toHaveBeenCalledWith('media-rem-1');
  });

  it('rejects a property fixture without automation-level', async () => {
    const reader = makeReader({
      readTableByRemId: vi.fn().mockResolvedValue({ tableId: 'tag-1', columns: [] }),
    });

    await expect(resolvePersistentIntegrationFixtures(reader)).rejects.toThrow(
      'must have a text-compatible "automation-level" property'
    );
  });

  it('rejects a missing named media fixture', async () => {
    const reader = makeReader({
      searchByTitle: vi.fn().mockImplementation((title: string) =>
        Promise.resolve({
          results:
            title === PROPERTY_FIXTURE_TITLE
              ? [{ remId: 'tag-1', title: PROPERTY_FIXTURE_TITLE }]
              : [],
        })
      ),
    });

    await expect(resolvePersistentIntegrationFixtures(reader)).rejects.toThrow(
      `Required integration fixture "${MEDIA_FIXTURE_TITLE}" was not found`
    );
  });

  it('rejects duplicate exact media fixture titles', async () => {
    const reader = makeReader({
      searchByTitle: vi.fn().mockImplementation((title: string) =>
        Promise.resolve({
          results:
            title === PROPERTY_FIXTURE_TITLE
              ? [{ remId: 'tag-1', title: PROPERTY_FIXTURE_TITLE }]
              : [
                  { remId: 'media-rem-1', title: MEDIA_FIXTURE_TITLE },
                  { remId: 'media-rem-2', title: `  ${MEDIA_FIXTURE_TITLE.toUpperCase()}  ` },
                ],
        })
      ),
    });

    await expect(resolvePersistentIntegrationFixtures(reader)).rejects.toThrow(
      'media-rem-1, media-rem-2'
    );
  });

  it('rejects a media fixture without managed local image metadata', async () => {
    const reader = makeReader({
      readNoteWithMedia: vi.fn().mockResolvedValue({
        media: [{ mediaId: 'remote-1', field: 'text', source: 'remote' }],
      }),
    });

    await expect(resolvePersistentIntegrationFixtures(reader)).rejects.toThrow(
      'must contain at least one RemNote-managed local image'
    );
  });
});
