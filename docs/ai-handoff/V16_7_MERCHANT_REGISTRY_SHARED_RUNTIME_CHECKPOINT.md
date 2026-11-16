# TIEN404 V16.7 — Merchant Configuration Registry × Shared AI Runtime Contract

**Checkpoint:** 2026-11-16 JST.
**Stage:** SOURCE-ONLY DRAFT / SYNTHETIC NO-SEND / NO HOSTED WRITE / NO PAID AI / NO PRODUCTION.
**Strategic choice (user-approved architecture, NOT production acceptance):** one Shared AI Sales Core + separate merchant configs/data + server-attested channel→Tenant→Store + secure Commerce Gateway + common n8n orchestration.

## 1. Verified AS-IS (read-only 2026-11-16)
GitHub:
- V16.0–V16.1 PR #190: OPEN DRAFT, HEAD \`e3d704632df0a1757249f03c7b01c368ff2c9606\`; synthetic Worker/Queue 42/42 CI PASS; no cloud deployment.
- V16.3 PR #194: OPEN DRAFT, HEAD \`d50571228e052ca0cb90cab3df180a4c9e7199b0\`; branch chain from V16.2 and V16.0/1; existing FAQ Studio, Cost Center, Priority Dashboard, Human Handoff, 132-case Model A/B metadata plan. **Do not rebuild these.** New V16.7 is a stacked child of PR #194.
- Custom Bot Studio PR #117 OPEN DRAFT HEAD \`585b8cb3d37833e1aa84150bdcf0c4456771e3c4\`; existing source-only browser UI 3 shops × Messenger/Zalo Bot/Zalo OA/Widget, 4 preview flows, versioned draft. **Reference its business design; do not re-copy/rebase its divergent PR tree.**
- RPC.3 PR #186 OPEN DRAFT HEAD \`7300d9e6feaaf9d8601721bd544d73c1d36f80a0\`; independent evidence/JWT/backup/RPC revoke gating remains **NO-GO**.

n8n Cloud \`ngoctien20.app.n8n.cloud\`: accessible scan **114 workflows** (may change), no workflow was modified. Relevant exact Published versions:
- Messenger \`Z7FdV7uDvApfbURQ\` / \`d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92\` (27 nodes), sends Meta via HTTP, reads Products from Google Sheets and exposes DEMO create/manage/update tools; cannot claim merchant isolation here.
- Zalo V1 \`yIJk8LvJoLF40Z62\` / \`8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e\` NO-SEND staging. Zalo V2 Shadow \`OgDZNSAvKEvhnAvn\` / \`f00ba506-c52a-4340-9a0c-809fd9c6ea9a\` depends on legacy RPC; avoid any routing/cutover without separate approvals.
- AI SALES Main Agent \`v6PBwcqSapVzACMW\` / \`c0f04eb1-9e2b-4b42-bf70-0ce12d5b0c30\`, DEMO.
- Tenant Resolver \`5Eeh8hbpsoNhuiVo\` / \`a99c7350-7aea-446d-bdc5-4b10f52c3ad1\`: Data Tables \`Find Matching Channel\`, \`Find Tenant\`, \`Find Feature Flags\`; API authorization boundary NOT independently certified.
- Catalog Query \`oOOXicKXGkBskKqh\` / \`e0f1e345-8e6c-40cb-8e6a-d7ad2eb92696\`: calls Tenant Resolver, reads Tenant Catalog Data Table; not a verified secure public Store API.
- Create Order DEMO \`KrSn4DNR9ALX5ng4\`: Published \`4740251a-cd01-4f7f-b8e1-e300a8393151\` differs from Draft \`af9ee686-2a9f-483e-9622-6e449500ac5e\`, Google Sheets writer; no Store-scoped transaction proof.

Supabase staging project \`ifxlvrhyjhbzbrkdsida\`, PG 17.11:
- public \`tenants\`, \`tenant_memberships\`, \`products\`, \`orders\`, \`customers\` exist with RLS enabled.
- **public \`stores\` and \`store_memberships\` are ABSENT**; \`products\`/\`orders\`/\`customers\` have \`tenant_id\` but **no \`store_id\`**. Thus SAME-TENANT DIFFERENT-STORE hosted isolation is **BLOCKED**, regardless of green offline tests.
- public SECURITY DEFINER \`qa_shop_b_zalo_claim\` has \`anon EXECUTE\`; \`qa_owner_pairing\` and \`save_merchant_product\` have \`authenticated EXECUTE\`. Security Advisor WARNING, not confirmed exploit. No GRANT/REVOKE was performed.
- \`tien404_action_private\` schema not observed. Existing no-policy RLS notices in private QA schemas are not automatically exposed vulnerabilities; require independent review.
- No real Shop Owner JWT, backup/restore, channel attestation or hosted writes run in this branch.

## 2. Verified TO-BE — shared system, not a clone-per-shop model

\`\`\`mermaid
flowchart TD
 C[Messenger / Zalo / Web Widget] --> G[Trusted provider signature and channel ownership gateway]
 G --> S[Server-bound account to Tenant Store registry]
 S --> P[Merchant Profile / Bot Config Versions / Industry Profiles / Subscription]
 P --> R[Shared Fast and AI Sales Core]
 R --> F[FAQ and trusted store catalog READ ONLY]
 R --> A[Model inference only when needed; approved budget]
 R --> X[Secure Commerce capability gate: HOSTED NO-GO]
 X --> B[Store-scoped atomic order and inventory writer]
 B --> O[Durable Outbox]
 O --> N[n8n shared business orchestration: notification and reports]
 N --> Z[Provider-specific authorized send]
\`\`\`

**Important:** Do not infer identity from \`store_id\`/role in customer text. A public event must first be cryptographically verified and mapped using server-enrolled channel account; a signed, scoped, expiring replay-safe capability may then be handed to n8n. n8n cannot assume an arbitrary JSON payload came from that trusted gateway.

**Default scaling:** 1 Store = 1 versioned config + Store-isolated data + specific channel binding, **NOT** 1 cloned AI Agent / Google Sheets / n8n workflow. Retain dedicated workflow only for justified ERP / enterprise connector / SLA/security boundary and manage compatibility+rollback explicitly.

## 3. Source-only implementation and exact limits

- \`qa/v167-merchant/merchant-registry.mjs\`: zero-dependency **in-memory synthetic** registry Shop A/B SAME tenant / different Store and C separate tenant; same \`SAME01\` SKU with different SKU prices; QA channel/account mapping; restricted input schema rejects customer-injected \`store_id\`/\`tenant_id\`/\`role\`; opaque WeakSet-issued runtime scopes; entitlement check; denied Commerce; preview n8n read-only envelope; internal staff draft; independent Shop Owner approval; no automatic publish; sample per-store cost architecture.
- \`qa/v167-merchant/merchant-registry.test.mjs\`: 65 source-only negative/positive checks for Shop isolation, price scoping, role/staff support grant, subscription expiration, proposed quotas, version conflict, owner approval and production hard-stop.
- \`qa/v167-merchant/merchant-runtime-contract.json\`: machine-readable proposed shape for Merchant Profile, Bot Config, Channel Registry, Entitlements and n8n action contract.
- \`.github/workflows/v167-merchant-shared-core-nosend.yml\`: offline Node test + inherited mock regression/static no-network guard.
- This is **not an authorization implementation**. Mock channel binding and fixture actor enrollment are QA stubs, **not provider signature/JWT or authenticated Supabase entitlement**. The in-memory map cannot prove distributed concurrency, durable change history, instant token revocation, production authorization or customer-data privacy.

### Separation of responsibility / feature boundaries
1. **Platform/Gateway**: provider-specific validation, no trust in client-supplied IDs, scoped capability signing, anti-replay, credential references only.
2. **Backend database**: canonical Stores and memberships, RLS, prices/stock/orders and immutable audit, transactional outbox, import version and rollback.
3. **Merchant Setup Studio**: internal staff enrolls a Shop under a verified grant; import file / field mapping / preview; bot draft; merchant owner approval; staging QA; publish requires separately authorized gate.
4. **Shared AI Sales Core**: load approved Shop scoped bot profile, industry, catalog, knowledge version, policy and pricing; never interpret knowledge/customer text as executable tool commands.
5. **n8n**: reusable Notification, Revenue, Handoff, Integration, Order Orchestrator (after secure transactional writer approval), Subscription lifecycle. No n8n credential/token selection by LLM.

### Role and publishing matrix
| Role | Profile/config | Products | Customer PII | Host commerce writes |
|---|---|---|---|---|
| Owner | Approve and manage within Store | By approved Store perms | By purpose and lawful agreement | Only through trusted backend |
| Manager | Draft/edit authorized fields | By Store perms | Limited as approved | Only through trusted backend |
| Shop Staff | Assigned operational info | Limited | Assigned cases only | Never direct |
| TIEN404 Support | Explicit Store-scoped temporary support grant, draft only | Not by default | Never by default | Never direct |
| Platform Admin | Tenant billing/health, approve infrastructure | Not by default | Not by default | Never direct |
| Model/AI | Read bounded facts, propose preview | No untrusted direct DB | Minimized context | Never direct |
| DB backend | Verified principal and policy enforcement | Enforced | Audited | Transaction after confirmation |

Config lifecycle: \`EXPERIMENTAL → CANDIDATE → APPROVED → RELEASED\`, with immutable \`bot_version\`, \`prompt_version\`, \`knowledge_version\`, \`policy_version\`; separate Owner acceptance and QA needed before production release. **Offline \`OWNER_APPROVED_PREVIEW_ONLY\` is not RELEASED**.

### Industry setup
- Grocery: package_size, wholesale minimum, unit, public shop hours.
- Fashion: size, color, material.
- Building materials: unit/grade/bulk price, explicit units.
- Wholesale: min quantity, price tiers.
- Not a separate n8n clone for every template.
- Import Excel/CSV: map columns, detect duplicate SKU per Store, invalid VND/stock, preserve original version, owner review differences. No uploaded customer PII stored in GitHub or public QA. When a Shop edits the old local Excel **it is not automatically synchronized**; re-import or a separately authorized API sync is required.

## 4. n8n shared workflow contracts (PROPOSED, no actual Published changes)

\`T404_SHARED_N8N_ACTION_V1\` includes:
- \`event_id,event_type,tenant_id,store_id,channel,trace_ref,idempotency_key,occurred_at,entity_version,trusted_capability_ref\`.
- n8n must authenticate server-to-server issuer and signed/expiring/single-use capability. Do not accept the envelope itself as signature proof.
- output \`T404_SHARED_N8N_RESULT_V1\`: event_id, tenant/store, status, effect_receipt_ref, safe_error_code, trace_ref.
- All external sends must be driven by verified outbox events AFTER authoritative commit. No duplicate order writing on n8n retry.
- Catalog/FAQ without required orchestration should bypass n8n to reduce execution quota.
- The existing n8n Tenant Resolver/Catalog Query are candidate nodes to **audit and possibly adapt**. Do not route new real Shop traffic to them before Store RLS/JWT and credential mapping proof.
- Do not connect v16.7 simulated read-only envelopes to live n8n.

Workflow library proposed: Commerce Order Orchestrator, Inventory Events, Merchant Notification, Revenue Reports, Customer Support, Channel Adapter, External POS/ERP Sync, Subscription Automation. All shared, except approved high-complexity exceptions.

## 5. Commercial n8n license — NOT CLEAR FOR THIS CLOUD SUBSCRIPTION

Official pages checked:
- https://support.n8n.io/article/can-i-use-your-license-for-my-use-case (updated Oct 6 2026): self-hosted SUL differs from n8n Cloud; clients configuring automation via their own SaaS UI can require Enterprise/commercial license.
- https://n8n.io/legal/eula/ (effective Aug 27 2026): embed use depends on the applicable **Order Form**, not just a public-tier price listing; public EULA includes restrictions on exposing workflow/editor interfaces to customers.
- https://n8n.io/pricing/: Starter €20 monthly annual billing / 2.5k executions / 1 shared project / 5 concurrent; Pro €50 / 10k executions / 3 shared projects / up to 50 concurrent; Enterprise custom. ALL include unlimited workflows, **not unlimited executions or legally unlimited client SaaS hosting**.

**Action gate:** get direct n8n written clarification to \`license@n8n.io\` / Sales about TIEN404 staff configuring bots, Merchant Studio editable business fields, end-customer access/no access to workflow designer, use of customers' Messenger/Zalo/POS credentials, and per-Store instances. Until written confirmation or contract granted: \`COMMERCIAL_LICENSE_REVIEW_BLOCKED\`.

## 6. Illustrative unit economics — NOT real invoices or capacity certification

Hypothesis: 1,000 customer messages/Shop/month, 10% of incoming messages invoke one billable n8n workflow; no internal child-workflow, retry, scheduled import or report charges included. Workloads:

| Stores | Incoming messages/month | Naive n8n per-message executions | 10% shared n8n invocations | Hypothetical 6 workflows/Store clones |
|---:|---:|---:|---:|---:|
| 1 | 1,000 | 1,000 | 100 | 6 |
| 5 | 5,000 | 5,000 | 500 | 30 |
| 20 | 20,000 | 20,000 | 2,000 | 120 |
| 50 | 50,000 | 50,000 | 5,000 | 300 |
| 100 | 100,000 | 100,000 | 10,000 | 600 |
| 500 | 500,000 | 500,000 | 50,000 | 3,000 |

Shared orchestration lowers executions *only if actual events stay on the fast path*; merely replacing 500 cloned flows with one shared flow does **not** reduce executions for the same traffic. Concurrency, provider limits, Queue backlog and data isolation still must be separately measured.

COGS per Shop: provider AI calls/tokens + (Workers/Queues/DO) + n8n executions + data/storage/backups + onboarding/staff + support + billing/tax overhead. Proposed Economy, Standard and Priority must have server-enforced quota and cost guard; QA synthetic tier 1/2/5 concurrent and 5/15/30 events/min are **not production capacity metrics**. Prior V16.3 Cost Center is in-memory only; real hard budget requires an atomic persistent reservation.

## 7. Security and data ownership / DB gating

Current Supabase has Tenant-level RLS enabled but **not Store-scope columns** in products/orders/customers. Do not assume Shop A/B same tenant denial has been proven. Proposed hosted schema must reconcile existing \`tenant_memberships\` and avoid exposing new fields with broad grants; a reviewed Store membership model and real JWT auth + cross-store negative tests are prerequisites before Commerce. Do not copy synthetic Shop IDs into hosted.

Critical gates:
- P0 public \`qa_shop_b_zalo_claim\` anonymous SECURITY DEFINER EXECUTE review, external caller inventory and separate signed revoke approval.
- P0 hosted Shop Owner A/B real JWT authorization, same Tenant cross-store denial, revoked session, controlled staff support grant.
- P0 backup + restore proof, validated rollback, idempotent order/stock state and no dual writers.
- P0 provider signed message ingress, genuine Page/OA owner proof, per-channel credentials and user consent.
- P0 n8n SaaS license permission and Vietnamese personal-data obligations before customer import.
- P1 API model A/B 132-case quality actual outputs, low-cost FAST/PRIORITY cost/capacity and delivery evidence. The 96+36 cases **are NOT equivalent to 132 passed quality tests**.

Supabase docs RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
Security Advisor RPC: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable

## 8. QA, release and rollback gates

QA acceptance for this branch: 65 direct synthetic registry tests, existing V16 Hybrid tests and source-only offline code checks; no actual paid API, hosted storage, Webhook published edit, Meta/Zalo Send or n8n run. Check the **exact Git SHA Actions** before declaring TESTED. NO Green CI = proof of hosted security.

Future real acceptance:
- Shop A/B same Tenant, SKU same name different price, no cross store read/write; Shop C other tenant.
- Owner/manager/support role scopes and temporary support grants, no admin overreach.
- Owner confirmation recorded but does not auto promote without QA and independent release approver.
- Subscription expiry and reauth invalidate all cached scopes.
- No cross-shop memory/knowledge, credential selection, or model prompt injection.
- Atomic idempotent order effect and exactly-once per signed customer confirmation; retries via durable inbox/outbox.
- Future n8n runtime should report actual executions and cost per store; no benchmark claim without sampled deployment.

**Rollback now:** close child Draft PR V16.7 or revert its additive QA/docs/CI files. Upstream V16.3 PR #194, V16.0/1 #190, V14.7 #117 and RPC.3 #186 all unchanged. No hosted rollback because no hosted resource changed.

### Next — V16.8 (PROPOSED)
- Integrate the registry contract with V16 Fast Router in **isolated synthetic** API tests, not real provider webhooks.
- Reuse the V14.7 Studio UI as optional design reference; avoid merging divergent Draft branches blindly. Build a portable Merchant Setup Studio screen with explicit grant/Owner review and file mapping preview (no real storage).
- Add Shop memory isolation / subscription invalidation / concurrent QA worker replay.
- Prepare Store-migration **DO NOT APPLY** review with independently verified caller/backup/restore security reviewers.
- Get n8n written license response and exact merchant data processing/retention agreement, before any commercial pilot.

**Source status for this iteration:** VERIFIED read-only GitHub/n8n/Supabase, IMPLEMENTED synthetic Registry source, TESTED pending exact-head CI, BLOCKED hosted Store/JWT-RLS, external API credentials, Commerce production and license acceptance.
