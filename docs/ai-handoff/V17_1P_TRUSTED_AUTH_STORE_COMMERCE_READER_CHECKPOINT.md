# TIEN404 AI — V17.1P Trusted Auth Store Owner and Commerce Reader Shadow

Checkpoint date: 2026-11-17 JST
Parent: V17.1O Draft PR #283, HEAD db8f3f55e3986be535c769224e26d696ab88df0e.
Status before CI: IMPLEMENTED INACTIVE QA / TESTED SYNTHETIC N8N 208/208 / REAL JWT AND PROVIDER SIGNATURE HOSTED NO-GO.

## 1. Real live graph version preservation

- TIEN404_MESSENGER_TEST workflow Z7FdV7uDvApfbURQ still ACTIVE Published at version 1064b1b3-d3f1-4a6b-a367-2414ba691522 (V17.17), 32 nodes; FOUR original V17.15 nodes preserved. Has original order/response tools; do not execute attack payloads against live.
- TIEN404_ZALO_BOT_LAB_V1_STAGING yIJk8LvJoLF40Z62 ACTIVE Published V17.19 version 2d912cb0-007f-452f-9536-b92ba12a03e6, 12 nodes; no edits made here.
- Commerce AI Agent Sandbox iyfGUiEsZlNTBWOR ACTIVE version 456862c9-e5ee-4bfa-9931-47dbc39ab73d, 19 nodes including an LLM and Create Sandbox Ticket tool. The whole Core workflow is NOT a pure read-only service, so V17.1P does NOT call it.
- Previous QA V17.1O/V17.1N inactive and unmodified. n8n user preferences read: maintain DEMO/Commerce separation and preserve Published.

## 2. New VERIFIED Supabase readiness negative evidence (no real JWT tokens)

Staging project tien404-staging ref ifxlvrhyjhbzbrkdsida, PostgreSQL 17. Read-only aggregate queries, no real user IDs, emails, tokens or merchant details displayed.

- QA tenant_identity_map: 2 mapped Stores across 2 different Tenants; owner_bindings: 2 distinct owner references and 2 exact matching Store/Tenant links.
- Query for distinct Store owner pairs in the SAME Tenant returned ZERO qualifying pairs.
- auth.sessions aggregate previously showed 5 sessions belonging to 2 different users, but joining with active tenant_memberships returned ZERO tenants with 2 distinct users that both have sessions and active membership.
- Legacy public.orders/products/customers have tenant_id but no store_id and 3 Tenant-oriented SELECT policies, zero Store predicates. Tenant-level RLS by itself does not prove Store A vs Store B isolation within the SAME Tenant.
- QA r1 catalog/owner_bindings/tenant_identity_map/sandbox_orders tables have RLS enabled, zero policies or SELECT grants for ordinary authenticated/anon roles; intentional default-deny is plausible, not a leak.
- V17.5 QA actor A/B roles are NOLOGIN and mapped to different customers within the SAME Store qa-store-a; not an acceptance of TWO Stores and not independent real JWT identities.
- No user was added, role changed, policy altered or customer data queried/edited. These negative findings remain a P0 admission blocker.

## 3. Independent signed-provider gap (do not claim exploit)

Messenger historical Verify Signature Timing-Safe node booleans true on earlier runs are existing workflow decisions, NOT independent App Secret with owner-backed QA Page signed event.
Zalo V17.19 inspected Protected Webhook node has credential configuration but rawBody option not enabled, and the visible graph has no direct X-ZEvent-Signature verification Code or expression. This is an EVIDENCE GAP only; upstream authentication may exist. Do NOT declare a successful signature bypass. Require private owner authorized QA OA/App and independent native signed no-send callback.

## 4. NEW isolated n8n V17.1P staged Commerce Reader authority guard

Workflow ID p5OsIaB0NkMDFMw7
URL https://ngoctien20.app.n8n.cloud/workflow/p5OsIaB0NkMDFMw7
Name TIEN404_V171P_TRUSTED_AUTH_STORE_COMMERCE_READER_STAGING_NO_SEND
Checkpoint workflow version dec4b734-ab6a-4cdc-b449-bf052b703118
Location Personal project / 90_QA - DIAGNOSTICS
State INACTIVE; active/published version null; callerPolicy none; 60-second timeout.
Graph one Manual Trigger and four Code nodes only. NO credentials, webhook, HTTP, PostgREST/DB, model, real Commerce Reader, order/write/send tool, schedules or live customer data.

Source test contract: 52 synthetic cases for each of 4 profiles (Messenger Store A/B and Zalo Store A/B, all sharing ONE *FAKE* Tenant), 208 fixtures. Backend fake registry is fixed in source and treats client-supplied tenant/store/admin/user_metadata/app_metadata/JWT/role/OrderAccessGrant/credential flags as forbidden input. It refuses mismatched Page/OA installation, foreign SKU/order, forged sender/customer order grant, expired auth sessions, replay, rate, nontrusted origin, prompt injection text/media, arbitrary external URL and write/send. Only fake Store-owned catalog and own-order status get SOURCE-ONLY plans with no real DB execution. Even fake "REAL_JWT" markers are DENIED in this contract.

The second stage simulates catalog/order status with isolated in-memory TEST data only. It returns dataSource SYNTHETIC_CODE_ONLY, canReadHostedDatabase false, and zero actual PostgREST requests.
Last stage asserts 0 real Auth JWT admission, 0 real provider signed events, 0 customer data reads, 0 real Commerce reads/writes, 0 LLM or provider sends; release remains HOSTED_NO_GO.

Manual n8n execution 5009 SUCCESS: 208/208 PASS = 196 DENY, 8 fake catalog read plans, 4 fake own-order status plans.
Hardening of the same inactive QA Code guard then rejects invalid synthetic event ID patterns and SQL-like/control/URL query characters. Execution 5010 SUCCESS: 208/208 PASS with same distribution.

**These synthetic fixtures DO NOT constitute two real Auth JWTs, real Meta/Zalo provider signatures, real Commerce Reader installation or real Store RLS.**

## 5. Independent GitHub CI and security acceptance

GitHub QA snapshot: qa/v171p-bot-security/v171p-n8n-source-snapshot.json (fake test source only, no private credentials).
Additional Node tests: qa/v171p-bot-security/v171p-n8n-reader.test.cjs. Runs exact n8n scripts in a separate Node VM, with forged Store/role/JWT/metadata, malicious queries, replay, cross-Store products and customer order access and no real external IO.
Inherits all source tests V17.1O through V17.1D.
The independent PostgreSQL17 job reruns V17.1N disposable temporary RLS transaction (same fake Tenant and two Stores) with ROLLBACK, not actual authenticated JWT.
CI production gate deliberately RED until independent signed Page/OA, two real Auth JWT Store owners, real Store-level RLS and OrderAccessGrant/Commerce Reader, safe tool invocation and managed secrets are verified. Initial source success and overall red hosted gate must be reported separately.

## 6. Safe authorized future UAT requirements (P0)

1. Authorize two distinct real QA Auth identities with active roles in two DIFFERENT Stores in the SAME Tenant, without repurposing existing live merchant identities. Verify owner approval, store mapping and backup/recovery before any membership changes.
2. Obtain two independent Auth sessions through a private verified client; do not copy JWTs/passwords into chat, GitHub, n8n logs or QA DataTables. Server verifies actual signature, audience, issuer, session_id, expiry/revocation, user permission and STORE binding. Ignore client user_metadata and spoofed Store selectors.
3. Dedicated least-privilege Auth JWT PostgREST/PG reader must use real Store-level RLS or independently authorized Store-level gateway, not postgres/service_role or SECURITY DEFINER bypass. Test Store A to A and B, Store B to B and A, revocation and expiry, on disposable approved QA catalog/order records. Never query real customer records for attack testing.
4. Private QA Meta Page/App and Zalo OA/App owner authorization with managed secrets; receive native signed no-send canary via separately isolated ingress and independent raw-body verifier, not the production customer webhook.
5. Review anon-executable SECURITY DEFINER public.qa_shop_b_zalo_claim before granting more channel authority; no exploit confirmed. Separate authenticated qa_owner_pairing/save_merchant_product review is required.
6. Preserve Messenger four V17.15 nodes and Published V17.17, Zalo V17.19, and AI_SALES_DEMO separation. Do not promote fake simulation results into Core Bot.

## 7. Change record and rollback

IMPLEMENTED: one new inactive manual staging QA workflow plus child Draft PR code/tests/checkpoint.
TESTED: execution 5009 and 5010, both 208/208, no real customer/model/provider/Commerce IO.
No live workflow Publish, Supabase migration, Auth user/role change, customer data read/write, credential, billing, order, stock, or message changes.
Rollback: close Draft child PR; leave inactive QA workflow isolated (archive only with separate approval). No production restore required.

Source CI evidence must be filled after confirmed job result and exact final commit SHA.


## 8. VERIFIED independent GitHub CI and n8n acceptance evidence — 2026-11-17 JST

**Tested source HEAD:** 0946f8fda8ca96f262d812d73ba07ef865c2d030
**GitHub Actions push run:** https://github.com/ngoctien20/demo-git/actions/runs/44046440401

- Job 133913182055 SUCCESS: V17.1P independent Node VM tests replaying exact n8n manual QA scripts **111/111 PASS**, plus inherited V17.1O–V17.1D **744/744 PASS**, total **855/855 SOURCE TESTS PASS**. Static no real JWT, no provider, no DB/network/AI access check also PASS.
- Job 133913181664 SUCCESS: independent disposable PostgreSQL 17 service with dummy authenticated NOLOGIN role, TEMP TABLE RLS across two Stores under same FAKE Tenant, ROLLBACK; output DISPOSABLE_SAME_TENANT_STORE_A_B_RLS_PASS, proof scope NO_REAL_JWT_NO_COMMERCE_TABLES. Post-rollback absence of temporary table verified.
- Job 133913567350 is intentionally the HOSTED NO-GO release gate. It is expected to fail until two true signed Auth owner JWT identities across Store A/B in the SAME Tenant, independently owned signed Meta/Zalo OA callbacks, Store-level Commerce Reader authorization and customer OrderAccessGrant are proven. Source and disposable RLS PASS do not satisfy these prerequisites.
- n8n V17.1P execution 5009 SUCCESS, then hardened version dec4b734-ab6a-4cdc-b449-bf052b703118 execution **5010 SUCCESS** with 208/208 cases: 196 DENY, 8 SIMULATED_CATALOG_READ_PLAN, 4 SIMULATED_ORDER_STATUS_PLAN. The allowed plans are NOT real database reads and no customer data/model/provider was accessed.

### Honest regression history

The first GitHub CI attempt had 106/111 source tests PASS and 5 invalid test assertions: a deliberately forged fifth installation confused the test case grouping and some snapshot field names differed from test expectations. Test grouping now uses immutable caseId fixture ranges, independent of the attacker-controlled installation field; this improves the test rather than relaxing the policy.

Subsequent run had 110/111 source tests PASS because one further test expected an absent snapshot field. This was corrected to check explicit realOrdersRead, realCustomersRead and realOrdersWritten fields. Later all 111/111 tests and inherited 744/744 passed, but the static YAML metadata validator used stale field names. These were reconciled against the exact JSON snapshot schema, and the final source job passed without policy concessions. No changes to real Auth, provider, Commerce or Published nodes were made during these fixes.

### Final security verdict

VERIFIED: current mapping cannot demonstrate SAME-TENANT two-Store ownership; actual session/membership join has no qualifying pair; existing legacy RLS is Tenant level. Treat as a **P0 deployment blocker, not an exploit claim**.

IMPLEMENTED: separate INACTIVE no-send/code-only n8n QA, immutable source snapshots and Draft PR. TESTED: 208/208 hosted synthetic and 855/855 offline source with disposable PostgreSQL RLS QA.
BLOCKED: genuine Meta/Zalo signed no-send Page/OA verification, two independently signed real Auth JWTs for different Stores in same Tenant, real Store-level JWT/RLS or trusted server scope, protected Commerce Reader and per-tool OrderAccessGrant.
LIVE release: **NO-GO**.

Rollback: close child Draft PR and leave the QA workflow INACTIVE, callerPolicy none. No production restoration required since no published, credential, customer, billing or Commerce business changes occurred.

This checkpoint documentation-only commit changes the branch HEAD. Final HEAD CI must be checked again before reporting the documentation commit as verified.
