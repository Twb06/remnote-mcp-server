#!/usr/bin/env node

import process from 'node:process';
import { URL, pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

export const DEFAULT_MCP_URL = 'http://127.0.0.1:3001/mcp';
export const SERVER_INFO = { name: 'remnote-local-mcpb', version: '0.14.1' };

export const FALLBACK_TOOLS = [
  {
    name: 'remnote_create_note',
    description:
      'Create a new note in RemNote with optional content, parent, and tags. Supports hierarchical markdown in content and flashcard syntax.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'The title of the note' },
        content: { type: 'string', description: 'Content as plain text or hierarchical markdown' },
        parentId: { type: 'string', description: 'Parent Rem ID' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags to apply' },
      },
    },
  },
  {
    name: 'remnote_search',
    description: 'Search the RemNote knowledge base.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query text' },
        limit: { type: 'number', description: 'Maximum results' },
        includeContent: { type: 'string', enum: ['none', 'markdown', 'structured'] },
        depth: { type: 'number', description: 'Depth of child hierarchy to render' },
        childLimit: { type: 'number', description: 'Maximum children per level' },
        maxContentLength: { type: 'number', description: 'Maximum rendered content length' },
      },
      required: ['query'],
    },
  },
  {
    name: 'remnote_search_by_tag',
    description: 'Find notes by tag.',
    inputSchema: {
      type: 'object',
      properties: {
        tag: { type: 'string', description: 'Tag name to search' },
        limit: { type: 'number', description: 'Maximum results' },
        includeContent: { type: 'string', enum: ['none', 'markdown', 'structured'] },
        depth: { type: 'number', description: 'Depth of child hierarchy to render' },
        childLimit: { type: 'number', description: 'Maximum children per level' },
        maxContentLength: { type: 'number', description: 'Maximum rendered content length' },
      },
      required: ['tag'],
    },
  },
  {
    name: 'remnote_read_note',
    description: 'Read a specific note from RemNote by its Rem ID.',
    inputSchema: {
      type: 'object',
      properties: {
        remId: { type: 'string', description: 'The Rem ID to read' },
        depth: { type: 'number', description: 'Depth of child hierarchy to render' },
        includeContent: { type: 'string', enum: ['none', 'markdown', 'structured'] },
        childLimit: { type: 'number', description: 'Maximum children per level' },
        maxContentLength: { type: 'number', description: 'Maximum rendered content length' },
      },
      required: ['remId'],
    },
  },
  {
    name: 'remnote_update_note',
    description: 'Update an existing note in RemNote.',
    inputSchema: {
      type: 'object',
      properties: {
        remId: { type: 'string', description: 'The Rem ID to update' },
        title: { type: 'string', description: 'New title' },
        appendContent: { type: 'string', description: 'Content to append as children' },
        replaceContent: { type: 'string', description: 'Content to replace direct children' },
        addTags: { type: 'array', items: { type: 'string' }, description: 'Tags to add' },
        removeTags: { type: 'array', items: { type: 'string' }, description: 'Tags to remove' },
      },
      required: ['remId'],
    },
  },
  {
    name: 'remnote_append_journal',
    description: "Append content to today's daily document in RemNote.",
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: "Content to append to today's daily document" },
        timestamp: { type: 'boolean', description: 'Include timestamp' },
      },
      required: ['content'],
    },
  },
  {
    name: 'remnote_read_table',
    description: 'Read an Advanced Table from RemNote by exact title or Rem ID.',
    inputSchema: {
      type: 'object',
      properties: {
        tableRemId: { type: 'string', description: 'Table Rem ID' },
        tableTitle: { type: 'string', description: 'Exact Advanced Table title' },
        limit: { type: 'number', description: 'Maximum rows to return' },
        offset: { type: 'number', description: '0-based row offset for pagination' },
        propertyFilter: {
          type: 'array',
          items: { type: 'string' },
          description: 'Only return these property/column names',
        },
      },
    },
  },
  {
    name: 'remnote_get_playbook',
    description: 'Get an operations playbook for MCP agents.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'remnote_status',
    description:
      'Check bridge connection health, compatibility warnings, and write-policy capabilities.',
    inputSchema: { type: 'object', properties: {} },
  },
];

export function normalizeMcpUrl(value) {
  const trimmed = String(value || DEFAULT_MCP_URL).trim();
  if (trimmed.endsWith('/mcp')) {
    return trimmed;
  }
  return `${trimmed.replace(/\/+$/, '')}/mcp`;
}

export function createSdkHttpClient(mcpUrl, clientInfo = SERVER_INFO) {
  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));
  const client = new Client(clientInfo);
  return { client, transport };
}

export class RemNoteLocalProxy {
  constructor(options = {}) {
    this.mcpUrl = normalizeMcpUrl(options.mcpUrl ?? process.env.REMNOTE_MCP_URL);
    this.createClient = options.createClient ?? createSdkHttpClient;
  }

  async listTools() {
    try {
      return await this.withClient((client) => client.listTools());
    } catch {
      return { tools: FALLBACK_TOOLS };
    }
  }

  async callTool(params) {
    try {
      return await this.withClient((client) => client.callTool(params));
    } catch (error) {
      return {
        isError: true,
        content: [{ type: 'text', text: this.formatConnectionError(error) }],
      };
    }
  }

  registerHandlers(server) {
    server.setRequestHandler(ListToolsRequestSchema, async () => this.listTools());
    server.setRequestHandler(CallToolRequestSchema, async (request) =>
      this.callTool({
        name: request.params.name,
        arguments: request.params.arguments ?? {},
      })
    );
  }

  async withClient(operation) {
    const { client, transport } = this.createClient(this.mcpUrl, SERVER_INFO);

    try {
      await client.connect(transport);
      return await operation(client);
    } finally {
      await closeBestEffort(transport, client);
    }
  }

  formatConnectionError(error) {
    const detail = error instanceof Error ? error.message : String(error);
    return [
      `Cannot connect to local RemNote MCP Server at ${this.mcpUrl}.`,
      'Start remnote-mcp-server, open RemNote, and ensure the Automation Bridge plugin is connected.',
      `Details: ${detail}`,
    ].join(' ');
  }
}

export function createStdioServer(options = {}) {
  const server = new Server(SERVER_INFO, { capabilities: { tools: {} } });
  const proxy = new RemNoteLocalProxy(options);
  proxy.registerHandlers(server);
  return server;
}

export async function run() {
  const server = createStdioServer();
  await server.connect(new StdioServerTransport());
}

async function closeBestEffort(transport, client) {
  try {
    if (typeof transport.terminateSession === 'function') {
      await transport.terminateSession();
    }
  } catch {
    // Best-effort cleanup: the proxy process can continue serving future calls.
  }

  try {
    await client.close();
  } catch {
    // Best-effort cleanup: failed closes should not mask the original operation result.
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
