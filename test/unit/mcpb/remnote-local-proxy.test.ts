import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_MCP_URL,
  FALLBACK_TOOLS,
  RemNoteLocalProxy,
  normalizeMcpUrl,
} from '../../../mcpb/remnote-local/server/index.js';

describe('RemNoteLocalProxy', () => {
  it('normalizes MCP URLs to the /mcp endpoint', () => {
    expect(normalizeMcpUrl('http://127.0.0.1:3001')).toBe(DEFAULT_MCP_URL);
    expect(normalizeMcpUrl('http://127.0.0.1:3001/')).toBe(DEFAULT_MCP_URL);
    expect(normalizeMcpUrl(DEFAULT_MCP_URL)).toBe(DEFAULT_MCP_URL);
    expect(normalizeMcpUrl('')).toBe(DEFAULT_MCP_URL);
  });

  it('forwards tools/list to the configured local HTTP MCP server', async () => {
    const remoteTools = { tools: [{ name: 'remote_tool', inputSchema: { type: 'object' } }] };
    const { createClient, client, transport } = createMockClient({ listToolsResult: remoteTools });
    const proxy = new RemNoteLocalProxy({
      mcpUrl: 'http://localhost:4000',
      createClient,
    });

    await expect(proxy.listTools()).resolves.toEqual(remoteTools);

    expect(createClient).toHaveBeenCalledWith('http://localhost:4000/mcp', {
      name: 'remnote-local-mcpb',
      version: '0.14.0',
    });
    expect(client.connect).toHaveBeenCalledWith(transport);
    expect(client.listTools).toHaveBeenCalled();
    expect(transport.terminateSession).toHaveBeenCalled();
    expect(client.close).toHaveBeenCalled();
  });

  it('returns fallback tools when the local HTTP MCP server is unavailable during tools/list', async () => {
    const { createClient } = createMockClient({ connectError: new Error('fetch failed') });
    const proxy = new RemNoteLocalProxy({ createClient });

    await expect(proxy.listTools()).resolves.toEqual({ tools: FALLBACK_TOOLS });
  });

  it('forwards tool calls and preserves the remote MCP result', async () => {
    const callToolResult = {
      structuredContent: { connected: true, serverVersion: '0.14.0' },
      content: [{ type: 'text', text: '{"connected":true,"serverVersion":"0.14.0"}' }],
    };
    const { createClient, client } = createMockClient({ callToolResult });
    const proxy = new RemNoteLocalProxy({ createClient });

    await expect(proxy.callTool({ name: 'remnote_status', arguments: {} })).resolves.toEqual(
      callToolResult
    );
    expect(client.callTool).toHaveBeenCalledWith({ name: 'remnote_status', arguments: {} });
  });

  it('returns a clear MCP tool error when a tool call cannot reach the local server', async () => {
    const { createClient } = createMockClient({ connectError: new Error('ECONNREFUSED') });
    const proxy = new RemNoteLocalProxy({ mcpUrl: 'http://localhost:3001/mcp', createClient });

    await expect(proxy.callTool({ name: 'remnote_status', arguments: {} })).resolves.toEqual({
      isError: true,
      content: [
        {
          type: 'text',
          text: expect.stringContaining(
            'Cannot connect to local RemNote MCP Server at http://localhost:3001/mcp.'
          ),
        },
      ],
    });
  });
});

function createMockClient({
  connectError,
  listToolsResult = { tools: [] },
  callToolResult = { content: [{ type: 'text', text: '{}' }] },
}: {
  connectError?: Error;
  listToolsResult?: unknown;
  callToolResult?: unknown;
}) {
  const client = {
    connect: vi.fn().mockImplementation(async () => {
      if (connectError) {
        throw connectError;
      }
    }),
    listTools: vi.fn().mockResolvedValue(listToolsResult),
    callTool: vi.fn().mockResolvedValue(callToolResult),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const transport = {
    terminateSession: vi.fn().mockResolvedValue(undefined),
  };
  const createClient = vi.fn().mockReturnValue({ client, transport });

  return { createClient, client, transport };
}
