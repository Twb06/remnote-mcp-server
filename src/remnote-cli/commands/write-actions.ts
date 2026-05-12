import { Command } from 'commander';
import { createCommandClient } from '../client/command-client.js';
import { formatResult, formatError, type OutputFormat } from '../output/formatter.js';
import { EXIT } from '../config.js';
import { resolveOptionalInlineOrFileContent } from './content-input.js';
import { validateNotFlag } from './arg-utils.js';

type InsertPosition = 'first' | 'last' | 'before' | 'after';

function formatRemResult(data: unknown, emptyMessage: string): string {
  const r = data as { remIds?: string[]; titles?: string[] };
  const ids = r.remIds || [];
  const titles = r.titles || [];
  if (ids.length === 0) return emptyMessage;
  return ids.map((id, i) => `Updated/Created: ${titles[i] || '(untitled)'} (ID: ${id})`).join('\n');
}

async function resolveRequiredContent(options: {
  content: string | undefined;
  contentFile: string | undefined;
}): Promise<string> {
  const content = await resolveOptionalInlineOrFileContent({
    inlineText: options.content,
    filePath: options.contentFile,
    inlineFlag: '--content',
    fileFlag: '--content-file',
  });

  if (content === undefined) {
    throw new Error(
      'Provide exactly one content source: --content <text> or --content-file <path|->'
    );
  }

  return content;
}

export function registerInsertChildrenCommand(program: Command): void {
  const subprogram = program.command('insert-children <parent-rem-id>');
  const validate = (val: string) => validateNotFlag(val, subprogram);

  subprogram
    .description('Insert child Rems under a parent at a deterministic position')
    .option('--content <text>', 'Content to insert', validate)
    .option(
      '--content-file <path>',
      'Read inserted content from UTF-8 file ("-" for stdin)',
      validate
    )
    .requiredOption(
      '--position <position>',
      'Insert position: first, last, before, or after',
      validate
    )
    .option('--sibling-rem-id <id>', 'Sibling Rem ID for before/after positions', validate)
    .action(async (parentRemId: string, opts) => {
      const globalOpts = program.opts();
      const format: OutputFormat = globalOpts.text ? 'text' : 'json';
      const client = createCommandClient(program);

      try {
        const content = await resolveRequiredContent({
          content: opts.content as string | undefined,
          contentFile: opts.contentFile as string | undefined,
        });
        const position = opts.position as InsertPosition;

        const payload: Record<string, unknown> = {
          parentRemId,
          content,
          position,
        };
        if (opts.siblingRemId) payload.siblingRemId = opts.siblingRemId;

        const result = await client.execute('insert_children', payload);
        console.log(
          formatResult(result, format, (data) =>
            formatRemResult(data, `Inserted children under ${parentRemId}`)
          )
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(formatError(message, format));
        process.exit(EXIT.ERROR);
      } finally {
        await client.close();
      }
    });
}

export function registerReplaceChildrenCommand(program: Command): void {
  const subprogram = program.command('replace-children <parent-rem-id>');
  const validate = (val: string) => validateNotFlag(val, subprogram);

  subprogram
    .description('Replace all direct child Rems under a parent')
    .option('--content <text>', 'Replacement content', validate)
    .option(
      '--content-file <path>',
      'Read replacement content from UTF-8 file ("-" for stdin; empty file clears children)',
      validate
    )
    .action(async (parentRemId: string, opts) => {
      const globalOpts = program.opts();
      const format: OutputFormat = globalOpts.text ? 'text' : 'json';
      const client = createCommandClient(program);

      try {
        const content = await resolveRequiredContent({
          content: opts.content as string | undefined,
          contentFile: opts.contentFile as string | undefined,
        });

        const result = await client.execute('replace_children', { parentRemId, content });
        console.log(
          formatResult(result, format, (data) =>
            formatRemResult(data, `Replaced children under ${parentRemId}`)
          )
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(formatError(message, format));
        process.exit(EXIT.ERROR);
      } finally {
        await client.close();
      }
    });
}

export function registerUpdateTagsCommand(program: Command): void {
  const subprogram = program.command('update-tags <rem-id>');

  subprogram
    .description('Add or remove tags by exact tag Rem ID')
    .option('--add-tag-ids <tag-rem-ids...>', 'Exact tag Rem IDs to add')
    .option('--remove-tag-ids <tag-rem-ids...>', 'Exact tag Rem IDs to remove')
    .action(async (remId: string, opts) => {
      const globalOpts = program.opts();
      const format: OutputFormat = globalOpts.text ? 'text' : 'json';
      const client = createCommandClient(program);

      try {
        const payload: Record<string, unknown> = { remId };
        if (opts.addTagIds?.length) payload.addTagRemIds = opts.addTagIds;
        if (opts.removeTagIds?.length) payload.removeTagRemIds = opts.removeTagIds;

        const result = await client.execute('update_tags', payload);
        console.log(
          formatResult(result, format, (data) => formatRemResult(data, `Updated tags on ${remId}`))
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(formatError(message, format));
        process.exit(EXIT.ERROR);
      } finally {
        await client.close();
      }
    });
}
