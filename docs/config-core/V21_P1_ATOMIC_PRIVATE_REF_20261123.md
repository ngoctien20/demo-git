# TIEN404 V21 P1 — Atomic private opaque-reference mapping (2026-11-23)

> **CHECKPOINT: DRAFT / OFFLINE ONLY / NO SEND / NOT RELEASED.**

## 1. Trạng thái thực tế — VERIFIED

- Original [PR #491](https://github.com/ngoctien20/demo-git/pull/491) was **merged** into `develop` at 2026-11-22T21:11:35Z; previous branch is no longer an appropriate open Draft. No unapproved merge was performed in this session.
- The most recent checkpoint of that work was `89d65fbded6f46051f87725d97cb7b7ae17cd9bd`; the new work starts in a **new branch** `work/v21-p1-atomic-opaque-mapping-qa-20261123` based on current `develop` at `9355974674f0a3dd39a274fdaa0874fd6d9756a2`.
- New [Draft PR #503](https://github.com/ngoctien20/demo-git/pull/503) targets `develop`; [P1 issue #495](https://github.com/ngoctien20/demo-git/issues/495) remains OPEN.
- Messenger n8n workflow `Z7FdV7uDvApfbURQ` at starting read-only audit: Draft `41bcea84-703d-40bc-be2a-71f84ca4e2d8`; Published `1f4069a5-5e74-4c79-935b-40f02b3582d8` active. No workflow/Meta setting was edited, published or called.

## 2. Mục tiêu và phạm vi

Implement the outstanding secure **private opaque reference creation** gate from §21. Every first-seen Messenger event should create *one* scoped atomic event claim, *one* send plan, *one to three* message parts, and *one* private opaque reference-to-plan mapping **inside the same SQL statement and transaction**. The source-only private ref is intended only for future authenticated operator reconciliation, never as a bearer authorization token or customer order link.

## 3. Những gì đã thay đổi — IMPLEMENTED source-only

- Added `qa/messenger-rich-v136m5/atomic-claim-plan-private-ref.cjs`. It composes the **existing** `atomic-claim-plan.cjs` SQL with a data-modifying `mapped` CTE, using `INSERT INTO app_private.messenger_reconciliation_refs(reference,plan_id,tenant_id,store_id,page_id) SELECT ... FROM prepared p ON CONFLICT DO NOTHING RETURNING plan_id`. The outer SELECT requires `count(parts)=expected_count AND count(mapped)=1`. No earlier event/plan/ledger writer implementation was rewritten.
- The reference is **HMAC-SHA256 truncated to 128 bits (32 lowercase hexadecimal characters)** over the same domain and tenantId/storeId/pageId/planId tuple as the existing `message-reconciliation-inspector.cjs` and `private-opaque-session-bridge.cjs`. A separate `referenceSecret` is required in addition to the event `secret` to permit independent key management.
- The server-only candidate internally creates a random plan UUID and claim lease; neither is accepted from a customer/browser input. No raw plan UUID, ref, lease, recipient PSID, tenant/store/Page, sender hash or raw payload is returned to the caller.
- **Mandatory all-or-nothing transaction:** if a duplicate claim, plan uniqueness conflict or 128-bit private reference collision causes zero selected rows, the callback throws *inside* the injected transaction. The candidate returns only a fail-closed `DUPLICATE_OR_REF_CONFLICT_HOLD`, with `sendAllowed:false` and `retryAllowed:false`. A driver must explicitly attest `rollbackOnThrow:true` and zero external writes. Commit acknowledgment loss propagates as an error — not an automatic retry.
- New `qa/messenger-rich-v136m5/atomic-claim-plan-private-ref.test.cjs` contains 13 local synthetic tests, including 1/2/3 parts, 50 concurrent attempts, rollback, duplicate after restart, lost-acknowledgment hold, HMAC cross-module parity, tenant/store/Page/sender/bindingVersion/event isolation, secret/proof validation and no sensitive output.
- New `qa/messenger-rich-v136m5/pg17-atomic-private-ref-uat.sh` reuses and extends the prior disposable PostgreSQL 17 atomic claim/plan/parts test. It loads the **exact new SQL from source** and adds a FORCE RLS `messenger_reconciliation_refs` table with global reference PK, one-to-one scoped-plan UNIQUE, and composite FK `(plan_id,tenant_id,store_id,page_id)`. Restricted service-login roles can INSERT only in the bound Page/store and a separate read-only operator-login role **cannot mint mappings**.
- Updated existing `.github/workflows/v136m5-private-event-store-qa.yml` and `.github/workflows/tien404-config-core.yml` to run new source/SQL regression suites. The workflows remain limited to GitHub runner/disposable PostgreSQL17, with explicit credential/host-denial guards and no Meta Send.

## 4. Kết quả QA — TESTED

- [Messenger Offline CI 45160433636](https://github.com/ngoctien20/demo-git/actions/runs/45160433636): **SUCCESS, 368/368 tests PASS**, including 13 new synthetic private mapping tests; independent static hosted-write/provider-send denial gate also SUCCESS.
- [Config Core + PG17 CI 45160433634](https://github.com/ngoctien20/demo-git/actions/runs/45160433634): **SUCCESS; `PG17_ATOMIC_PRIVATE_REF_TESTS=45` PASS**. Verified actual PostgreSQL: 1/2/3 parts and exactly one mapping per plan; exact HMAC parity; two competing SQL clients create one winning claim/plan/mapping; cross-shop restricted RLS; unprivileged operator cannot INSERT a mapping; duplicate/replay blocked; precommit rollback clears event/plan/parts/map; explicit conflicting ref yields **zero SQL result rows**, driver-style rollback leaves no orphan; plan survives claim retention; revocation blocks writes.
- Same Config Core run inherited: 21/21 atomic event claim, 24/24 restricted inbound RLS, 28/28 ledger, 29/29 ledger RLS, 23/23 claim-bound plan, 26/26 atomic claim-plan, 20/20 read-only reconciliation, 34/34 operator grants, 38/38 private opaque session, and Config Core 138/138 unit tests PASS.
- **No live provider test was performed.** `API_ACCEPTED_MOCK` is not a real Meta accepted/delivered/read acknowledgment.

## 5. Lỗi/rủi ro còn lại — BLOCKED

1. The `SERVER_VERIFIED_MESSENGER_BINDING` shape used by the source candidate is a synthetic proof, **NOT actual signed Meta ingress or hosted Page/store owner authentication**. Do not accept caller-supplied trusted flags on any real endpoint.
2. The new PostgreSQL schema, RLS roles, composite FK, reference secret and mapping writer exist **only in disposable QA**. There is no hosted Supabase migration, audited production RLS/grants or safe secret rotation/retention plan.
3. Actual production use still requires trusted ingress → canonical tenant/store/Page authority → current owner/staff/grant checks → atomic plan/mapping creation → separate no-retry reconciliation. The opaque reference alone never authorizes reading/writing.
4. Exactly-once PostgreSQL inserts **do not imply** exactly-once Meta Send. The current published Messenger workflow still uses non-atomic check→send→record ordering; ambiguous provider outcomes remain held. Per-part MAY_HAVE_SENT/UNCERTAIN states must not auto-retry.
5. The SQL mapping's `ON CONFLICT DO NOTHING` by itself does **not** roll back partial inserts: the trusted driver MUST throw before COMMIT when the mapping count is zero. CI now asserts a collision returns zero rows **before** demonstrating the rollback. Real deployed driver contract must be independently attested.
6. A reference key rotation without a version/alias migration could strand existing historic maps. New versioned reference key storage, retention and GDPR/PDPA erasure workflow are future design gates.
7. No hosted changes, Meta Send, n8n publish, customer data, Orders/Products, credentials or billing changes. PR #503 stays DRAFT and Issue #495 OPEN.

## 6. Quyền phê duyệt và rollback

- **No approval required for this source-only Draft and disposable CI.** Explicit owner approval required before hosted schema/role/grant migration, real credential use, any Meta provider sends, PR merge, release or publishing a production workflow.
- To rollback this continuation, revert only: `atomic-claim-plan-private-ref.cjs`, `.test.cjs`, `pg17-atomic-private-ref-uat.sh`, this checkpoint doc and the corresponding small additions in the two CI YAML files. Existing merged PR #491 source, atomic claim-plan, private operator bridge and Messenger runtime remain untouched. No production rollback actions necessary.

## 7. Checkpoint and next step

- Git checkpoint at document creation: **new Draft PR #503**, branch `work/v21-p1-atomic-opaque-mapping-qa-20261123`; previous successful code/CI head `26b11a9847f4793ff5d9763f86e3c964cd5b394d`.
- Next safe offline focus: make the **trusted gateway/transaction-driver contract** explicit for shared/pool database role environments (Supabase JWT/`CURRENT_USER` mismatch), validate session authority A/B revocation with verified user identifiers and `private ref` key rotation design. Do not wire live customer sends or hosted schema until approved.

**Final disposition: IMPLEMENTED + TESTED on source-only Draft and disposable PostgreSQL17 / NOT RELEASED.**
