import { Command } from 'commander';
import { createCommandClient } from '../client/command-client.js';
import { formatResult, formatError, type OutputFormat } from '../output/formatter.js';
import { EXIT } from '../config.js';

/** Default number of search results. */
const DEFAULT_SEARCH_LIMIT = 50;

/** Compact type prefixes for text output (empty for plain text Rems). */
const TYPE_TAG: Record<string, string> = {
  document: '[doc] ',
  dailyDocument: '[daily] ',
  concept: '[concept] ',
  descriptor: '[desc] ',
  portal: '[portal] ',
};

function formatTags(tags: unknown): string {
  if (!Array.isArray(tags)) return '';
  return tags
    .map((tag) => {
      if (
        tag &&
        typeof tag === 'object' &&
        typeof (tag as Record<string, unknown>).name === 'string' &&
        typeof (tag as Record<string, unknown>).tagRemId === 'string'
      ) {
        const { name, tagRemId } = tag as { name: string; tagRemId: string };
        return `${name} [${tagRemId}]`;
      }
      return typeof tag === 'string' ? tag : '';
    })
    .filter(Boolean)
    .join(', ');
}

function applySearchOptions(payload: Record<string, unknown>, opts: Record<string, unknown>): void {
  if (opts.includeContent) payload.includeContent = opts.includeContent;
  if (opts.depth) payload.depth = parseInt(opts.depth as string, 10);
  if (opts.childLimit) payload.childLimit = parseInt(opts.childLimit as string, 10);
  if (opts.maxContentLength)
    payload.maxContentLength = parseInt(opts.maxContentLength as string, 10);
}

function formatSearchText(data: unknown): string {
  const r = data as { results?: Array<Record<string, unknown>> };
  if (!r.results || r.results.length === 0) return 'No results found.';

  const lines = r.results
    .map((note, i) => {
      const typeTag = TYPE_TAG[note.remType as string] ?? '';
      const headline = (note.headline as string) || (note.title as string) || '(untitled)';
      let aliasesSuffix = '';
      if (note.aliases && Array.isArray(note.aliases) && note.aliases.length > 0) {
        aliasesSuffix = ` (aka: ${(note.aliases as string[]).join(', ')})`;
      }
      let tagsSuffix = '';
      const formattedTags = formatTags(note.tags);
      if (formattedTags) {
        tagsSuffix = ` [tags: ${formattedTags}]`;
      }
      let parentSuffix = '';
      if (typeof note.parentTitle === 'string' && note.parentTitle.length > 0) {
        const parentIdSuffix = typeof note.parentRemId === 'string' ? ` [${note.parentRemId}]` : '';
        parentSuffix = ` <- ${note.parentTitle}${parentIdSuffix}`;
      }
      return `${i + 1}. ${typeTag}${headline}${aliasesSuffix}${tagsSuffix}${parentSuffix} [${note.remId}]`;
    })
    .join('\n');

  const pagingLines: string[] = [];
  if (
    typeof (r as Record<string, unknown>).nextCursor === 'string' &&
    (r as Record<string, unknown>).hasMore === true
  ) {
    pagingLines.push(`Next cursor: ${(r as Record<string, unknown>).nextCursor as string}`);
  }
  if ((r as Record<string, unknown>).truncated === true) {
    const reason = (r as Record<string, unknown>).truncationReason;
    pagingLines.push(`Results truncated${typeof reason === 'string' ? `: ${reason}` : ''}`);
  }

  return pagingLines.length > 0 ? `${lines}\n${pagingLines.join('\n')}` : lines;
}

function registerCommonSearchOptions(command: Command): Command {
  return command
    .option(
      '-l, --limit <n>',
      `Maximum results (default: ${DEFAULT_SEARCH_LIMIT})`,
      String(DEFAULT_SEARCH_LIMIT)
    )
    .option(
      '--include-content <mode>',
      'Content rendering mode: "none" (default), "markdown", or "structured"'
    )
    .option('--depth <n>', 'Depth of child hierarchy to render (default: 1)')
    .option('--child-limit <n>', 'Maximum children per level (default: 20)')
    .option('--max-content-length <n>', 'Maximum content character length (default: 3000)');
}

export function registerSearchCommand(program: Command): void {
  registerCommonSearchOptions(
    program.command('search <query>').description('Search for notes in RemNote')
  )
    .option('--cursor <cursor>', 'Opaque cursor returned by a previous search page')
    .action(async (query: string, opts) => {
      const globalOpts = program.opts();
      const format: OutputFormat = globalOpts.text ? 'text' : 'json';
      const client = createCommandClient(program);

      try {
        const payload: Record<string, unknown> = {
          query,
          limit: parseInt(opts.limit, 10),
        };
        if (opts.cursor) payload.cursor = opts.cursor;
        applySearchOptions(payload, opts);

        const result = await client.execute('search', payload);
        console.log(formatResult(result, format, (data) => formatSearchText(data)));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(formatError(message, format));
        process.exit(EXIT.ERROR);
      } finally {
        await client.close();
      }
    });
}

export function registerSearchByTagCommand(program: Command): void {
  registerCommonSearchOptions(
    program
      .command('search-by-tag')
      .description('Search notes by exact tag Rem ID with ancestor-context resolution')
      .requiredOption('--tag-id <tagRemId>', 'Exact tag Rem ID to search')
      .option(
        '--result-mode <mode>',
        'Result mode: "context" returns ancestor context targets, "tagged" returns direct tagged Rems'
      )
  ).action(async (opts) => {
    const globalOpts = program.opts();
    const format: OutputFormat = globalOpts.text ? 'text' : 'json';
    const client = createCommandClient(program);

    try {
      const payload: Record<string, unknown> = {
        tagRemId: opts.tagId,
        limit: parseInt(opts.limit, 10),
      };
      if (opts.resultMode) payload.resultMode = opts.resultMode;
      applySearchOptions(payload, opts);

      const result = await client.execute('search_by_tag', payload);
      console.log(formatResult(result, format, (data) => formatSearchText(data)));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(formatError(message, format));
      process.exit(EXIT.ERROR);
    } finally {
      await client.close();
    }
  });
}
