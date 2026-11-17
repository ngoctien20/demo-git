# TIEN404 AI — V17.1O V17.17 Exact Security Regression × Real Auth Store Authority Gate

Date: 2026-11-17 JST.
Parent: V17.1N Draft PR #282 HEAD 4ff93bc00b708f7b038041ad7e9680b53e3a58cc.
Status: STAGING SOURCE IMPLEMENTED / 132 SYNTHETIC MANUAL TESTS PASS / REAL JWT AND PROVIDER ADMISSION NO-GO.

## 1. Published Messenger V17.17 source reconciliation

Read-only verified n8n TIEN404_MESSENGER_TEST, workflow Z7FdV7uDvApfbURQ, ACTIVE and Published version 1064b1b3-d3f1-4a6b-a367-2414ba691522, 32 nodes. All FOUR original V17.15 nodes remain. No live workflow edit or Publish by this milestone.

The Published V17.17 script in node V17.15 Strip PII and Normalize Demo Query is 1941 characters long. Its original classify function is copied verbatim (exact source prefix) to the separate inactive staging QA Code node. The new batch input/output wrapper is not a live ingress and uses synthetic fixtures only. Existing Zalo lab remains unchanged.

## 2. NEW isolated n8n V17.1O security QA

Workflow URL: https://ngoctien20.app.n8n.cloud/workflow/2cBUCxHzFxvQX5Ix
Workflow ID: 2cBUCxHzFxvQX5Ix
Workflow name: TIEN404_V171O_MESSENGER_V1717_EXACT_CLASSIFIER_SECURITY_STAGING_NO_SEND
Verified version: af68bb64-ec76-473a-919c-bde2ae728212.
Located in Personal / 90_QA - DIAGNOSTICS, INACTIVE, no published version. callerPolicy none and 60-second execution timeout.
Graph exactly five nodes: one Manual Trigger + four Code nodes. No credential, HTTP/Webhook, database, model, Commerce tool, Messenger/Zalo send, provider secret or customer data.

Flow: generate 33 synthetic Vietnamese/English/Japanese/security intents in four contexts each (authorized fake Messenger Page, foreign Page, invalid sender, image attachment) = 132. Execute EXACT source V17.17 classifier. Then a separate STAGING-ONLY guard rejects sensitive order intent and non-catalog tool calls, allowing only simulated Store-scoped public catalog READ plans. Final guard asserts zero actual database queries, order writes, AI calls and provider sends; real release NO-GO.

Manual execution 5005: source matching and guard decisions 132/132, but final assertion failed due QA expected read-plan count incorrectly set to at least 10 (actual 8). Corrected assertion, no production behavior changed.
Manual execution 5006: SUCCESS, 132/132 PASS, 124 DENY, 8 SIMULATED READ plans, two confirmed semantic misroutes, seven sensitive-order guard overrides. This is simulated n8n QA, not real Meta/Zalo signed event or real Commerce read.

## 3. V17.17 confirmed P1 semantic issue and proposed fix

Published classifier normalizes input in this order:
  normalize('NFD') -> remove combining accents -> replace lowercase 'đ' only -> lowercase.

Uppercase Unicode Đ is converted to lowercase only AFTER the case-sensitive replacement. For example:
- QA_CORE: ĐẶT HÀNG áo thun is classified by Published V17.17 as __T404_CATALOG__ even though user intent is ORDER.
- QA_CORE: ĐỔI ĐƠN áo thun is classified as __T404_CATALOG__ even though user intent is ORDER.

The currently Published QA_CORE route remains demo/read-only; these test cases do not prove unauthorized order creation. The misroute is a P1 customer-intent correctness and future tool-boundary issue. The new SHADOW-ONLY guard applies a robust Unicode normalization using both lowercase and uppercase Đ, then rejects sensitive order requests before a catalog read plan. This patch was NOT copied back to any Published Messenger node. Approval from live version owner and independently observed regression is required before promotion.

Phone, +84 phone, email, token, password, OTP and external URLs correctly classify private in these tested examples. Invalid Page/sender/image attachment result in no eligible tool request. All results remain synthetic.

## 4. Supabase staging real Auth/Store readiness metadata: VERIFIED READ-ONLY, JWT BLOCKED

Staging: tien404-staging, ref ifxlvrhyjhbzbrkdsida, PostgreSQL 17.

Aggregated read-only evidence: 3 Auth users and 3 tenant memberships across 2 Tenants, with one Tenant having two distinct members. These aggregates do not provide or validate two independent Auth JWT sessions.

Legacy public.products/orders/customers include tenant_id but not store_id; a same-Tenant two-Store production RLS proof cannot be inferred.

QA schema tien404_r1_qa does contain store_key, tenant_key, owner_bindings and tenant_identity_map, but inspected owner_bindings/catalog/sandbox_orders/tenant_identity_map tables are RLS enabled with zero policies for ordinary roles (default deny); this is not evidence of a leak.

Special QA schema tien404_v175_qa has FORCE RLS and specific SELECT policies for NOLOGIN NOBYPASSRLS roles tien404_v175e1_actor_a and actor_b. The policy predicates are scoped to **the SAME Store qa-store-a** but distinct synthetic customers; inspected channel_identity/customer_identity/order_ownership test tables contained no data. These roles are a same-Store two-customer QA, NOT Store A vs Store B Auth sessions. A zero-row test with them would be vacuous.

Previous V17.1N PG17 Store A/B RLS test used disposable TEMP TABLE data and rollback, not signed JWT. V17.1O CI will independently repeat that test with PostgreSQL 17 Docker. All real same-Tenant Store A/B JWT UAT remains BLOCKED pending authorized identities with corresponding trusted Store ownership and isolated reader.

## 5. Privileged RPC findings (do not claim exploitation)

Metadata: public.qa_shop_b_zalo_claim has SECURITY DEFINER and anon EXECUTE. Static pg_get_functiondef pattern signals did not detect direct auth.uid, TTL or nonce/replay references; these are NOT proof of missing validation because the function may delegate to other checks. Treat as P0 security review candidate; do not invoke, alter role GRANT or modify function without explicit approval.

public.qa_owner_pairing and public.save_merchant_product SECURITY DEFINER functions are executable by authenticated and include auth.uid. Review their full implementation under private owner access before accepting them as a bot transaction boundary. No function execution, schema migration, credential or customer data mutation occurred in this V17.1O milestone.

## 6. Actual provider signatures: BLOCKED for independent proof

Historical Messenger node Verify Signature Timing-Safe had verified=true on executions 4762, 4754, 4746, 4544. These prove that the active node accepted those signatures, not an independent App Secret + Page ownership verifier.
Zalo OA webhook X-ZEvent-Signature requires separate owner/app secret and native event acceptance. V17.1O did not receive or verify an independently authorized native provider event. No provider message was sent and no credential copied to staging.

## 7. GitHub QA & NO-GO, rollback

GitHub snapshot source: qa/v171o-bot-security/v171o-v1717-source-snapshot.json.
Offline deterministic tests: qa/v171o-bot-security/v171o-source-regression.test.cjs (57 new), plus inherited V17.1N–D (687) = 744 source tests planned. These test only source-matching semantics and a staging-only policy, NOT end-to-end prompt injection resistance in live LLM. Count PASS only after CI.
Independent PG17 service reruns V17.1N transactional RLS fixture and checks rollback. Live provider/JWT/production tool-gate job intentionally FAILS.

P0 real release blockers: independent Meta/Zalo QA Page/OA owner admission with genuine managed-secret signed NO-SEND callback; two real Auth JWT identities bound to two different Stores same Tenant; Store RLS/OrderAccessGrant/customer challenge/atomic replay; per-tool server authorization; privileged anon RPC audit; hosted image sandbox and malware controls.

Rollback: close Draft child PR; leave new n8n QA workflow INACTIVE with callerPolicy none (archive only by explicit separate approval). No change to Published Messenger/Zalo/Core, no Commerce data rewrite, no paid model use, no customer messages.


## 8. VERIFIED independent CI and milestone acceptance — 2026-11-17 JST

Tested source HEAD: c5771df747498aa3001697a9aabce48a182b6737.
GitHub Actions: https://github.com/ngoctien20/demo-git/actions/runs/44040282377

- Source QA job 133892908476 **SUCCESS**. New V17.1O exact Published classifier, Unicode order denial, privacy and Page/source drift cases: 57/57 PASS. Inherited V17.1N through V17.1D: 687/687 PASS. Total **744/744 OFFLINE TESTS PASS**, no source assertion failures.
- Independent PG17 QA service job 133892908156 **SUCCESS**. Replayed temporary same-Tenant Store A/B RLS in disposable PostgreSQL 17, verified ROLLBACK and temporary-table removal. This is not real Auth JWT evidence.
- Live provider/Auth JWT release job 133893140840 deliberately **FAILURE**. Overall GitHub workflow result FAILURE is an intentional HOSTED NO-GO security release gate, not a failed source or PG17 QA.
- Actual n8n staging execution **5006** SUCCESS, **132/132** decision fixtures with 124 DENY, 8 synthetic read-only plans, two current Published V17.17 Unicode Đ order-intent misroutes confirmed and blocked by a staging-only guard. No real model calls, DB writes/reads or provider sends.
- Neither verified presence of credentials nor native Meta/Zalo owner/secret access was required; no real signed external webhook passed through the new QA workflow.
- All original V17.15 nodes remain in the Published Messenger graph, and the V17.17 Published workflow was not edited by this milestone.

### Release classification
**V17.1O IMPLEMENTED SOURCE / TESTED SYNTHETIC N8N / TESTED OFFLINE CI / TESTED DISPOSABLE PG17 / REAL META-ZALO AND SAME-TENANT STORE AUTH JWT NO-GO.**

Before live cutover obtain separate real Auth QA owner identities for Store A and B, independently signed Meta/Zalo owner proof, managed-secret verified no-send events, server-side Store ownership and customer/order grant, and reviewed permission boundary prior to any model write/send tool. Review the PUBLIC anon-executable SECURITY DEFINER claim RPC and the Unicode Đ classification correction under owner-controlled change procedure.

**Rollback:** close child Draft PR #283; inactive n8n QA workflow remains locked against subworkflow invocation (archive/delete only after explicit separate approval). No production snapshot recovery needed because no Published code, business data, credentials or auth settings were changed.

Checkpoint-only documentation update changes the SHA; reverify the final HEAD in GitHub Actions before attributing CI to the latest commit.
