# TIEN404 AI — Error registry V5

**Read-only snapshot:** n8n connector \`search_workflow_executions\` filtered \`startedAfter=2026-11-09T00:00:00Z\`, status \`error|crashed\`, count 19. These are *historical execution records*, not a claim that each error remains unresolved. Never expose raw customer messages, tokens or credentials from node execution data.

| Workflow | Failed execution IDs observed | Area | Current diagnosis / next read-only action |
|---|---|---|---|
| \`U2DJsxzSYPH5hRop\` | 936, 934, 626 | Legacy Revenue Report | Earlier analysis flagged invalid paid total at Orders row 2. Re-check published node and schema mapping without sending email or editing Sheets. |
| \`wgkkmT7q4lm4HyuA\` | 705, 704, 703, 699, 698 | Website AI | Historical failures before current V4.3 changes; compare active version and recent successes; verify widget browser response and quota. |
| \`Z7FdV7uDvApfbURQ\` | 652, 637 | Messenger TEST | Inspect redacted execution node/error state. Never replay live Meta sends or order/ticket writes. |
| \`8gA4A8TM3Z9waloB\` | 649, 647, 646 | Meta token checks | Auth checks may include secrets; inspect metadata only and credential validity securely, no token exposure. |
| \`NvQfIffOrZokPBPW\` | 618 | Isolated AI read-only | Check read-only QA trigger and product mapping. |
| \`v6PBwcqSapVzACMW\` | 276, 275, 274, 273, 272 | Legacy AI SALES | Check tool validation and published/draft comparison; never create/swap production rows in tests. |

## Severity and workflow
- P0 if any ongoing unauthorized writes, cross-tenant access, payments or customer data disclosure. No such incident has been proved by these metadata alone.
- P1 if website cannot send/receive, workflow regularly errors, or revenue report is silently wrong.
- P2 if only historical test errors with later recovery.
- Triage sequence: list executions → safely redact → identify failing node and version → reproduce in isolated mock → patch draft/branch → regression test → request production approval if sensitive.
- Required evidence fields: workflow ID, execution ID, timestamp, side-effect profile, redacted error class, suspected root cause, test result and status.

**Status:** Investigations pending. Do not claim 19 active incidents or 19 failures today.
