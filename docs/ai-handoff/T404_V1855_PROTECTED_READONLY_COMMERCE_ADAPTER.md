# TIEN404 AI — V18.5.5 Protected Read-Only Commerce Adapter

**Date:** 18/11/2026 JST  
**Status:** INTERNAL ADAPTER AND INACTIVE HEADER AUTH INGRESS IMPLEMENTED; 12/12 ADAPTER QA + 5/5 WEBHOOK-PIN QA; REAL HTTP AUTH AND HOSTED CONNECTION BLOCKED.  
**Release:** CANDIDATE — NO PRODUCTION.

## 1. Objective and continuity

V18.5.5 continues V18.5.4 and reuses the existing Commerce Core child workflows. It does not create a second AI Sales Core. The full Commerce AI Agent is intentionally excluded because its tool graph can reach a support-ticket writer; this phase calls only the Published Catalog Query and Cart Preview children.

The V18.5.4 owner Access runtime remains verified; alternate-identity denial is pending. V18.5.5 now contains a new inactive credential-bound webhook ingress; the V18.5.5 Worker remains source-only and is not deployed.

## 2. Actual n8n implementation

### Internal Adapter Core — IMPLEMENTED

- Workflow: `TIEN404 V18.5.5 Protected Read-Only Commerce Adapter`
- ID: `rYwrJfJavcaZcjUI`
- Personal project, folder: `03_TIEN404_COMMERCE - PRODUCT / 01_CORE - ENGINE`
- Version: `7e72477e-ab8e-4176-a6c1-4277e5e2c538`
- Active: **false**; Published: **no**.
- Trigger: internal Execute Workflow Trigger only. No public Webhook.
- Caller policy: `workflowsFromAList`; only QA `At2msGSDpmJ1GvnK` and inactive staging ingress `JZL4p8tLb65eU3aB` are allowed.
- No credentials, AI Agent, HTTP Request, provider send, order writer, stock writer or customer-order reader.

### Trusted installation mapping

The adapter accepts only two fixed Sandbox installation IDs and maps them server-side:

| Installation ID | Trusted channel | Server-side account |
|---|---|---|
| `v1855-materials-sandbox` | website | `demo-materials-website` |
| `v1855-grocery-sandbox` | website | `demo-grocery-website` |

The caller cannot supply `accountId`, `channelType`, `tenantId`, `storeId`, `customerId` or `orderId`. Any such authority fields are rejected. The browser never selects a tenant/store directly.

### Permitted operations

- `catalog.search` → existing Published Catalog Query.
- `cart.preview` → existing Published Cart Preview.

All other operations, including private order reads, order creation, updates, cancellation, payments and support-ticket writes, are denied.

The adapter validates request IDs, a 60-second timestamp window, catalog query length/limit, cart size, SKU format, quantity bounds and duplicate SKUs. Cart output is always preview-only with `canConfirm=false` and `canWrite=false`.

## 3. Real n8n QA — VERIFIED

QA workflow:

- `TIEN404 V18.5.5 Protected Read-Only Adapter QA`
- ID: `At2msGSDpmJ1GvnK`
- Folder: `90_QA - DIAGNOSTICS`
- Active: **false**; Published: **no**.
- Main manual execution: **5360**, status **success**.

**12/12 assertions passed.** The harness made five real calls into existing Published read-only child workflows: three Catalog Query executions and two Cart Preview executions. All five child executions succeeded.

| Test | Result |
|---|---|
| Materials Catalog — VL-101 | PASS |
| Materials Cart — 3 × VL-101 = 237,000 VND | PASS |
| Grocery Catalog — TG-101 | PASS |
| Grocery Cart — 2 × TG-101 = 9,000 VND | PASS |
| Materials cannot retrieve grocery SKU | PASS — 0 products |
| Forged Tenant/Store/Account authority | PASS — rejected |
| Unknown installation | PASS — rejected |
| Private order read | PASS — rejected |
| Order creation | PASS — rejected |
| Invalid cart JSON | PASS — rejected |
| Stale timestamp | PASS — rejected |
| Duplicate cart SKU | PASS — rejected |

The existing Published child versions were read-only DataTable `row.get` paths. Side effects observed/allowed by this harness: 0 order writes, 0 stock writes, 0 provider sends, 0 customer-order reads, 0 customer PII reads, 0 AI calls.

Evidence: `qa/channel-v1855/n8n-adapter-qa-evidence.json`.

## 4. Worker Gateway candidate — SOURCE ONLY

Candidate file: `qa/channel-v1855/worker-v1855-readonly-adapter-candidate.mjs`.

It preserves the V18.5.4 native Cloudflare `ctx.access` gate on every route and adds a candidate POST route:

`POST /v1/widget/commerce/read`

The Worker:
- accepts only the two fixed installation IDs;
- accepts only Catalog Search and Cart Preview;
- rejects client authority fields and unexpected request properties;
- bounds request/response payload size;
- creates a server-side request ID and timestamp;
- sends only installation ID, operation and sanitized query/cart to n8n;
- requires the n8n response to explicitly assert Sandbox/read-only/no-order/no-write flags;
- rejects upstream responses that contain tenant/store/customer/order data or missing safety flags;
- allows only HTTPS to the exact n8n Cloud hostname and a `/webhook/*` endpoint;
- sends the server-side `x-t404-adapter-token` header.

The Worker candidate is **not deployed**. No n8n URL or token binding has been set. The current V14.4 deployment remains V18.5.4 and the Commerce endpoints remain locked.

Unit tests: `qa/channel-v1855/worker-v1855-readonly-adapter.test.mjs`.

## 5. Explicit blockers and limitations

### VERIFIED CREDENTIAL METADATA — live HTTP authentication STILL BLOCKED

The user created dedicated credential `TIEN404_V1855_READONLY_ADAPTER_AUTH_STAGING`, type `httpHeaderAuth`, ID `IS2XrqEFUDv7aGsh`. Its metadata and exact binding to the new inactive webhook were verified. The credential secret was neither accessed nor exported. The expected HTTP header is `x-t404-adapter-token`, but its actual name/value cannot be independently inspected from the metadata connector; a genuine authorized HTTP negative/positive test is required before publishing.

Cloudflare Worker would need a separate `T404_N8N_READONLY_ADAPTER_TOKEN` secret containing the same private value and `T404_N8N_READONLY_WEBHOOK_URL` pointing to the staging webhook. Neither Worker binding exists at this checkpoint. Do not send any secret through ChatGPT, GitHub, or screenshots.

### BLOCKED — hosted integration

The dedicated credential and inactive Webhook ingress have now been created and tested with pinned Webhook inputs; real authentication over HTTP is NOT tested. Prior to any activation, verify second-identity Access denial, configure a safe durable replay/quota gate and approve a bounded staged test and rollback. Only after those gates should the owner manually set the identical Worker secret/URL using a trusted UI, and a reviewed V18.5.5 Worker version be deployed.

### NOT VERIFIED — Store A/B RLS

V18.5.4 and V18.5.5 prove cross-tenant Sandbox isolation for two separate tenant records. They do not prove same-tenant Store A/B isolation or database Store-level RLS. Do not claim Store-level isolation.

### SOURCE IMPLEMENTED, NOT DEPLOYED — durable replay and rate limiting

The internal adapter still validates timestamp freshness. New source-only code under `qa/channel-v1855/` requires an atomic, SQLite-backed Durable Object admission gate before forwarding to n8n. The proposal limits each of the two Sandbox installations to 20 accepted read requests in a rolling 60-second window and rejects reuse of the same server-generated request ID within that window. The Worker fails closed with HTTP 423 when the binding is absent, and HTTP 503 on admission service/storage errors. This is not a public customer security guarantee: independently generated requests have new IDs, and Store-level authorization remains blocked. No Durable Object namespace, migration, binding or deployment has been created.

## 6. Safety and release decision

- No n8n Published workflow was changed.
- A new dedicated staging Header Auth credential was created by the owner and connected to the inactive ingress; its value was never read, exported or shared. No other credential was modified.
- No Cloudflare Worker deployment or binding was changed.
- No website, Supabase, Render, billing, Messenger or Zalo production changes.
- No customer/order/PII reads, order writes, stock writes or provider sends.

**Decision:** `V18.5.5_INTERNAL_ADAPTER_AND_HEADER_AUTH_INGRESS_IMPLEMENTED / N8N_SANDBOX_QA_12_OF_12 / INGRESS_PIN_QA_5_OF_5 / REAL_HTTP_HEADER_AUTH_NOT_VERIFIED / WORKER_NOT_DEPLOYED / STORE_RLS_NOT_VERIFIED / PRODUCTION_NO_GO`.

## 7. Next approval required

The credential is already created and bound to an inactive workflow. **Next approval** is for a tightly scoped real Header Auth HTTP UAT and, separately, adding the matching Cloudflare Worker secret and URL binding. These are NOT implied by credential creation. The public Widget and production remain disabled.


### CI regression wiring

The V18.5.5 QA workflow is also present on the stacked V18.5.4 base branch so GitHub can execute it for this draft pull request. It runs the inherited security regression suite plus the new Worker adapter tests and verifies the real n8n evidence packet. This is CI-only; it does not activate or deploy the adapter.


## 8. Source CI checkpoint

GitHub Actions run [#44271092019](https://github.com/ngoctien20/demo-git/actions/runs/44271092019) executed **119 tests: 119 passed, 0 failed, 0 skipped**, including the new Worker candidate tests and inherited security regressions.

The overall job then failed in the separate evidence assertion step because the assertion expected the Tenant Resolver to appear as a direct child execution. The real execution lineage shows it is invoked inside the Catalog Query and Cart Preview child workflows. This was an evidence-schema/CI assertion mismatch, not a failing adapter or Worker unit test.

The evidence packet and CI assertion were corrected, and subsequent workflows did run successfully. The current source code checkpoint is **GitHub Actions #44281190151: 141/141 PASS, 0 fail, 0 skipped**, at commit `eb535d491f0981d9d06296e3e6ba3bb489a932a8`. Later documentation/checkpoint commits must be re-verified separately before calling the latest HEAD fully green.

Current code/test status: `GITHUB_SOURCE_CI_141_OF_141_PASS_AT_VERIFIED_SHA / N8N_MANUAL_UAT_12_OF_12_PASS / INGRESS_PIN_QA_5_OF_5_PASS / LIVE_HEADER_AUTH_AND_DURABLE_OBJECT_RUNTIME_NOT_TESTED`.


## 9. Inactive Header Auth Webhook ingress — IMPLEMENTED / PIN-TESTED

**New n8n workflow**: `TIEN404 V18.5.5 — Header Auth Read-Only Webhook Ingress STAGING`, ID `JZL4p8tLb65eU3aB`. Personal project → `04_TIEN404_WEBSITE - MARKETING`. 7 nodes, version `5e5b87b2-1dcc-48c9-aa72-98c7866a12f3`. `active=false`, `activeVersionId=null`, **not Published**. Webhook path `t404-v1855-protected-readonly-commerce-staging`, method POST, `authentication='headerAuth'`, response mode `responseNode`. This path is not a live public endpoint.

**Credential binding:** User-created `httpHeaderAuth` credential `IS2XrqEFUDv7aGsh`, name `TIEN404_V1855_READONLY_ADAPTER_AUTH_STAGING`. n8n's SDK auto-assignment initially selected unrelated `Header Auth account`; this was immediately replaced with the exact intended credential via `setNodeCredential`, before any test or activation. A fresh read-back verified the correct credential ID and name. No actual secret value was retrieved.

**Security settings:** Save success/error execution data = `none`, save manual executions = false, save execution progress = false, 15s timeout, caller policy = none. This is deliberate because Webhook trigger outputs could contain authentication headers. Internal Adapter caller allowlist was expanded only to `At2msGSDpmJ1GvnK,JZL4p8tLb65eU3aB`.

**Seven nodes:** Header Auth Webhook → Validate Ingress Envelope → Allowlist IF → (True: call the restricted internal adapter → enforce safe readback → respond JSON) / (False: respond denied JSON). The Code nodes reject caller-supplied authority fields, unknown installations, invalid cart, stale requests, bad methods, and unsafe readbacks. Response output is constrained to Sandbox catalog or cart fields, never customer/tenant/store/order data. No AI Agent, Order Writer, provider dispatcher, or outbound HTTP request node was added.

**Five Pin-Data tests (no HTTP auth):** execution IDs `5383` (order-create denied), `5384` (catalog), `5388` (cart), `5392` (forged tenant), `5393` (unknown installation), all status **success**. The pinned trigger bypasses real network Header Auth. During catalog/cart tests, the existing read-only child workflows ran and returned successful integrated executions: Catalog `5386`, Cart `5390`. Since successful ingress data is intentionally not stored, the individual inbound responses cannot be independently read back through the execution API. Do NOT claim genuine Header Auth 401/403 negative or real remote HTTP success.

**Offline source test:** `qa/channel-v1855/n8n/ingress-contract-offline.test.cjs` runs selected n8n Code-node validators with synthetic request/readback fixtures, including tenant injection, order operations, malformed carts and nested unknown attributes. It does not authenticate against n8n over the network.

**Cloudflare cross-check:** Existing V18.5.4 Worker deployment remains `b4f501e0-ff37-4ea4-be77-6e3148667b15`, with only `T404_ACCESS_AUD` and `T404_QA_OPERATOR_EMAIL` bindings; no new n8n secret/URL and no V18.5.5 Worker deployment. Access audit still has one approved owner login, not an alternate-identity denial.

**Rollback/checkpoint:** Restore the Adapter's previous caller allowlist (QA only), archive the new inactive ingress, and revert the stacked Draft PR changes if necessary. Do not touch Commerce Published workflows or customer data. Preserve credential only if still independently needed; removal would require separate approval.

**Current NO-GO gates:** real Header Auth HTTP UAT, Cloudflare second identity denial, actual Store A/B RLS, durable replay/rate limiting, staged Worker secret and new deployment approval, and complete Website Widget end-to-end testing.


## 10. Rolling quota and replay admission — SOURCE CANDIDATE (NOT DEPLOYED)

### Files and authoritative flow

- `qa/channel-v1855/read-admission-policy.mjs`: pure policy evaluating 20 accepted requests / rolling 60 seconds / approved Sandbox installation, strict v4 request ID format, timestamp freshness and replay denial.
- `qa/channel-v1855/t404-read-admission-do.mjs`: Cloudflare SQLite Durable Object `T404ReadAdmission`; uses a single private SQLite row and `ctx.storage.transactionSync()` so concurrent check + update are atomic. It verifies the actual named DO instance matches the requested installation; wrong instance is denied.
- `qa/channel-v1855/worker-v1855-hosted-entry.mjs`: future bundle entrypoint exporting the Worker and Durable Object class; **not configured for deployment**.
- `qa/channel-v1855/worker-v1855-readonly-adapter-candidate.mjs`: before any n8n outbound fetch, requires the `T404_READ_ADMISSION` binding and `authorizeRead` response. Missing binding returns 423, unavailable/corrupted admission returns 503, same request ID returns 409, exceeded rate returns 429. Validates exact upstream path `/webhook/t404-v1855-protected-readonly-commerce-staging` on the exact n8n host and accepts only HTTPS. Product attribute values are bounded primitive types; arbitrary nested objects are omitted.

The design follows Cloudflare's SQLite Durable Object transactional storage guidance:
- https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/
- https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
- https://developers.cloudflare.com/durable-objects/platform/pricing/

### VERIFIED source QA

GitHub Actions [#44281190151](https://github.com/ngoctien20/demo-git/actions/runs/44281190151), source commit `eb535d491f0981d9d06296e3e6ba3bb489a932a8`: **141/141 tests passed**.

Coverage includes existing security regression; three new Worker admission fail-closed tests; ten pure admission policy tests for 20/minute rolling quota, replay, stale/future request timestamps, invalid installations/operations, unchanged state on denial, stale records pruning, and no PII persistence.

This is source-level validation using simulated Cloudflare DO bindings and policy state. It does NOT prove real Cloudflare SQLite transaction runtime, Access denial for a second account, actual n8n Header Auth, end-to-end Widget, or Store A/B RLS.

### Required owner approval / rollout gates

1. Independently verify denied alternate identity under the existing exact-host Access app.
2. Review Durable Objects usage limits and pricing for the existing Cloudflare account. A *new* SQLite-backed DO namespace/migration and `T404_READ_ADMISSION` binding require explicit owner approval before any account mutation.
3. Approve a tightly scoped staging Header Auth negative/positive HTTP UAT; do not reveal shared secrets or change credential values without owner action.
4. After HTTP authentication and rate/replay gates are independently tested, the owner can set the matching n8n token secret and verified exact URL on the Worker through a trusted UI; no secret values should appear in chat, GitHub, executions, screenshots or browser-side code.
5. If deployment is later approved, perform versioned backup, private 1-operator canary, real negative tests, rate/replay concurrency tests, a rollback rehearsal, and only then consider a staging QA session. Keep the public customer widget and production disabled.

### Rollback / zero-change checkpoint

**No Cloudflare Durable Object namespace, binding, Worker secret, Worker upload, or deployment is changed in V18.5.5 source work.** The currently deployed V18.5.4 Worker version `da022974-1832-425f-bf82-afddc558b893` / deployment `b4f501e0-ff37-4ea4-be77-6e3148667b15` remains the untouched rollback target.

If the source candidate is rejected, revert this Draft PR branch. Do not delete any shared credentials, data, Store mappings or published Commerce workflows. If a DO namespace is created at a later approved stage, resource deletion would be a separate approval gate.

**Checkpoint:** `V1855_INACTIVE_HEADER_AUTH_INGRESS_VERIFIED / INTERNAL_CATALOG_CART_READONLY_TESTED / ATOMIC_ADMISSION_SOURCE_141_OF_141_PASS / NO_DO_BINDING / NO_WORKER_DEPLOY / NO_REAL_HTTP_AUTH / NO_STORE_RLS / PRODUCTION_NO_GO`.

## 11. B2 — Existing Durable Object reuse audit × source-backed transaction QA

**Date:** 18/11/2026 JST. **Scope:** Cloudflare account READ-ONLY, Draft PR #415 source-only. No namespace, binding, secret or Worker deployment created.

### VERIFIED — existing namespaces are specialized

A direct Cloudflare inventory returned three staging Durable Object namespaces: one V17.5 ReplayBucket with an atomic claim(nonceDigest, expiresMs) nonce API, one RunnerResults QA state class, and one ZaloBotReplayBucketV2 for Zalo replay. These are not general-purpose request-quota services. Do **not** silently reuse or modify them: doing so would cross separate security domains and rollback paths. See the exact inventory and deployment snapshot in the source-only resource preview at qa/channel-v1855/do-admission-resource-preview.json.

### Security issue fixed

The earlier pure read-admission policy silently discarded malformed quota ledger records, potentially resetting limits after state corruption. It now **fails closed with 503** for oversized, duplicated, malformed, future-dated, or unexpected persisted state, rather than accepting additional requests.

### Real class body, simulated SQLite: 30 concurrent requests

A new test suite at qa/channel-v1855/t404-read-admission-do.test.mjs executes the *actual T404ReadAdmission class body* with an in-memory SQL storage shim. The tests verify that 30 simultaneous requests result in **20 admitted + 10 rejected**, with only 20 SQL writes; that two Sandbox installations have independent ledgers; and that wrong DO names, duplicate UUIDs and corrupt JSON are rejected without clearing state. No customer, Store, token or PII data is persisted by this source simulation.

**Limitation:** Node.js with a fake storage shim is not a real workerd/Cloudflare SQLite Durable Object runtime; hosted concurrency, cost, and failure behavior remain unverified.

### VERIFIED GitHub CI

[GitHub Actions #44293653962](https://github.com/ngoctien20/demo-git/actions/runs/44293653962) — **154/154 tests PASS, 0 failed, 0 skipped**, at source commit 3af181d3750b14b25eccf6b6b102c61e85506f74. The existing manual n8n read-only UAT 12/12 and pinned ingress QA 5/5 remain their prior evidence, not rerun hosted tests in this stage.

### Cost and deployment preview

The quota proposal accepts at most 20 reads per rolling minute per Sandbox installation. With two installations, continuously saturated accepted traffic could reach **57,600 reads per 24 hours**. Failed/denied DO RPC attempts are not covered by that accepted-read ceiling and may incur billable resource use. The current account subscription and shared remaining allowance have not been verified; do not assume free usage.

Official Cloudflare reference: https://developers.cloudflare.com/durable-objects/platform/pricing/

Suggested future dedicated binding: T404_READ_ADMISSION, class T404ReadAdmission, SQLite migration under the existing Worker. **This is a proposal, not an applied migration.**

### Remaining protected gates

An explicit owner approval is required for a new metered SQLite-backed Durable Object namespace/migration, Worker binding, private deployment, secret setup, and live Header Auth HTTP test. Founder-only Access negative-identity evidence is still missing; same-tenant Store A/B RLS is NOT VERIFIED. The current Sandbox installation identifier must not be treated as public customer Store authority without a trusted server-side Store mapping.

No change to the deployed V18.5.4 Worker version da022974-1832-425f-bf82-afddc558b893, deployment b4f501e0-ff37-4ea4-be77-6e3148667b15. If this source candidate is rejected, revert Draft PR #415; do not delete any existing namespace or shared data.

**Gate:** VERIFIED_EXISTING_DO_SPECIALIZATION / DO_SIM_30_CALLS_20_ADMIT_10_DENY / SOURCE_QA_154_OF_154 / NO_ACCOUNT_WRITES / DO_RUNTIME_NOT_TESTED / COST_APPROVAL_PENDING / PRODUCTION_NO_GO.

## 12. V18.5.5-B4 — Resource-only approval × isolated Worker lifecycle gate × local workerd QA

**18/11/2026 JST.** User confirmed continuation after the explicit question on creating one SQLite Durable Object staging resource, with the prior scope excluding any Worker deployment, webhook publication, secret change or production release.

### Constraint verified against Cloudflare documentation

Cloudflare's current Durable Object lifecycle documentation requires a **Worker deployment** when a new Durable Object class/namespace is created. Merely uploading a version does not apply lifecycle changes. Rollback cannot cross the class lifecycle migration.

References:
- https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/
- https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/with-durable-objects/
- https://developers.cloudflare.com/durable-objects/get-started/

As the user's approval explicitly excluded Worker deployment, **no namespace/class was created**. It would be incorrect to interpret a resource-only approval as authorization for a Worker lifecycle migration.

### Verified alternative: isolated workerd SQLite tests in GitHub Actions

Added test-only local integration under qa/channel-v1855/runtime-qa/, using @cloudflare/vitest-plugin v1.6.0 and Vitest 4 in the actual **workerd** runtime. The local Durable Object binding is entirely inside the GitHub runner; no Cloudflare account credentials or API calls are used.

- [CI #44313831943](https://github.com/ngoctien20/demo-git/actions/runs/44313831943): source regression 154/154; **3 workerd SQLite DO tests pass**.
- [CI #44314497533](https://github.com/ngoctien20/demo-git/actions/runs/44314497533): source regression 154/154; **4 workerd SQLite DO tests pass**, including a new Durable Object eviction/recovery test proving the duplicate request ID is still rejected after eviction.
- [CI #44315019317](https://github.com/ngoctien20/demo-git/actions/runs/44315019317): **both jobs SUCCESS**, 154/154 existing regression plus 4/4 real local workerd SQLite checks, including eviction, replay, 30-request concurrency, and cross-installation denials. Current code after evidence updates must be checked again at exact HEAD.
- These tests exercise actual Cloudflare Worker runtime compatibility locally, including real SQLite storage semantics; they do not measure hosted Cloudflare costs, performance, production worker uploads or authenticated HTTP ingress.

Earlier test-only CI runs failed because of a non-existent @cloudflare/vitest-plugin version (0.16.x) and an npm resolver error; these were resolved by pinning published v1.6.0 and using the runner's Yarn installation.

### Isolated owner Worker proposal (not deployed)

To avoid making the already-running V18.5.4 Widget Worker cross an irreversible Durable Object lifecycle change, the safer future architecture separates the DO class lifecycle into a dedicated **non-public Worker**:

- Proposed isolated class owner: tien404-v1855-read-quota-isolated-staging.
- Source candidate: qa/channel-v1855/isolated-do-owner-candidate.mjs (returns 404 on any public fetch request).
- Future Widget binding: T404_READ_ADMISSION, class T404ReadAdmission, script_name = tien404-v1855-read-quota-isolated-staging.
- Public routes: none, workers.dev: disabled, preview URLs: disabled.
- The proposal and prohibitions are captured in qa/channel-v1855/isolated-do-provisioning-gate.json.

Creating this owner Worker and applying the SQLite class migration **would be a new Worker deployment** and therefore needs a **separate explicit approval**. Later adding the binding to the existing Widget Worker would also require independent deployment approval.

### Budget and Access audit

Cloudflare Billing subscriptions and spend-policy endpoints returned **HTTP 403** under the current read-only connector permission. Therefore the Cloudflare plan, current quota and spending controls are **NOT VERIFIED**, and we cannot claim zero cost for any future hosted deployment. The current three specialized DO namespaces remain unchanged.

V18.5.4 private Worker version da022974-1832-425f-bf82-afddc558b893 and deployment b4f501e0-ff37-4ea4-be77-6e3148667b15 are still the safe rollback checkpoint. Production, public Widget, n8n Published webhook, and private Store A/B RLS remain blocked.

### Decision

**Local workerd ACCEPTED for source/runtime preflight; hosted DO namespace CREATE is BLOCKED by the no-deploy boundary.** No Cloudflare account mutation, secret read, webhook publication, customer-data change, order write, provider send or production release occurred during B4.

**Checkpoint:** V1855_B4_LOCAL_WORKERD_SQLITE_4_OF_4 / SOURCE_QA_154_OF_154 / ISOLATED_OWNER_PREVIEW_ONLY / NO_DO_NAMESPACE_CREATED / WORKER_DEPLOYMENT_UNAPPROVED / COST_ACCOUNT_UNKNOWN / PRODUCTION_NO_GO.
