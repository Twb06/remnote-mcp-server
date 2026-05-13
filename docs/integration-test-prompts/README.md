# Integration Test Prompts

This directory contains copy-paste prompts for manually testing live RemNote MCP behavior through an agent or MCP
client.

## Test Note Update

`test-note-update.md` tests the live RemNote MCP write path. It creates a temporary note, renames it through
`remnote_update_note`, adds and removes a sample tag through `remnote_update_tags`, and reads the note back for
confirmation.

Before using the prompt, adjust both sample IDs to valid Rem IDs in the target RemNote knowledge base:

- `parentId`: parent Rem ID where the temporary test note should be created
- tag Rem ID: existing tag Rem ID used for the add/remove `remnote_update_tags` test

The sample IDs are environment-specific and will not be valid for every RemNote account.
