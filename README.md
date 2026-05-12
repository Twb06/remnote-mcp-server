# RemNote MCP Server

![License](https://img.shields.io/badge/license-MIT-blue)
![CI](https://github.com/robert7/remnote-mcp-server/actions/workflows/ci.yml/badge.svg)
[![npm version](https://img.shields.io/npm/v/remnote-mcp-server)](https://www.npmjs.com/package/remnote-mcp-server)
[![codecov](https://codecov.io/gh/robert7/remnote-mcp-server/branch/main/graph/badge.svg)](https://codecov.io/gh/robert7/remnote-mcp-server)

MCP server and CLI package that bridges AI agents, local scripts, and coding harnesses to
[RemNote](https://remnote.com/) via the [RemNote Automation Bridge
plugin](https://github.com/robert7/remnote-mcp-bridge).

> If you run into any issues, please [report them here](https://github.com/robert7/remnote-mcp-server/issues).

> **Connection issue? Check the RemNote plugin first.** The RemNote Marketplace may show multiple similarly named
> `MCP Bridge` plugins. For this server, install the official **MCP/OpenClaw Automation Bridge** plugin by Robert
> Spiegel and keep it on the same `0.x` minor version line as `remnote-mcp-server` (for example `0.14.x` with
> `0.14.x`). Wrong plugin flavors or incompatible marketplace copies can connect briefly and then disconnect with a
> `1008` compatibility message. See the related upstream marketplace confusion report:
> [quentintou/remnote-mcp-bridge#8](https://github.com/quentintou/remnote-mcp-bridge/issues/8).

## What is This?

The RemNote MCP Server enables AI assistants like Claude Code to interact directly with your RemNote knowledge base
through the Model Context Protocol (MCP). The same npm package also provides `remnote-cli`, a command-line MCP client
for local scripts and coding harnesses, and `remnote-mcp-stdio`, a stdio MCP proxy for clients that cannot consume
Streamable HTTP directly. Create notes, hierarchical markdown trees, and RemNote-native flashcards; search and read
your knowledge base; update existing notes; and maintain your daily journal through MCP tools or shell commands.

## Demo

See AI agent examples in action with RemNote: **[View Demo →](docs/demo.md)**

### Two-Component Architecture

This system consists of **two separate runtime components** that work together:

1. **[RemNote Automation Bridge](https://github.com/robert7/remnote-mcp-bridge)** - A RemNote plugin that runs in your
   browser or RemNote desktop app and exposes RemNote API functionality via WebSocket
2. **RemNote MCP Server** (this project) - A standalone server package that provides `remnote-mcp-server` for MCP
   HTTP clients, `remnote-mcp-stdio` for stdio MCP clients, and `remnote-cli` for command-line workflows

The `remnote-cli` and `remnote-mcp-stdio` commands are not second RemNote-facing servers. They call the MCP endpoint
exposed by `remnote-mcp-server`.

For the detailed bridge connection lifecycle, retry phases, and wake-up triggers, use the bridge repo as the source of
truth: [Connection Lifecycle Guide](https://github.com/robert7/remnote-mcp-bridge/blob/main/docs/guides/connection-lifecycle.md).

### How It Works

```text
AI agents (HTTP) -> MCP HTTP Server :3001 -> WebSocket Server :3002 -> RemNote Plugin -> RemNote
AI agents (stdio) -> remnote-mcp-stdio -> MCP HTTP Server :3001 -> WebSocket Server :3002 -> RemNote Plugin -> RemNote
CLI commands -> remnote-cli -> MCP HTTP Server :3001 -> WebSocket Server :3002 -> RemNote Plugin -> RemNote
```

The server acts as a bridge:

- Communicates with AI agents via Streamable HTTP transport (MCP protocol) - supports both local and remote access
- Provides `remnote-mcp-stdio` as a local stdio MCP proxy for clients that need stdio transport
- Provides `remnote-cli` as a bundled command-line MCP client for local automation
- HTTP server (port 3001) manages MCP sessions for multiple concurrent agents
- WebSocket server (port 3002) connects to the RemNote browser plugin
- Translates MCP tool calls into RemNote API actions

**Multi-Agent Support:** Multiple AI agents can connect simultaneously to the same RemNote knowledge base. Each agent
gets its own MCP session while sharing the WebSocket bridge.

**Remote Access:** By default, the server binds to localhost (127.0.0.1) for local AI agents. Claude Desktop and Claude
Cowork can use the bundled local MCPB extension when desktop extensions are enabled. Cloud-based clients, web/mobile
surfaces, and managed Claude deployments without local MCPB require remote access—use tunneling tools like ngrok to
expose the HTTP endpoint securely. The WebSocket connection always stays local for security. See
[Remote Access Guide](docs/guides/remote-access.md) for setup.

## Features

- **Create Notes & Flashcards** - Create simple notes, hierarchical markdown trees, or RemNote-native flashcards
- **Search Knowledge Base** - Run full-text searches or tag-based searches with ancestor context
- **Read Notes** - Retrieve note content in markdown or structured form with configurable traversal depth
- **Update Notes** - Modify titles, append or replace hierarchical content, and manage tags
- **Journal Entries** - Append timestamped daily entries, including hierarchical markdown content
- **Agent Playbook** - Return built-in navigation and safety guidance for MCP clients
- **Connection Status** - Check server and plugin connection health

## Quick Start

### 1. Install the Server

> **Version compatibility (`0.x` semver):** install a `remnote-mcp-server` version compatible with your installed RemNote Automation Bridge plugin version. See the [Bridge / Consumer Version Compatibility Guide](https://github.com/robert7/remnote-mcp-bridge/blob/main/docs/guides/bridge-consumer-version-compatibility.md).

```bash
npm install -g remnote-mcp-server
```

The package installs these commands:

```bash
remnote-mcp-server --version
remnote-cli --version
remnote-mcp-stdio --version
```

### 2. Install the RemNote Plugin

Install the official [MCP/OpenClaw Automation Bridge plugin](https://github.com/robert7/remnote-mcp-bridge) in your
RemNote app. If installing from the RemNote Marketplace, verify the plugin name and author; similarly named
`MCP Bridge` variants may be incompatible with this server and cause connection loops or `1008` disconnects. Configure
the plugin to connect to `ws://127.0.0.1:3002`.

### 3. Start the Server

```bash
remnote-mcp-server
```

Expected output:

```text
RemNote MCP Server v<version> listening { wsPort: 3002, httpPort: 3001 }
```

Keep this terminal running.

For a background server that survives terminal close and writes to a stable log file:

```bash
remnote-mcp-server daemon start
remnote-mcp-server daemon status
remnote-mcp-server daemon logs
remnote-mcp-server daemon stop
```

Daemon state and logs default to `~/.remnote-mcp-server/`. On macOS, install a login LaunchAgent for restart/login
persistence:

```bash
remnote-mcp-server daemon install-launchd
```

After installing the LaunchAgent, `remnote-mcp-server daemon status|start|stop|restart` controls the launchd service.

### 4. Configure Your AI Client

- [Configuration Guide](docs/guides/configuration.md) - Overview and generic setup
  - [Codex TUI / Codex.app](docs/guides/configuration-codex.md) - HTTP MCP, stdio proxy, and `remnote-cli` skill setup
  - [Claude Desktop / Cowork Local MCPB](docs/guides/configuration-claude-desktop-local-mcpb.md) - Preferred local desktop setup, no public HTTPS required
  - [Claude Desktop / Cowork Remote Connector](docs/guides/configuration-claude-desktop-cowork.md) - Remote connector setup when local MCPB is not applicable
  - [Claude Code CLI](docs/guides/configuration-claude-code-CLI.md) - Claude Code local MCP setup
  - [ChatGPT](docs/guides/configuration-chatgpt.md) - ChatGPT Apps configuration
  - [Accomplish](docs/guides/configuration-accomplish.md) - Accomplish (Openwork) configuration
  - [Generic stdio MCP clients](docs/guides/configuration.md#stdio-mcp-clients) - Use `remnote-mcp-stdio`

## Documentation

### Getting Started

- **[Installation Guide](docs/guides/installation.md)** - Complete installation instructions
- **[Bridge / Consumer Version Compatibility
  Guide](https://github.com/robert7/remnote-mcp-bridge/blob/main/docs/guides/bridge-consumer-version-compatibility.md)**
  \- Match server version to installed bridge plugin version (`0.x` semver)
- **[Bridge Connection Lifecycle](https://github.com/robert7/remnote-mcp-bridge/blob/main/docs/guides/connection-lifecycle.md)** - Canonical bridge connect/retry behavior
- **[Configuration Guide](docs/guides/configuration.md)** - Configure Claude Code CLI, Accomplish, and other clients
- **[Codex Configuration Guide](docs/guides/configuration-codex.md)** - Set up Codex TUI and Codex.app with RemNote
- **[ChatGPT Configuration Guide](docs/guides/configuration-chatgpt.md)** - Set up ChatGPT Apps with your MCP server
- **[Demo & Screenshots](docs/demo.md)** - See the server in action with different AI clients

### Usage

- **[remnote-mcp-server Command Reference](docs/guides/remnote-mcp-server-command-reference.md)** - Server executable, daemon, and launchd options
- **[remnote-cli Command Reference](docs/guides/remnote-cli-command-reference.md)** - Shell command reference for the bundled CLI
- **[MCP Tools Reference](docs/guides/tools-reference.md)** - Detailed reference for all 9 RemNote tools
- **[Remote Access Setup](docs/guides/remote-access.md)** - Expose server for cloud clients or remote connector flows
  (ngrok, etc.)

### Help & Advanced

- **[Troubleshooting](docs/guides/troubleshooting.md)** - Common issues and solutions
- **[Architecture](docs/architecture.md)** - Design rationale and technical architecture

### Development

- **[Development Setup](docs/guides/development-setup.md)** - Contributing guide for developers
- **[Integration Testing](docs/guides/integration-testing.md)** - Canonical shared workflow for updating and running MCP server + CLI integration coverage against live RemNote
- **[Publishing Guide](docs/npm-publishing.md)** - npm publishing process (maintainers only)

## Available MCP Tools

| Tool                      | Description                                    |
|---------------------------|------------------------------------------------|
| `remnote_create_note`     | Create notes, markdown trees, or flashcards with title, content, parent, and tags |
| `remnote_search`          | Search knowledge base with full-text search and parent-context metadata; `tags` remain optional and SDK-limited |
| `remnote_search_by_tag`   | Search by tag with ancestor-context resolution |
| `remnote_read_note`       | Read note by ID with metadata and markdown or structured content; readable `tags` remain SDK-limited |
| `remnote_update_note`     | Update title, append/replace content, or modify tags |
| `remnote_append_journal`  | Append hierarchical content to today's daily document |
| `remnote_read_table`      | Read Advanced Table columns, rows, and typed property metadata |
| `remnote_get_playbook`    | Get recommended MCP usage/navigation playbook  |
| `remnote_status`          | Check connection status and statistics         |

Tools that declare an `outputSchema` return MCP `structuredContent` plus a JSON `content` text block for compatibility.
See the [MCP tools specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) for the
protocol contract.

The server uses `@modelcontextprotocol/sdk` and supports current MCP protocol negotiation, including `2025-11-25`.
Do not confuse MCP protocol versions with `remnote-mcp-server` or bridge plugin package versions; package versions use
`0.x` semver and should usually match by minor line.

See the [Tools Reference](docs/guides/tools-reference.md) for detailed usage and examples.

## Supported AI Clients

- **[Claude Code CLI](https://claude.com/claude-code)** - Local terminal-based agent
- **Codex TUI / Codex.app** - Local OpenAI coding agent clients
- **Claude Desktop / Cowork** - Local MCPB clients when desktop extensions are enabled, or remote connector clients
  when local MCPB is not applicable
- **[Accomplish](https://github.com/accomplish-ai/accomplish)** - Task-based MCP client (formerly Openwork)
- **Any MCP client** supporting Streamable HTTP transport
- **Any local MCP client** supporting stdio transport through `remnote-mcp-stdio`
- **Any local command runner** that can call `remnote-cli`

## Example Usage

**Create notes:**

```text
Create a note about "Project Ideas" with content:
- AI-powered note taking
- Personal knowledge management
```

**Search:**

```text
Search my RemNote for notes about "machine learning"
```

**Update notes:**

```text
Add a tag "important" to note abc123
```

**Journal entries:**

```text
Add to my journal: "Completed the RemNote MCP integration"
```

See the [Tools Reference](docs/guides/tools-reference.md) for more examples.

## Configuration

### Environment Variables

- `REMNOTE_HTTP_PORT` - HTTP MCP server port (default: 3001)
- `REMNOTE_HTTP_HOST` - HTTP server bind address (default: 127.0.0.1)
- `REMNOTE_WS_PORT` - WebSocket server port (default: 3002)

### Custom Ports

```bash
remnote-mcp-server --http-port 3003 --ws-port 3004
```

After changing ports, update your MCP client configuration and RemNote plugin settings.

### Background Daemon

```bash
remnote-mcp-server daemon start
```

- Default log: `~/.remnote-mcp-server/remnote-mcp-server.log`
- Duplicate starts are treated as already running when the daemon PID is alive.
- If the configured HTTP or WebSocket port is already occupied, startup fails before spawning a second server.
- Use `remnote-mcp-server daemon stop` for graceful shutdown.
- Use `remnote-mcp-server daemon install-launchd` on macOS to keep the server running across login and unexpected
  exits.
- When launchd is installed, the same `daemon status/start/stop/restart` commands control the launchd service.

See [remnote-mcp-server Command Reference](docs/guides/remnote-mcp-server-command-reference.md) for all options.

## Troubleshooting

**Server won't start:**

- Check ports aren't in use: `lsof -i :3001` and `lsof -i :3002`
- Verify installation: `which remnote-mcp-server`

**Plugin won't connect:**

- Verify plugin settings: WebSocket URL `ws://127.0.0.1:3002`
- Check server is running: `lsof -i :3002`

**Tools not appearing:**

- Verify configuration: `claude mcp list`
- Restart Claude Code completely
- If this started after upgrades, verify bridge/server version compatibility (`0.x` minor versions may break); see the
  [Bridge / Consumer Version Compatibility
  Guide](https://github.com/robert7/remnote-mcp-bridge/blob/main/docs/guides/bridge-consumer-version-compatibility.md)

See the [Troubleshooting Guide](docs/guides/troubleshooting.md) for detailed solutions.

## Contributing & Development

**Development setup:**

> **Version compatibility tip:** when testing against a local or marketplace-installed bridge plugin, use a server checkout/tag compatible with that bridge plugin version (see the [Bridge / Consumer Version Compatibility Guide](https://github.com/robert7/remnote-mcp-bridge/blob/main/docs/guides/bridge-consumer-version-compatibility.md)).

```bash
git clone https://github.com/robert7/remnote-mcp-server.git
cd remnote-mcp-server
./link-cli.sh
# Later, remove the local links for package executables:
./unlink-cli.sh
```

**Development workflow:**

```bash
npm run dev          # Watch mode with hot reload
npm test             # Run test suite
./code-quality.sh    # Run all quality checks
```

See the [Development Setup Guide](docs/guides/development-setup.md) for complete instructions.

Pull requests that affect bridge-consumer behavior should follow the shared PR rules in the bridge repo: [Pull Request Guide](https://github.com/robert7/remnote-mcp-bridge/blob/main/docs/guides/pull-request-guide.md). In particular, keep bridge and server-package behavior aligned for shared functionality changes.

For the canonical workflow for updating and running shared live integration coverage, see the [Integration Testing Guide](docs/guides/integration-testing.md).

## Related Projects

- [RemNote Automation Bridge](https://github.com/robert7/remnote-mcp-bridge) - Browser plugin for RemNote integration
- [Model Context Protocol](https://modelcontextprotocol.io/) - Open protocol for AI-application integration

## License

MIT

## Links

- [Documentation](docs/guides/) - Complete documentation
- [GitHub Issues](https://github.com/robert7/remnote-mcp-server/issues) - Bug reports and feature requests
- [npm Package](https://www.npmjs.com/package/remnote-mcp-server) - Official npm package
- [CHANGELOG](CHANGELOG.md) - Version history and roadmap
