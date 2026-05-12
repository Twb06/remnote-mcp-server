# remnote-cli Command Reference

`remnote-cli` is automation-first: JSON is the default output mode. Use `--text` for human-readable output.

## Invocation

```bash
remnote-cli [global-options] <command> [command-options]
```

Most commands require a running `remnote-mcp-server`:

```bash
remnote-mcp-server
```

Bridge actions (`create`, `search`, `search-tag`, `read`, `update`, `journal`, `status`) also require RemNote with
the RemNote Automation Bridge plugin connected to that MCP server.

## Global Options

| Flag              | Default                         | Description                         |
| ----------------- | ------------------------------- | ----------------------------------- |
| `--json`          | enabled                         | JSON output mode                    |
| `--text`          | off                             | Human-readable output mode          |
| `--mcp-url <url>` | `http://127.0.0.1:3001/mcp`     | MCP server URL                      |
| `--verbose`       | off                             | Reserved for verbose stderr logging |
| `--version`       | n/a                             | Show CLI version                    |
| `--help`          | n/a                             | Show help                           |

### Output mode rules

- JSON is the default when no output flag is provided.
- If both `--json` and `--text` are passed, `--text` wins.

### Argument Quoting and Shifting

CLI environments (especially Windows shells) can sometimes "swallow" empty strings or misinterpret arguments if quoting is missing. This can lead to **argument shifting**, where a flag (like `--content`) is incorrectly interpreted as the _value_ for a preceding option (like `--title`).

To prevent this:

1. **Always quote** text values that contain spaces or special characters.
2. **Use explicit equality** for potentially empty values: `--title=""`.
3. `remnote-cli` includes **shifting detection**: if an option value matches a registered global or local flag, the command will fail early with an error message to prevent accidental mis-execution.

## Exit Codes

| Code | Meaning                                 |
| ---- | --------------------------------------- |
| `0`  | Success                                 |
| `1`  | Generic command/action error            |
| `2`  | MCP server not running / unreachable    |
| `3`  | Reserved for bridge-not-connected flows |

## create

Create a new RemNote note or a hierarchical tree.

```bash
remnote-cli create [title] [options]
```

| Option                  | Default | Description                                          |
| ----------------------- | ------- | ---------------------------------------------------- |
| `--title <text>`        | none    | Note title                                           |
| `-c, --content <text>`  | none    | Initial content (markdown supported)                 |
| `--content-file <path>` | none    | Read initial content from UTF-8 file (`-` for stdin) |
| `--parent-id <id>`      | none    | Parent Rem ID                                        |
| `-t, --tags <tag...>`   | none    | One or more tags                                     |

Behavior rules:

- `title` and `content` are both optional, but **at least one must be provided**.
- Title input support positional `[title]` (backward-compatible) and `--title <text>`.
- Content input from `-c`/`--content`/`--content-file` supports RemNote's native markdown syntax for creating nested hierarchies and flashcards inline.
- `--content` and `--content-file` are mutually exclusive.
- Content loaded from file/stdin is passed verbatim (no templating/interpolation).
- Write content from `--content-file` and stdin is capped at 100 KB.
- If `parent-id` is not provided, the note will be created under the default root rem in the setting.
- Tags are applied only to the top-level Rems created.

Examples:

```bash
# Simple note with title only, either by positional argument or --title option, create under default root rem
remnote-cli create "Meeting Notes"
remnote-cli create --title "Meeting Notes"

# Create a new note under a specific parent rem id
remnote-cli create --title "Meeting Notes" --parent-id <parent-rem-id>

# Create a new note with title and content
remnote-cli create --title "Project Plan" --content "Phase 1" --tags planning work

# Create a new note with markdown content directly under parent rem id
# Note: if the content is in markdown format, --content/--content-file must be used to avoid misinterpretation of the content as command options
remnote-cli create --content "- Item 1\n  - Item 2" --parent-id <parent-rem-id>

# Flashcards
remnote-cli create --title "Photosynthesis" --content "Front :: Back"

# Hierarchical tree from file or from parsed markdown
remnote-cli create --title "Biology Terms" --content-file /tmp/biology.md
remnote-cli create --title "Biology Terms" --content "# Terms 1\n- Item 1\n  - Item 2"
```

## search

Search notes by text query.

```bash
remnote-cli search <query> [options]
```

Shared options for `search` and `search-tag`:

| Option                     | Default | Description                          |
| -------------------------- | ------- | ------------------------------------ |
| `-l, --limit <n>`          | `50`    | Maximum number of results            |
| `--include-content <mode>` | `none`  | `none`, `markdown`, or `structured`  |
| `--depth <n>`              | `1`     | Child depth for rendered content     |
| `--child-limit <n>`        | `20`    | Max children per hierarchy level     |
| `--max-content-length <n>` | `3000`  | Max rendered content character count |

Behavior rules:

- In `--text` mode, each line includes headline/title and Rem ID.
- Tags are shown in `--text` mode when the bridge returns them as `[tags: tag1, tag2]`.
- Parent context is appended in text output when available as `<- Parent Title [parentRemId]`.
- `--depth`, `--child-limit`, and `--max-content-length` are most relevant when content rendering is enabled.
- `tags` is optional and present when the matched Rem has readable tag metadata.

Examples:

```bash
remnote-cli search "meeting"
remnote-cli search "weekly" --limit 10 --include-content structured --depth 2 --child-limit 10 --text
```

## search-tag

Search notes by tag (ancestor-context aware).

```bash
remnote-cli search-tag <tag> [options]
```

Options and output/content controls are identical to `search`
(`-l/--limit`, `--include-content`, `--depth`, `--child-limit`, `--max-content-length`).

Examples:

```bash
remnote-cli search-tag "#daily"
remnote-cli search-tag "weekly" --include-content markdown --depth 2 --text
```

## read

Read one note by Rem ID.

```bash
remnote-cli read <rem-id> [options]
```

| Option                     | Default    | Description                          |
| -------------------------- | ---------- | ------------------------------------ |
| `-d, --depth <n>`          | `5`        | Child depth to render                |
| `--include-content <mode>` | `markdown` | `markdown`, `structured`, or `none`  |
| `--child-limit <n>`        | `100`      | Max children per hierarchy level     |
| `--max-content-length <n>` | `100000`   | Max rendered content character count |

Behavior rules:

- `--text` mode prints metadata when present: title/headline, ID, type, parent, aliases, tags, card direction, and content
  stats.
- If `content` exists, it is printed after a blank line.
- In structured mode, use JSON output (default) to preserve `contentStructured` rem IDs and child hierarchy.
- `--include-content none` suppresses rendered content.
- `tags` is optional and present when the returned Rem has readable tag metadata.

Examples:

```bash
remnote-cli read abc123def
remnote-cli read abc123def --include-content none --depth 2 --child-limit 30 --max-content-length 5000 --text
remnote-cli read abc123def --include-content structured --depth 2 --child-limit 30
```

## read-table

Read one Advanced Table by exact title or Rem ID.

```bash
remnote-cli read-table (--title <title> | --rem-id <id>) [options]
```

| Option                     | Default | Description                               |
| -------------------------- | ------- | ----------------------------------------- |
| `--title <title>`          | none    | Exact Advanced Table title                |
| `--rem-id <id>`            | none    | Table Rem ID                              |
| `-l, --limit <n>`          | `50`    | Maximum rows to return                    |
| `--offset <n>`             | `0`     | Zero-based row offset                     |
| `-p, --properties <names>` | none    | Comma-separated property names to include |

Behavior rules:

- Provide exactly one of `--title` or `--rem-id`.
- JSON output includes `tableId`, `tableName`, `columns`, `rows`, `totalRows`, and `rowsReturned`.
- In `--text` mode, output prints table identity, column schema, and a simple row grid.
- `--properties` filters returned columns by property name before rows are formatted.
- Use `--limit` and `--offset` together for incremental reads of large tables.

Examples:

```bash
remnote-cli read-table --title "Projects"
remnote-cli read-table --rem-id abc123def --limit 10
remnote-cli read-table --title "Projects" --properties "Status,Owner" --text
```

## update

Update note metadata.

```bash
remnote-cli update <rem-id> [options]
```

| Option           | Default | Description            |
| ---------------- | ------- | ---------------------- |
| `--title <text>` | none    | Replace title/headline |

Use the dedicated commands below for child content and tag writes.

Examples:

```bash
remnote-cli update abc123def --title "Updated Title"
```

## insert-children

Insert child Rems under a parent at an explicit position.

```bash
remnote-cli insert-children <parent-rem-id> --content <text> --position <first|last|before|after>
```

| Option                    | Default | Description                                      |
| ------------------------- | ------- | ------------------------------------------------ |
| `--content <text>`        | none    | Content to insert                                |
| `--content-file <path>`   | none    | Read inserted content from UTF-8 file (`-` stdin) |
| `--position <position>`   | none    | `first`, `last`, `before`, or `after`             |
| `--sibling-rem-id <id>`   | none    | Required for `before` and `after`                 |

Examples:

```bash
remnote-cli insert-children cEZH8DJYED3RQIB7k --content "description: Use for Codex app/CLI/skills/ExecPlans notes." --position first
remnote-cli insert-children cEZH8DJYED3RQIB7k --content-file /tmp/child.md --position before --sibling-rem-id abc123def
```

## replace-children

Replace all direct child Rems under a parent. This is destructive and can be blocked by bridge policy.

```bash
remnote-cli replace-children <parent-rem-id> --content-file <path>
```

| Option                  | Default | Description                                                                      |
| ----------------------- | ------- | -------------------------------------------------------------------------------- |
| `--content <text>`      | none    | Replacement content                                                              |
| `--content-file <path>` | none    | Read replacement content from UTF-8 file (`-` stdin; empty file clears children) |

## update-tags

Add or remove tags by exact tag Rem ID.

```bash
remnote-cli update-tags <rem-id> --add-tag-ids <tag-rem-id...>
```

| Option                          | Default | Description              |
| ------------------------------- | ------- | ------------------------ |
| `--add-tag-ids <tag-rem-id...>`    | none    | Exact tag Rem IDs to add |
| `--remove-tag-ids <tag-rem-id...>` | none    | Exact tag Rem IDs to remove |

Use exact IDs for production tagging workflows. Name-based tag mutation is intentionally not exposed.

## journal

Append to today's daily document.

```bash
remnote-cli journal [content] [options]
```

| Option                  | Default           | Description                                        |
| ----------------------- | ----------------- | -------------------------------------------------- |
| `--content <text>`      | none              | Journal entry content                              |
| `--content-file <path>` | none              | Read journal entry from UTF-8 file (`-` for stdin) |
| `--no-timestamp`        | timestamp enabled | Disable `[HH:MM:SS]` prefix                        |

Behavior rules:

- Provide exactly one content source:
  - positional `[content]` (backward-compatible)
  - `--content <text>`
  - `--content-file <path|->`
- Content input from `--content`/`--content-file` supports RemNote's native markdown syntax for creating nested hierarchies and flashcards inline.

Examples:

```bash
remnote-cli journal "Finished sprint review"
remnote-cli journal --content "Quick thought" --no-timestamp --text
remnote-cli journal --content-file /tmp/entry.md --text
cat /tmp/entry.md | remnote-cli journal --content-file - --text
```

## status

Check bridge connection state.

```bash
remnote-cli status
```

Behavior rules:

- Calls the MCP server `remnote_status` tool and reports bridge connectivity.
- JSON output includes bridge write-policy flags when available:
  - `acceptWriteOperations`
  - `acceptReplaceOperation`
- In text mode, output includes:
  - bridge connection status
  - plugin version when provided
  - CLI version when provided
  - compatibility warning (`version_warning`) when provided
- Returns exit code `2` when the MCP server is unreachable.

Examples:

```bash
remnote-cli status
remnote-cli --mcp-url http://127.0.0.1:3005/mcp status --text
```
