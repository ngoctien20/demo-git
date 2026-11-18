# TIEN404 AI — V18.5.4 Private Hosted Widget Canary × Real Access Readiness × Read-Only Commerce UAT

**Date:** 18/11/2026 JST  
**Status:** PARTIAL UAT PASS — REAL n8n READ-ONLY SANDBOX PASS; CLOUDFLARE ACCESS RUNTIME NOT YET PROVEN; HOSTED WIDGET CANARY NOT DEPLOYED; PRODUCTION NO-GO.

## 1. Continuity and protected scope

Stacked after V18.5.3 Draft PR #407 (which itself follows #405 and #404). Reuses the existing Published Commerce Core and its existing child workflows. No second AI Sales Core was created. No n8n Published workflow was changed, no Cloudflare Worker/Access/D1/DO was changed, and the public website was not modified.

V18.5.2 established that the whole Published Commerce Agent is NOT read-only because it can reach the support-ticket insert workflow. V18.5.4 therefore calls **only** the existing Published Catalog Query and Cart Preview child workflows. The full Agent and ticket writer are excluded.

## 2. REAL n8n Read-Only UAT — VERIFIED

A new manual-only QA harness was created in the user's n8n Personal project, folder **90_QA - DIAGNOSTICS**:

- Workflow: `TIEN404 Widget Read-Only Commerce UAT V18.5.4`
- Workflow ID: `715VV39ohwibkoUK`
- Active: **false**; Published: **no**; Manual Trigger only.
- Main manual execution: **5341**, status **success**, 9 sequential child executions.
- The harness contains no credentials, webhook trigger, public endpoint, AI Agent, support-ticket writer or order-write workflow. It has been grouped on the canvas as one read-only QA stage.

### Exact current Published child versions inspected and invoked

| Workflow | ID | Published version | Storage operation |
| --- | --- | --- | --- |
| Catalog Query | `oOOXicKXGkBskKqh` | `e0f1e345-8e6c-40cb-8e6a-d7ad2eb92696` | DataTable row.get |
| Cart Preview | `igPOsSbEgd4NgtRA` | `eff32e20-a6d0-4975-88b8-107eae752b4b` | DataTable row.get |
| Tenant Resolver | `5Eeh8hbpsoNhuiVo` | `a99c7350-7aea-446d-bdc5-4b10f52c3ad1` | 3 × DataTable row.get |

### UAT results

| Case | Result |
| --- | --- |
| Materials sandbox catalog: VL-101 | PASS — 79,000 VND, stock 120 |
| Materials cart preview: 3 × VL-101 | PASS — subtotal 237,000 VND; quote required; cannot confirm/write |
| Grocery sandbox catalog: TG-101 | PASS — 4,500 VND, stock 200 |
| Grocery cart preview: 2 × TG-101 | PASS — subtotal 9,000 VND; cannot confirm/write |
| Materials cannot retrieve grocery SKU | PASS — 0 products |
| Grocery cannot retrieve materials SKU | PASS — 0 products |
| Materials cart rejects grocery SKU | PASS — sku_not_found |
| Grocery cart rejects materials SKU | PASS — sku_not_found |
| Unregistered Website channel | PASS — unregistered_channel |

Evidence is recorded in `qa/channel-v1854/n8n-readonly-uat-evidence.json`. The main execution links each sub-execution ID: 5342, 5344, 5346, 5348, 5350, 5352, 5354, 5356, 5358. All nine child executions succeeded.

**Side-effect evidence:** 0 order writes, 0 stock writes, 0 provider sends, 0 customer order reads, 0 customer PII reads, 0 AI calls. These were real n8n manual sub-workflow executions using the existing Sandbox DataTables, not mocked child outputs.

### Critical scope limitation — Tenant isolation is not Store isolation

The two website QA channels resolve to two distinct sandbox tenants: `demo_materials_qa` and `demo_grocery_qa`. The current resolver maps `channelType + accountId → tenantId`; Catalog and Cart filter products by `tenantId`. There is **no storeId** in the current resolver input or product filter.

Therefore V18.5.4 verifies **cross-tenant Sandbox isolation only**. It does NOT prove same-tenant Store A/B isolation or Store-level RLS. Do not market this evidence as Store A/B acceptance. That requires a separate Store-authority mapping and store-scoped data filter/RLS migration.

## 3. REAL Cloudflare Access account inventory — VERIFIED CONFIG, NOT RUNTIME JWT

Read-only Cloudflare API inventory found:

### Existing V14.4 Widget Gateway

- Existing Worker: `tien404-widget-gateway-v144-staging`.
- Current deployment: `a9f197fe-68c1-4321-bfb1-bc333d3093c6`, Worker version `98c8aad5-2dae-47c3-9cb0-8473065213e6`.
- workers.dev disabled; preview URLs disabled; 0 bindings; no custom Worker route found.
- Its current code intentionally returns 423 for `/v1/widget/session` and `/v1/widget/message`; it is not a chat endpoint.
- There is **no dedicated Access application for this V14.4 Worker hostname**.

### Existing Access applications

The account currently has four Access applications. One founder/biometric application is path-scoped to a **different** UAT01 Worker, not V14.4. The staging Pages application is also a separate domain. The RPC16 app is a separate deny-all scope. None is the exact V18.5 Widget Gateway application.

The account-level Access organization has `deny_unmatched_requests=false`. Therefore, enabling a Worker hostname before attaching its exact Access application/policy would be unsafe. Create and verify the full-host Access application first; only then enable the existing Worker subdomain and deploy.

The separate UAT01 Worker has workers.dev enabled and synthetic-only fixture logic. Its existing Access app is path-scoped, while its code contains root and `/api/*` routes. Treat routes outside that exact Access path as potentially unprotected until independent external negative tests prove otherwise. It is **not** an approved substitute for V14.4 and contains only synthetic fixtures. Do not connect it to live Commerce or reuse its runtime as a second Core.

A separate V17.5E gateway has its own installation registry, replay service and QA secrets. Those bindings/secrets belong to that separate project and must **not** be reused by V18.5.4 without a dedicated ownership/security review.

## 4. IMPLEMENTED — Cloudflare-native Access context candidate

Cloudflare's current Worker guidance supports reading the authenticated identity directly from `ctx.access` when Access protects the **direct Worker invocation**. This is preferred over parsing the JWT again in application code.

Official documentation:
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/

New source:
- `qa/channel-v1854/cloudflare-access-context-gate.mjs`
- `qa/channel-v1854/worker-v144-access-canary-candidate.mjs`
- `qa/channel-v1854/cloudflare-access-context-gate.test.mjs`

The candidate requires on every request:
1. A Cloudflare-supplied `ctx.access` object.
2. Exact server-configured Access AUD tag.
3. A successful `ctx.access.getIdentity()`.
4. Exact single operator email from a server-side allowlist.
5. Fail-closed behavior when context, audience, identity or configuration is missing.

It returns only an authorization decision, never the operator's email/name/groups or JWT. It does not trust Origin, browser headers, cookies, Widget ID or browser JSON as identity.

The candidate Worker keeps all Commerce endpoints locked (423), disables CORS and exposes only an Access canary response with `orderWrites=0`, `providerSends=0`. It does not call n8n, D1, a Durable Object, service binding, AI model, customer/order data or a provider.

**Cloudflare runtime caveat:** `ctx.access` applies to the Worker invocation authenticated directly by Access. It does not propagate through Service Bindings, and Static Assets' internal router does not pass it to the user Worker. The eventual Access-protected Worker must be the direct invocation. Do not rely on a downstream service binding receiving the original Access context.

## 5. NOT YET VERIFIED / BLOCKED

- Real Cloudflare Access JWT arriving at V14.4 Worker: **0**.
- Real `ctx.access` runtime invocation: **0**.
- Private V18.5 Access app for V14.4: **not created**.
- Hosted Widget canary deployment: **not deployed**.
- Website → Gateway → n8n end-to-end: **not run**.
- Server-to-server n8n adapter: **not built/credentialed**.
- Durable replay/quota binding dedicated to Widget: **not present**.
- Same-tenant Store A/B isolation: **not verified**.

The native `ctx.access` module is unit-tested with synthetic context only. A successful local test does not prove that the real Cloudflare edge supplied `ctx.access`.

## 6. Exact hosted change set requiring separate approval

Before the real private canary can run, approve these exact changes together:

1. **Host:** enable workers.dev for the existing V14.4 Worker at `tien404-widget-gateway-v144-staging.tienmobi208.workers.dev`. Do not create a second Worker.
2. **Access:** create a dedicated full-host Access app for that exact hostname; single approved owner/operator identity, biometric-capable IdP policy, short session, no Bypass, no broad wildcard, no public unauthenticated path.
3. **Ordering:** create and verify the Access app/policy first; enable the Worker hostname only after Access coverage is confirmed. The Access app must cover all routes, not one path.
4. **Runtime:** set `T404_ACCESS_AUD` and the operator allowlist as server-side Worker variables (never source code); deploy the reviewed V18.5.4 canary candidate to the existing V14.4 Worker with deployment snapshot and rollback.
5. **Real Access UAT:** verify unauthenticated 403, wrong account 403, approved operator canary 200, wrong AUD denied, all session/message endpoints remain 423, no CORS bypass, no direct-origin bypass.
6. **Commerce bridge:** design a dedicated server-to-server n8n read-only adapter with a new least-privilege credential and a strict allowlist for Catalog/Cart only. Existing child workflows are Execute Workflow children, not public webhooks. Do not expose the n8n API key or a privileged credential to the browser.
7. **Replay/quota:** provision a dedicated, cost-bounded Widget replay/quota binding only after backup and approval. Do not reuse unrelated V17.5E or other D1/DO resources.
8. **Store authority:** implement and independently prove Store ID mapping and store-scoped catalog/RLS before claiming Store A/B acceptance.

## 7. Approval and rollback

All hosted approval fields in `qa/channel-v1854/hosted-uat-approval-packet.json` remain **false**. No Cloudflare Worker, Access app/policy, D1, Durable Object, secret, credential, n8n Published workflow, public website, Supabase, Render, order, customer or billing change was performed.

Rollback for current work: close/revert the stacked V18.5.4 Draft PR and, if desired, archive the new inactive manual QA harness. No hosted rollback is needed because nothing was deployed.

**Checkpoint:**  
`REAL_N8N_READONLY_SANDBOX_UAT_9_OF_9_PASS / CROSS_TENANT_ISOLATION_PASS / STORE_LEVEL_RLS_NOT_VERIFIED / CLOUDFLARE_ACCESS_CONFIG_VERIFIED_NOT_RUNTIME / HOSTED_CANARY_NOT_DEPLOYED / PRODUCTION_NO_GO`.
