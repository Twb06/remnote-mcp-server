# AGENTS.md

This file is a map for AI agents working in `remnote-mcp-server`.

## Repo Role

This repo exposes RemNote operations as MCP tools over Streamable HTTP, bridges those tool calls to the RemNote plugin
over WebSocket, and ships bundled local client entrypoints.

```text
AI agents (HTTP MCP) <-> HTTP server (:3001) <-> WebSocket bridge (:3002) <-> RemNote plugin
AI agents (stdio MCP) <-> remnote-mcp-stdio <-> HTTP server (:3001) <-> WebSocket bridge (:3002) <-> RemNote plugin
CLI commands <-> remnote-cli <-> HTTP server (:3001) <-> WebSocket bridge (:3002) <-> RemNote plugin
```

## Companion Repos (Sibling Dirs)

Resolve from this repo root (`$(pwd)`):

- `$(pwd)/../remnote-mcp-bridge` - source of bridge action contracts + plugin behavior

When changing action names, payloads, or response semantics, validate this repo and bridge docs. The old standalone
`remnote-cli` repo is discontinued; maintained CLI code lives in this repo under `src/remnote-cli/`.

## Contract Map (Current)

### External MCP Tool Surface (9)

- `remnote_create_note`
- `remnote_search`
- `remnote_search_by_tag`
- `remnote_read_note`
- `remnote_update_note`
- `remnote_append_journal`
- `remnote_read_table`
- `remnote_get_playbook`
- `remnote_status`

### Bundled CLI Command Surface

- `remnote-cli create`
- `remnote-cli search`
- `remnote-cli search-tag`
- `remnote-cli read`
- `remnote-cli update`
- `remnote-cli journal`
- `remnote-cli status`
- `remnote-cli read-table`

### Bridge Action Mapping and Compatibility

- Most tools map to same conceptual bridge actions (`create_note`, `search`, `search_by_tag`, `read_note`,
  `update_note`, `append_journal`, `get_status`).
- Bridge plugin sends WebSocket `hello` with plugin version.
- `remnote_status` enriches output with server version + optional `version_warning` for compatibility drift.

Projects are still `0.x`; prefer the same minor line across bridge and server package:

- `../remnote-mcp-bridge/docs/guides/bridge-consumer-version-compatibility.md`

## Code Map

- `src/index.ts` - process startup/shutdown wiring
- `src/http-server.ts` - MCP HTTP transport/session lifecycle
- `src/websocket-server.ts` - plugin connection, request correlation, timeouts, `hello` handling
- `src/tools/index.ts` - MCP tool registration and dispatch
- `src/schemas/remnote-schemas.ts` - Zod input/output schema contracts
- `src/remnote-cli/` - bundled CLI command parser, MCP client, command payload mapping, and output formatting
- `mcpb/remnote-local/server/index.js` - stdio MCP proxy used by `remnote-mcp-stdio` and the Claude Desktop MCPB
- `src/version-compat.ts` - 0.x compatibility checks

Primary docs for deeper context:

- `docs/architecture.md`
- `docs/guides/tools-reference.md`
- `docs/guides/configuration.md`
- `docs/guides/remote-access.md`

## Development and Verification

If Node/npm is unavailable in shell:

```bash
source ./node-check.sh
```

Core commands:

```bash
npm run dev
npm run build
npm run typecheck
npm test
npm run test:coverage
./code-quality.sh
```

Manual live integration commands:

```bash
npm run test:integration
npm run test:integration:mcp
npm run test:integration:mcpb
npm run test:integration:cli
```

## Integration and Live Validation Policy

AI agents may run live integration tests in this repo only on explicit human request and only through the guarded
wrapper.

- Default: do not run `npm run test:integration` or `./run-integration-test.sh` directly.
- Allowed path for AI agents: `./run-agent-integration-test.sh [--yes]`, which validates the direct MCP tools path,
  MCPB stdio proxy path, and bundled CLI path by default. Use `--suite mcp`, `--suite mcpb`, or `--suite cli` only for
  targeted reruns.
- Before invoking the wrapper, the agent must ask the human collaborator to start the bridge in RemNote.
- If bridge code changed after the currently running RemNote bridge session started, the agent must ask the human
  collaborator to restart the bridge before rerunning the suite.
- The wrapper may build and start the local MCP server if it is not already running, then wait for
  `remnote_status.connected === true` before launching the suite.
- After each agent-assisted integration run, whether it passes, fails, or is interrupted, the agent must stop the MCP
  server if and only if the wrapper started it for that run.
- If the bridge never connects, the wrapper must stop and tell the human collaborator to verify the RemNote bridge
  session.
- Use unit/static checks for routine agent-side verification when explicit live validation is not requested.

## Documentation and Changelog Rules

- Before docs edits, read `.agents/dev-documentation.md`.
- Any functional or documentation change must be recorded in `CHANGELOG.md`.
- Keep AGENTS/docs map-level: contracts, rationale, and navigation.

## Release and Publishing Map

- Publish workflow: `./publish-to-npm.sh`
- The npm package provides `remnote-mcp-server`, `remnote-cli`, and `remnote-mcp-stdio` bins.
- Keep release notes aligned with `CHANGELOG.md`
- For release prep, verify package version and changelog section alignment.

## Git Policy

Do not create commits unless explicitly requested. Use `.agents/dev-workflow.md` as canonical policy.
