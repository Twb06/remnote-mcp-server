# MCP Tool Smoke Test

I want to validate my installed RemNote MCP setup through this AI agent.

Use only the RemNote MCP tools exposed by this agent or MCP client. Tool names may include client-specific prefixes or
namespace wrappers; map them to the canonical RemNote MCP tool names below.

Do not use `remnote-cli`, shell commands, direct HTTP calls, browser automation, or any workaround outside the MCP tools.

## Required MCP Tools

This smoke test requires:

- `remnote_status`
- `remnote_get_playbook`
- `remnote_search`
- `remnote_create_note`
- `remnote_read_note`
- `remnote_update_note`
- `remnote_insert_children`
- `remnote_update_tags`
- `remnote_search_by_tag`
- `remnote_append_journal`

Optional/report-only tools:

- `remnote_replace_children`
- `remnote_read_table`

If your client can inspect the available tool list, check it first. If not, continue and report any missing tool when a
required call fails.

## Test Flow

1. Call `remnote_status`.
   - If the RemNote MCP namespace is unavailable, stop and report that the MCP tools are missing.
   - If `connected` is not `true`, stop and report the status result.
   - If `acceptWriteOperations` is not `true`, stop and report that write tools are disabled.

2. Call `remnote_get_playbook` and briefly confirm that it returned guidance.

3. Resolve the shared temporary integration-test root.
   - Search for the exact title `RemNote Automation Bridge [temporary integration test data]`.
   - Search for the exact title `remnote-integration-root-anchor`.
   - If multiple exact root-title matches exist, stop and report the duplicate root Rem IDs.
   - If multiple exact root-anchor tag matches exist, stop and report the duplicate tag Rem IDs.
   - If the root-anchor tag does not exist, create a note titled `remnote-integration-root-anchor` and keep its Rem ID.
   - If the root note does not exist, create a note titled `RemNote Automation Bridge [temporary integration test data]`
     with `tagRemIds` containing the root-anchor tag Rem ID.
   - Keep the root note Rem ID for the remaining steps.

4. Create a test run note under the root note.
   - Title: `[MCP-AGENT-TEST] Tool smoke test <current ISO timestamp>`
   - Content: short text stating the agent/client name if known and the timestamp
   - Keep the created run note Rem ID.

5. Search for the exact run-note title with `remnote_search` and confirm the created run note appears.

6. Read the run note with `remnote_read_note`.
   - Use `includeContent="structured"` when available.
   - Confirm the title and parent context are consistent with the root note.

7. Rename the run note with `remnote_update_note`.
   - New title: `[MCP-AGENT-TEST] Tool smoke test updated <current ISO timestamp>`
   - Read it again and confirm the updated title.

8. Insert children under the run note with `remnote_insert_children`.
   - Insert at least two children, for example:
     - `status: created by MCP agent validation`
     - `timestamp: <current ISO timestamp>`
   - Read the run note again with structured content and confirm the inserted children are present.

9. Create a test tag note under the same root note.
   - Title: `[MCP-AGENT-TEST] tag <current ISO timestamp>`
   - Keep its Rem ID as `testTagRemId`.

10. Add the test tag to the run note with `remnote_update_tags`.
    - Use `addTagRemIds: [testTagRemId]`.
    - Read the run note and confirm the tag appears if tag metadata is returned.

11. Search by the test tag with `remnote_search_by_tag`.
    - Use `tagRemId: testTagRemId`.
    - Confirm the run note or its resolved ancestor context appears in the results.

12. Remove the test tag from the run note with `remnote_update_tags`.
    - Use `removeTagRemIds: [testTagRemId]`.
    - Search by the test tag again and confirm the run note is no longer returned as the tagged target.

13. Append a journal entry with `remnote_append_journal`.
    - Content: `[MCP-AGENT-TEST] Journal smoke test <current ISO timestamp>`
    - Use the test tag Rem ID as `tagRemIds` if the tool supports journal tag IDs in this client.

14. Optional/report-only checks:
    - If `remnote_replace_children` is available and `remnote_status.acceptReplaceOperation` is `true`, report that
      destructive replacement is enabled. Do not call it unless the user explicitly asks for destructive validation.
    - If `remnote_read_table` is available, report that table validation requires an existing Advanced Table title or
      Rem ID and skip it for this zero-config smoke test.

15. Final response:
    - Report PASS or FAIL.
    - Include the root note Rem ID, run note Rem ID, and test tag Rem ID if created.
    - List every required tool and whether it was used successfully.
    - List optional/report-only tools and why they were skipped or not available.
    - Mention that artifacts can be cleaned up by searching RemNote for `[MCP-AGENT-TEST]`.
