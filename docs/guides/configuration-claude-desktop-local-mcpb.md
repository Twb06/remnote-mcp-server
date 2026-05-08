# Claude Desktop Local MCPB Configuration

How to use RemNote MCP tools from Claude Desktop without exposing the local MCP server over public HTTPS.

> note available from version 0.4.1

## Overview

Claude Desktop can install local MCP Bundle (`.mcpb`) extensions. The RemNote local MCPB is a small stdio MCP proxy:

```text
Claude Desktop <-> MCPB stdio proxy <-> http://127.0.0.1:3001/mcp <-> remnote-mcp-server <-> RemNote bridge
```

This avoids ngrok or other public HTTPS tunnels for Claude Desktop. It does not apply to Claude Cowork or Anthropic's
remote custom connector flow, which still require a public HTTPS MCP URL.

## Prerequisites

- RemNote MCP Server installed and running locally
- RemNote app running with the Automation Bridge plugin installed and connected
- Claude Desktop with desktop extensions enabled
- `remnote-mcp-server` installed from npm

## Locate the Extension

Install the package:

```bash
npm install -g remnote-mcp-server
```

Print the bundled extension path:

```bash
remnote-mcp-server mcpb-path
```

Expected output is an absolute path ending in:

```text
mcpb/remnote-local/remnote-local.mcpb
```

The extension intentionally does not start `remnote-mcp-server`. Start the server separately in a terminal:

```bash
remnote-mcp-server
```

## Install in Claude Desktop

1. Open Claude Desktop.
2. Go to **Settings -> Extensions**.
3. Open **Advanced settings**.
4. Click **Install Extension...** and select the `.mcpb` file printed by `remnote-mcp-server mcpb-path`.
5. Keep the default MCP URL unless you changed the server port:

```text
http://127.0.0.1:3001/mcp
```

## Verify

Start a new Claude Desktop chat and run:

```text
Use remnote_status to check the connection
```

Expected: the response includes bridge connection information, server version, and plugin version.

If the tool reports that it cannot connect to the local RemNote MCP Server, verify:

1. `remnote-mcp-server` is running.
2. RemNote is open.
3. The Automation Bridge plugin is connected.
4. The configured MCP URL ends with `/mcp`.

## Related Documentation

- [Configuration Guide](configuration.md) - Local Streamable HTTP setup
- [Claude Desktop / Cowork Configuration](configuration-claude-desktop-cowork.md) - Remote HTTPS connector setup
- [Remote Access Setup](remote-access.md) - Required for Claude Cowork and cloud clients
