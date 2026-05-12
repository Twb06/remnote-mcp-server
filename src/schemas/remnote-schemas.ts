import { z } from 'zod';

export const CreateNoteSchema = z
  .object({
    title: z.string().optional().describe('The title of the note'),
    content: z.string().optional().describe('Content as child bullets (markdown supported)'),
    parentId: z.string().optional().describe('Parent Rem ID'),
    tags: z.array(z.string()).optional().describe('Tags to apply'),
  })
  .refine((value) => value.title !== undefined || value.content !== undefined, {
    message: 'create_note requires either title or content',
  });

export const SearchSchema = z.object({
  query: z.string().describe('Search query text'),
  limit: z.number().int().min(1).max(150).default(50).describe('Maximum results'),
  includeContent: z
    .enum(['none', 'markdown', 'structured'])
    .default('none')
    .describe(
      'Content rendering mode: "none" omits content, "markdown" renders child subtree, "structured" returns nested child objects with remIds'
    ),
  depth: z
    .number()
    .int()
    .min(0)
    .max(10)
    .default(1)
    .describe('Depth of child hierarchy to render (when includeContent is markdown or structured)'),
  childLimit: z
    .number()
    .int()
    .min(1)
    .max(500)
    .default(20)
    .describe('Maximum children per level in rendered content'),
  maxContentLength: z
    .number()
    .int()
    .min(100)
    .max(200000)
    .default(3000)
    .describe('Maximum character length for rendered content'),
});

export const SearchByTagSchema = z.object({
  tag: z.string().min(1).describe('Tag name to search (with or without # prefix)'),
  limit: z.number().int().min(1).max(150).default(50).describe('Maximum results'),
  includeContent: z
    .enum(['none', 'markdown', 'structured'])
    .default('none')
    .describe(
      'Content rendering mode: "none" omits content, "markdown" renders child subtree, "structured" returns nested child objects with remIds'
    ),
  depth: z
    .number()
    .int()
    .min(0)
    .max(10)
    .default(1)
    .describe('Depth of child hierarchy to render (when includeContent is markdown or structured)'),
  childLimit: z
    .number()
    .int()
    .min(1)
    .max(500)
    .default(20)
    .describe('Maximum children per level in rendered content'),
  maxContentLength: z
    .number()
    .int()
    .min(100)
    .max(200000)
    .default(3000)
    .describe('Maximum character length for rendered content'),
});

export const ReadNoteSchema = z.object({
  remId: z.string().describe('The Rem ID to read'),
  depth: z.number().int().min(0).max(10).default(5).describe('Depth of child hierarchy to render'),
  includeContent: z
    .enum(['none', 'markdown', 'structured'])
    .default('markdown')
    .describe(
      'Content rendering mode: "none" omits content, "markdown" renders child subtree, "structured" returns nested child objects with remIds'
    ),
  childLimit: z
    .number()
    .int()
    .min(1)
    .max(500)
    .default(100)
    .describe('Maximum children per level in rendered content'),
  maxContentLength: z
    .number()
    .int()
    .min(100)
    .max(200000)
    .default(100000)
    .describe('Maximum character length for rendered content'),
});

export const InsertChildrenPositionSchema = z.enum(['first', 'last', 'before', 'after']);

export const UpdateNoteSchema = z
  .object({
    remId: z.string().describe('The Rem ID to update'),
    title: z.string().optional().describe('New title'),
  })
  .strict()
  .refine((value) => value.title !== undefined, {
    message: 'remnote_update_note requires title',
    path: ['title'],
  });

export const InsertChildrenSchema = z
  .object({
    parentRemId: z.string().describe('Parent Rem ID that will receive the new children'),
    content: z.string().describe('Markdown content to insert as child Rems'),
    position: InsertChildrenPositionSchema.describe('Where to insert the new child Rems'),
    siblingRemId: z.string().optional().describe('Sibling Rem ID required for before/after'),
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((value.position === 'before' || value.position === 'after') && !value.siblingRemId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `siblingRemId is required when position is ${value.position}`,
        path: ['siblingRemId'],
      });
    }
    if ((value.position === 'first' || value.position === 'last') && value.siblingRemId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `siblingRemId must not be provided when position is ${value.position}`,
        path: ['siblingRemId'],
      });
    }
  });

export const ReplaceChildrenSchema = z
  .object({
    parentRemId: z.string().describe('Parent Rem ID whose direct children will be replaced'),
    content: z.string().describe('Markdown content to use as replacement children'),
  })
  .strict();

export const UpdateTagsSchema = z
  .object({
    remId: z.string().describe('The Rem ID whose tags should change'),
    addTagRemIds: z.array(z.string()).optional().describe('Exact tag Rem IDs to add'),
    removeTagRemIds: z.array(z.string()).optional().describe('Exact tag Rem IDs to remove'),
  })
  .strict()
  .refine((value) => Boolean(value.addTagRemIds?.length || value.removeTagRemIds?.length), {
    message: 'remnote_update_tags requires addTagRemIds or removeTagRemIds',
    path: ['addTagRemIds'],
  });

export const AppendJournalSchema = z.object({
  content: z.string().describe("Content to append to today's daily document"),
  timestamp: z.boolean().default(true).describe('Include timestamp'),
});

export const ReadTableSchema = z
  .object({
    tableRemId: z.string().min(1).optional().describe('Table Rem ID'),
    tableTitle: z.string().min(1).optional().describe('Exact Advanced Table title'),
    limit: z.number().int().min(1).max(150).default(50).describe('Maximum rows to return'),
    offset: z.number().int().min(0).default(0).describe('0-based row offset for pagination'),
    propertyFilter: z.array(z.string()).optional().describe('Only return these property names'),
  })
  .superRefine((value, ctx) => {
    const provided = [value.tableRemId, value.tableTitle].filter(
      (entry) => typeof entry === 'string' && entry.length > 0
    );
    if (provided.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide exactly one of tableRemId or tableTitle',
      });
    }
  });
