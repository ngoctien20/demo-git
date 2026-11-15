# TIEN404 AI V14.4.6 — Test-Ready QA Instructions

## A. Immediate hands-on n8n test — no credentials, no real data, no messages

**Direct link:** https://ngoctien20.app.n8n.cloud/workflow/BAOYcw4U9VCkSMdX
- Personal project, folder: 90_QA - DIAGNOSTICS.
- Workflow name: TIEN404 V14.4.6 — Order & Stock QA Lab [OFFLINE MOCK ONLY].
- Workflow ID: BAOYcw4U9VCkSMdX.
- Expected state: INACTIVE, MANUAL TEST only, never Publish.
- 3 nodes: 01 Manual Trigger, 02 Choose Scenario, 03 Offline JS Mock.
- Verified manual execution: 3861, SUCCESS, 8/8 scenario outputs PASS (NOT real SQL).
- Uses ZERO credentials, HTTP calls, Supabase calls, n8n Data Tables, Google Sheets, Messenger/Zalo or real provider sends.

How to use:
1. Open the direct n8n workflow link above.
2. Find node "02 - Chọn scenario (ALL để chạy 8 bài)".
3. Default scenario=ALL, or edit its value to one of:
   - REQUEST: request does not hold stock
   - ACCEPT: merchant acceptance reserves stock
   - FULFIL: fulfil deducts stock only once
   - CANCEL: cancel releases reserved stock
   - DUPLICATE: same request key should not duplicate (mock only)
   - OVERSELL: demand > available stock, second order rejected (mock only)
   - CROSS_STORE: Shop A cannot act on same-tenant Store B
   - PRICE_TAMPER: invalid expected total must be rejected
4. Click "Execute workflow" or "Test workflow" in the n8n editor. If there is a Save step after editing node 02, save the DRAFT only. Do not Publish.
5. Open the output of "03 - Mô phỏng QA an toàn, KHÔNG GHI". ALL should return exactly 8 items, each status PASS, writes=0 and providerMessages=0.
6. For a single selected scenario, expect 1 output with status PASS; unknown scenario returns FAIL without side effects.

**Meaning of PASS:** JavaScript mock UI and example rule checks work, NOT real PostgreSQL transaction, Supabase RLS, Meta webhook or real bot.

## B. Real PostgreSQL 17 transaction test — no installation or Supabase connection

**CI run:** https://github.com/ngoctien20/demo-git/actions/runs/43741773162
**GitHub PR:** https://github.com/ngoctien20/demo-git/pull/108
**Source branch:** work/v1446-atomic-order-ledger-pg17-qa-20261116

1. Open the CI run link.
2. Open job "Disposable PostgreSQL 17 — REAL transactions; NEVER Supabase".
3. Expand "Run actual PostgreSQL 17 order and inventory ledger assertions": 30 direct functional checks.
4. Expand "Run genuine concurrent PostgreSQL sessions": 8 race and duplicate-key checks.
5. To personally repeat this exact isolated QA, use GitHub Actions **Re-run jobs → Re-run all jobs** on the existing run, when the UI provides it. This reruns the same source commit in fresh GitHub-hosted ephemeral PG17. Re-run requires repository permissions.
6. The action's workflow_dispatch trigger may not appear while the workflow exists only on a Draft branch; never merge to production just to enable an Actions button.
7. After rerun, inspect both jobs and ensure green. Never run the SQL directly against tien404-staging or the backup database.

### Verified behavior in real PostgreSQL, not JavaScript
- Same-tenant Store A/B use identical SKU but different price/stock.
- Request validates expected total and leaves stock untouched (requested state).
- Repeated key+payload returns replay; changed payload conflicts.
- Merchant accepts: reserves 2 units out of physical stock 3.
- Merchant fulfils: physical becomes 1 and reserved 0; replay does not duplicate.
- Cancel confirmed other-store order releases stock; no double-release.
- Stock ledger rejects direct UPDATE/DELETE and enforces event type constraints.
- Cross-tenant/store and unauthorized role calls rejected.
- Concurrent 2 merchant accepts, demand 2 each for stock 3: exactly ONE succeeds, other fails insufficient stock.
- Concurrent identical request IDs from 2 PostgreSQL connections: exactly ONE newly-created Order + ONE replay, without duplicate row.
- Everything is synthetic inside qa_v1446, discarded after CI.

## C. Separation, governance and evidence

- SQL function guards require exact database tien404_v1446_ci, postgres user and tien404.v1446_ephemeral=YES GUC, also checked before ANY CREATE. The fixture is NOT a Supabase migration and must not be copied into hosted project.
- The functions are SECURITY INVOKER but use synthetic GUC identities and postgres-owner test accounts; **this is not a demonstration of actual Supabase JWT authorization or hosted RLS isolation**.
- Existing n8n Commerce/Messenger and Google Sheets DEMO workflows were not modified; the new QA workflow is a separate INACTIVE Draft in Personal/90_QA - DIAGNOSTICS.
- The current test rule is a PROPOSED merchant-accept reservation policy. It is not accepted as the commercial policy until the owner explicitly chooses it.
- Refund after fulfil, return-to-stock, partial fulfilment, stock expiration, subscription expiry and paid-state accounting are intentionally BLOCKED/pending separate design.
- Existing backup restore drill is still DEFERRED and UNTESTED. No hosted schema/GRANT/RLS, Store mapping of 2 Products/2 Orders, real JWT sessions or customer pilot may proceed.

## D. What the owner should accept or change before hosted integration

- [ ] Request-only until merchant accepts (current fixture)
- [ ] Reserve inventory earlier at customer confirmation (requires expiry/release and potential deadlocks)
- [ ] Reserve only on merchant approval and deduct on fulfil (current fixture)
- [ ] Partial shipments / returns / refunds policy separately specified
- [ ] Out-of-stock fallback: reject, backorder (disabled), or advise merchant
- [ ] Price lock duration for a pending request and customer reconfirmation when price changes
- [ ] Minimum stock and stock reconciliation ledger source of truth
- [ ] Real backup restore to isolated PG17 + rollback approved, canonical Store/RLS/JWT acceptance signed off

Until actual owner approval, these remain proposals; the tests do not edit customer data.

## E. Rollback

- GitHub: close/revert Draft PR #108; isolated CI database self-destructs.
- n8n: new inactive workflow BAOYcw4U9VCkSMdX can remain safely in QA folder or be separately archived after explicit user approval (no deletion performed).
- No hosted Supabase, production workflow or provider-send rollback needed because no such change was made.

**Release verdict:** TEST_READY_OFFLINE_JAVASCRIPT_AND_DISPOSABLE_PG17 / NOT_HOSTED_STAGING_ACCEPTED / NOT_PRODUCTION_RELEASED.
