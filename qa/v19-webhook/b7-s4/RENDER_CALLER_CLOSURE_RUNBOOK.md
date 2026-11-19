# TIEN404 V19.0-B7-S4 — Render Caller Closure Runbook

**Date:** 2026-11-19 JST
**Status:** RENDER WORKSPACE DISCOVERED; SERVICE INVENTORY **BLOCKED BY REQUIRED USER WORKSPACE SELECTION**.
**No Render service was opened, changed, deployed, restarted or queried.**

## 1. Source of evidence

The Render connector \`list_workspaces\` returned one connected workspace named **My Workspace**. The \`list_services({})\` attempt was rejected with \`no workspace selected\`, instructing the operator to ask the user to choose a workspace and not infer/assign one automatically. The workspace identifier and account email were not copied into GitHub.

A single available workspace is **not** implicit authorization to choose it. The user must explicitly confirm "My Workspace" for read-only S4 inspection. No Render caller closure claim can be made in this PR.

## 2. Exact next read-only audit after confirmed workspace

1. Call \`list_services({workspaceId: <user-confirmed ID>})\` with \`includePreviews=false\`; list only service ID/name/type/environment/updated commit/deployment state, not secrets.
2. Verify staging service identities (e.g., auth gateway or other deployed APIs) against actual returned resources. Do not assume a service exists merely because a remembered URL resolves.
3. For each confirmed service, get its metadata/source repo/branch/commit only. If logs are available and explicitly scoped, search **redacted request metadata** for \`save_merchant_product\`, \`/rest/v1/rpc/save_merchant_product\`, \`/rpc/save_merchant_product\`, and known product-update tool names. Do not print JWTs, \`Authorization\`, cookies, \`apikey\`, body values, customer IDs or tokens.
4. If linked source repository/commit can be inspected, search static and dynamic call paths including \`supabase.rpc\`, PostgREST \`/rpc/\`, wrapped HTTP request clients, scheduled worker/cron and private internal adapters. Match deployed SHA, not just a mutable branch.
5. Identify whether the Render service has authority to invoke a Supabase RPC and which code path is responsible; never display environment variable **values**. Existence or naming of credential bindings is not proof of invocation.
6. If zero static matches, remain \`NO_CALLER_FOUND_IN_SCOPE\`, not \`NO_CALLERS_EXIST\`: runtime indirection, indirect calls and external clients remain possible.
7. Reconcile confirmed caller IDs/owner/deployment SHA with actual Supabase usage evidence. If complete telemetry cannot be obtained without introducing risk, flag BLOCKED rather than creating production logging.
8. Record exact bounded evidence scope and independent sign-off before considering RPC V1 retirement.

## 3. Verification gates

| Gate | Current status |
|---|---|
| Render workspace listing | VERIFIED, one named My Workspace |
| Explicit user workspace selection | BLOCKED |
| Render service inventory | NOT PERFORMED |
| Render deployed commits and source audit | NOT PERFORMED |
| Dynamic HTTP/RPC invocation tracing | NOT PERFORMED |
| All V1 RPC callers identified | NOT VERIFIED |
| Removing/revoking V1 RPC | NO-GO |

## 4. Authorization boundary

Selecting a workspace for **read-only inspection** does not grant permission to edit service settings, environment variables, deploys, credentials, production logs, routes or customer data. Any such action requires a separate exact-target approval, backup/rollback and privacy review.

**Current result:** \`B7_S4_RENDER_WORKSPACE_SELECTION_REQUIRED__CALLER_CLOSURE_BLOCKED\`.
