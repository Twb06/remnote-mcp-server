# Test Note Update with RemNote MCP Tools

I want to test the RemNote MCP server.

Use only the RemNote MCP tools exposed by your current agent or MCP client. Tool names may include client-specific
prefixes or namespace wrappers; map them to the canonical RemNote MCP tool names below.

First, use the RemNote MCP status tool (`remnote_status`).
If the RemNote MCP tool namespace or write tools are not available, STOP and say exactly which tools are missing. Do not use `remnote-cli`, shell fallback, or any other workaround.

If status shows:

- connected=true
- acceptWriteOperations=true

then perform the test exclusively through MCP tools:

1. Use the RemNote MCP create-note tool (`remnote_create_note`)
   - parentId: `k0H2Upf46eGt03gsa`
   - title: `MCP test <current timestamp>`
   - content: short test content with the current timestamp

2. Take the created note ID from the result.

3. Use all available RemNote MCP update tools whose canonical names start with `remnote_update`:
   - `remnote_update_note`: rename the created note to a title containing `updated` and a timestamp.
   - `remnote_update_tags`: add tag Rem ID `8qRXvJDRXnK5mzLsP` to the created note, then remove the same tag Rem ID
     again so the test does not leave the note tagged.

4. Finally, use the RemNote MCP read-note tool (`remnote_read_note`) on the created note and briefly summarize:
   - created remId
   - whether create succeeded
   - whether update_note succeeded
   - whether update_tags add/remove succeeded
   - final note title

Important: do not use `remnote-cli`. This must be a pure MCP tool test.
