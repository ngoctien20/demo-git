# TIEN404 AI — V17.1N Independent Messenger/Core Guarded Shadow × PG17 Two-Store Transaction × Provider Authority

Date: 2026-11-17 JST
Scope: staging only; all Commerce customer/merchant data, billing, Meta/Zalo production provider, credential, and active n8n workflows untouched.
Parent: V17.1M GitHub Draft PR #277 head 94ce2688ea55e65e6b95d8ba4fe70a1061f90de4.

## 1. V17.15 exact owner/diff reconciliation — VERIFIED, NO EDIT

Read n8n published Messenger workflow Z7FdV7uDvApfbURQ.
- Published version 2b869035-fe39-46fb-a253-18fefe4ecbfd (32 nodes, active).
- Newer draft version 1064b1b3-d3f1-4a6b-a367-2414ba691522 (V17.17; NOT active). Source author for both versions reported as 'Võ Ngọc Tiến (via MCP)' in n8n version history. This is provenance, NOT an approval attestation.
- Diff from V17.13 ff7a57d2-519a-4283-933c-37a854df92d2 to V17.15: FOUR node ADDITIONS and ZERO node REMOVALS:
  V17.15 Route QA_CORE Only?;
  V17.15 Strip PII and Normalize Demo Query;
  V17.15 Call Actual Commerce Core Read-Only;
  V17.15 Assert Demo Reply Safe to Send.
  Connections were additive with a route insertion; the old direct loop->AI Agent edge was replaced by route->AI Agent. The V17.15 nodes themselves were NOT deleted.
- V17.17 draft only modifies parameters of V17.15 Strip PII and Normalize Demo Query. It remains unmerged/unpublished and must not be overwritten.
- Actual Messenger LIVE contains Meta signed webhook, OpenAI model, demo order tool workflows, Messenger Reply HTTP, dedup DataTable. NEVER copy credentials or any live send/write/AI node into manual shadow.

## 2. Shadow adaptation — IMPLEMENTED AND VERIFIED

New n8n workflow:
https://ngoctien20.app.n8n.cloud/workflow/99eZrseGb4d650at
Workflow ID: 99eZrseGb4d650at
Name: TIEN404_V171N_MESSENGER_CORE_SHADOW_TOOL_AUTH_NO_SEND
Verified version: 4635bed6-a274-4f8a-902b-0bbd39aa9221
Location: Personal project, folder 90_QA - DIAGNOSTICS.
Status: INACTIVE, no Published version.
Graph: exactly 7 nodes (one Manual Trigger, SIX Code nodes). No webhook, credentials, HTTP, DB/DataTable, Core workflow invocation, LLM/model or provider reply node. CallerPolicy none, executionTimeout 60 seconds.
Groups: Trusted Channel and Store admission; V17.15 source-derived Commerce Core shadow.

This is a **source-derived functional shadow replica**, not a verbatim imported copy of all 32 live Messenger nodes, nor a real call to the Commerce Core. Names of V17.15 stages are included for contract mapping, but original four published nodes and newer V17.17 draft are NOT modified.

Stage order:
1. Generate wholly synthetic Messenger/Zalo Store A/B messages signed using explicitly fake in-memory QA keys.
2. Separate trusted-installation/Store authorization + signature algorithm preflight (Meta SHA256 HMAC, Zalo documented SHA256 appId+JSON+timestamp+OA QA synthetic variant), deny non-MODEL_PROPOSAL contexts, forged Store/role, duplicate messages, stale events, invalid scope, price, order ownership, and writes/sends.
3. V17.15 source-derived normalization receives only authorized fake SKU query, never raw customer data; is not a claim that the original Code node itself ran.
4. Core stage plans safe fake product reads; actual commerce reader is NOT connected.
5. V17.15 source-derived demo reply contract is checked but no Send path is present.
6. Independent release assertion: all simulated calls 0 actual provider sends, model calls, Commerce reads/writes; real hosted release flag remains NO-GO.

### Hosted manual executions

- Execution 4947: initial 140/140 synthetic PASS.
- 4948: generator expanded with four real replay negative fixtures to 144, gate's length contract remained 140; intentionally failed closed at preflight. A QA source test mismatch; no exposure or provider send.
- 4949: 144/144 PASS after exact 144 expected length fixed.
- 4950: final hardened source 144/144 PASS, 132 denied, 8 simulated READ plans, 4 simulated customer-confirmed proposal plans. Additional forged top-level tenantId/storeId/admin/role/app ID claims are rejected. All real provider sends, database reads/writes and AI invocations remained zero.

The Code snapshot saved in GitHub is synthetic and contains only fake QA keys. These are NOT Meta App Secret, Zalo OA secret, staff tokens, customer PII or credentials.

## 3. Actual provider signature evidence — PARTIAL, DO NOT OVERCLAIM

Read-only inspection of four historic LIVE Messenger executions from the existing n8n node Verify Signature Timing-Safe:
- 4762 verified=true
- 4754 verified=true
- 4746 verified=true
- 4544 verified=true
These are **real node return values**, demonstrating that the current workflow's HMAC decision was true; do not claim that this investigator independently used the provider App Secret, that the original Meta Page/owner was independently proven, or that a real no-send signed callback reached this new shadow.
Meta official docs confirm X-Hub-Signature-256 and raw-payload HMAC-SHA256. Existing Messenger Webhook1 has rawBody enabled and the timing-safe compare Code node uses crypto.timingSafeEqual. Credential content was NOT accessed.
Meta docs: https://developers.facebook.com/docs/graph-api/webhooks/getting-started/

Zalo official OA docs specify X-ZEvent-Signature with SHA256(appId + data + timestamp + OAsecretKey) for documented webhook events; algorithm differs from Meta HMAC. Only QA fake signatures were tested here. No independently authorized QA OA/app owner evidence, no actual Zalo signed event verified and no real provider callback admitted.
Zalo docs: https://stc-developers.zdn.vn/docs/v2/official-account/webhook/tin-nhan/su-kien-official-account-gui-tin-nhan-cho-nguoi-dung

## 4. PostgreSQL 17 staging RLS transactions — VERIFIED BUT NOT REAL CUSTOMER JWT

Supabase staging project: tien404-staging, ref ifxlvrhyjhbzbrkdsida, PostgreSQL 17. Metadata audit preconditions:
- public.products, public.orders and public.customers have tenant_id but **no store_id**; their legacy RLS is Tenant-oriented. This blocks any claim that same-Tenant two-Store production Commerce isolation is proven. There may be separate mappings, but these must be independently evaluated, not assumed.
- Read-only transaction with SET LOCAL ROLE authenticated and NO JWT showed 0 visible public.products, public.orders or public.customers; no data was copied.
- A disposable SQL transaction was executed in this staging Postgres using a TEMP TABLE populated with three SYNTHETIC records: Store A and Store B under TENANT_QA, Store X under FOREIGN_TENANT. The test enabled RLS + FORCE RLS and a scoped policy, then SET LOCAL ROLE authenticated and tested:
  Store A sees exactly its one row, zero Store B;
  Store B sees exactly its one row, zero Store A;
  foreign Store sees zero;
  missing Store scope sees zero.
  The transaction returned DISPOSABLE_SAME_TENANT_STORE_A_B_RLS_PASS and ended with ROLLBACK.
- This is a real PostgreSQL RLS execution with ephemeral dummy data, **not** an authenticated Supabase JWT end-to-end UAT, **not** actual shop customer identities and not a change to production policies or business rows.
- GitHub qa/v171n-bot-security/disposable_pg17_store_rls_rollback.sql reproduces this disposable test. PostgreSQL 17 GitHub CI service replays it independently; no live Supabase costs or credentials are needed.

## 5. Release-blocking security findings

P0:
- Obtain two independent real Auth JWTs and verified Store A/B ownership, same tenant, with real hosted Store-level RLS or approved server mapping; maintain denial for cross-Store Product/Order/Customer. Use an approved disposable QA dataset and independent reader identity, not a privileged postgres/service role.
- Obtain private Meta QA Page/App owner authority and App Secret *through managed secrets*, a real provider-signed No-Send callback with independent verifier receipt and native raw-body evidence; no provider responses or customer data.
- Obtain independently authorized Zalo OA/App, real X-ZEvent-Signature No-Send event; verify per official event type; do not blindly assume Meta HMAC applies to Zalo.
- Validate server-side tool authorization before EVERY real Commerce model tool, atomic event replay/rate and idempotent updates, customer OrderAccessGrant and explicit confirmation, no arbitrary media fetching.
- Prior Supabase advisors: SECURITY DEFINER public.qa_shop_b_zalo_claim executable by anon; review actual function body/ownership before changing grants, not confirmed exploited. Real media sandbox/AV private bucket admission V17.1K-S1 still NO-GO.

P1:
- Review privileged authenticated RPC qa_owner_pairing and save_merchant_product with independent caller tests, owner mapping and expected_total/price safeguards.
- Leaked-password protection in Supabase Auth was flagged disabled; settings change requires explicit approval.
- Confirm a protected recovery operator and rollback evidence before any active workflow modification.

The shadow QA only tests deterministic source logic. It DOES NOT prove semantic LLM resistance against live adversarial media. All fake event signatures are derived from non-secret constants; signed real provider authority must be established independently.

## 6. Scope of changes and rollback

IMPLEMENTED: one new inactive n8n manual QA workflow under QA folder, staging fake source adapter + tool gate, strictly Code-only. Existing published Messenger V17.15 and Zalo routes unchanged; existing V17.17 draft preserved.
TESTED: 144/144 manual hosted synthetic QA, PostgreSQL staging disposable RLS transaction PASS, 4 existing Messenger signature node booleans read-only true.
PENDING: GitHub CI 57 independent QA snapshot tests + 630 inherited source tests, separate PostgreSQL 17 CI disposable RLS and intentionally RED real hosted-admission gate.

NO production chat webhook modifications, no customer contact, order mutation, payment change, real model or Vision spending, credential change, public deploy or GitHub merge.
Rollback: close child Draft PR; leave the separate inactive QA workflow untouched. Archive only after explicit authorization. SQL temporary tables and policies were rolled back, so no Supabase data/schema rollback is required.
