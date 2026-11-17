# TIEN404 AI — G0.10 Real Signed Messenger Shadow × Durable Replay PG17 No-Send Readiness

**Checkpoint date:** 2026-11-17 JST  
**Lifecycle:** CANDIDATE / SOURCE+DISPOSABLE QA TESTED / NOT DEPLOYED / HOSTED NO-GO  
**Draft PR:** https://github.com/ngoctien20/demo-git/pull/272  
**Parent G0.9:** PR #269, parent HEAD \`7ccbb7a84de73e2fd7d99e4993a834848de8aa7c\`  
**Tested pre-document source SHA:** \`9a8a22f8684cb5f410d26d2ea99bd3c8034ec1b5\`  
**Tested source Actions:** https://github.com/ngoctien20/demo-git/actions/runs/44016113914

## 1. Real actual system state — read-only independently checked

**New evidence is newer than prior G0.9 snapshot; do not claim no real signed event exists:**

| Scope | Exact workflow / version | n8n execution | VERIFIED |
|---|---|---|---|
| Messenger DEMO Published | \`Z7FdV7uDvApfbURQ\` / \`ff7a57d2-519a-4283-933c-37a854df92d2\` | \`4431\` | Actual webhook POST, Meta signature verified=true twice, legacy AI Agent and Send Messenger Reply executed; Meta accepted reply |
| Restricted private Shadow Published | \`dw1JOxWOEY8csTnm\` / \`450f2693-aad9-47d8-aaba-ac7a94abe644\` | \`4432\` | Incoming internal receipt accepted, \`fixtureOnly=false\`, no customer message content transmitted downstream, **0 provider sends / 0 Orders / 0 models** |
| Actual Central Core Published internal | \`iyfGUiEsZlNTBWOR\` / \`ddc3ce5b-365e-47e2-a06d-08daffceb9a8\` | \`4433\` | Unregistered reserved synthetic channel correctly **rejected**; no Commerce order or provider reply |

Execution \`4431\` on **2026-11-17 04:02:43 UTC** is a real signed provider event. The legacy bot still sent a reply, so **only the private Shadow → Core branch is No-Send**. This is **not** an independently owned dedicated Meta QA App/Page no-send event, real Store catalog authorization or proven Commerce Agent customer reply.

The previously created V17.13R handoff is in Draft PR #243 at \`docs/ai-handoff/V17_13R_REAL_SIGNED_MESSENGER_SHADOW_UAT_ACCEPTANCE.md\`; its findings were independently checked from the connected n8n executions.

### Potential concurrency gap (NOT an observed exploit)

The current Messenger Published graph has Data Table \`Skip Duplicate Message ID\` with operation **\`rowNotExists\`** before the send, while \`Record Successful Messenger MID\` is a **separate Data Table node downstream of successful send**. A check-then-record sequence, absent an independently established unique atomic claim before side effects, can be vulnerable to concurrent duplicate webhook delivery. This is a **potential TOCTOU / duplicate-send risk**, **not** proof that production has actually sent duplicate messages.

No live replay, forced duplicate webhook, or callback modification was performed in this milestone. The existing Messenger user-visible reply path and V17.13 restricted Shadow remain unchanged.

## 2. IMPLEMENTED: source-only G0.10 and safe storage contract

- \`qa/v152-g10/redacted-real-signed-shadow-evidence.json\`: sanitized, exact n8n workflow/execution references and boolean results. **No Page ID, PSID, MID, customer message, credential, actual Meta signature or Order PII**.
- \`qa/v152-g10/bound-atomic-replay-adapter.cjs\`: injected private replay adapter compatible with **pinned V17.1E \`handleIsolatedMeta\`** \`claimOnce(receiptId)\` API, without modifying that pinned raw-HMAC handler.
  - Requires **private server-held replay pepper**, distinct from Meta App Secret and stable across all workers through the complete retry/claim retention horizon.
  - HMAC-SHA256 over the private installation reference, pinned V17 HMAC receipt ID and raw-body bytes, using domain-separated context. Sends only three 32-byte fingerprints to an injected DB repository; no raw identifier, secret, phone or message text stored in claim table.
  - Accepts \`claimed\` or \`duplicate\`; DB failure, unknown response, conflicting payload for same MID throws. V17.1E's existing handler maps these failures to its No-Send \`DURABLE_CLAIM_FAILED\` refusal.
  - Does **not** implement or connect to a real hosted database. It must be attached **only after** actual Meta raw-byte HMAC, Page/tester and owner authority verification in the private receiver. The adapter itself does not verify Page ownership.
- \`qa/v152-g10/disposable-pg17/01_atomic_claim_only.sql\`: a **disposable PG17 schema only** (\`t404_g10_disposable_qa\`) containing a private HMAC-digest-only event claims table:
  - Unique key \`(provider, installation_digest, event_digest)\`.
  - A \`SECURITY INVOKER\` claim function invokes **one atomic INSERT ON CONFLICT DO NOTHING RETURNING**. Only the earliest event is \`claimed\`; future exact matches are \`duplicate\`; same event digest + different payload digest is \`conflict\`.
  - Rejects non-Messenger provider and wrong-sized fingerprints. Uses \`REVOKE FROM PUBLIC\`, private nonpublic schema, RLS enabled. No Supabase API exposure, no function \`SECURITY DEFINER\`, no live owner role/caller permission change.
  - Claim table has **no raw identifiers, App Secret, PSID, MID, body or customer data**. Raw payload remains in private receiver memory only during verification; no logging.
- \`qa/v152-g10/disposable-pg17/02_assert_claims.sql\`: positive/negative PG17 tests, data minimization/role privilege assertions.
- \`qa/v152-g10/disposable-pg17/03_concurrency_24_workers.sh\`: starts **24 distinct PostgreSQL backend processes** against same synthetic HMAC event; asserts exactly 1 claimed, 23 duplicates, exactly 1 row and same event/different payload conflict.
- \`qa/v152-g10/bound-atomic-replay-adapter.test.cjs\`: 23 Node22 synthetic source tests, including direct integration with actual pinned \`handleIsolatedMeta\` V17.1E and fake test-only Meta HMAC/QA Page.

This is **not an authorized Supabase migration**. Do not execute these disposable QA SQL files on any hosted or production database. Real Store migration/recovery remains a separate later gate.

## 3. TESTED and evidence

At exact pre-document commit \`9a8a22f8684cb5f410d26d2ea99bd3c8034ec1b5\`, GitHub Actions \`#44016113914\` completed **SUCCESS, 3/3 jobs**, with independently inspected job logs:

- **23/23 new G0.10 Node22 tests PASS**.
- **50/50 actual pinned V17.1E Meta handler tests PASS**; CI checkout exact source SHA \`d5fbd6958635069d15343be573cdbd4b55cc036c\`.
- **266/266 inherited G0.4–G0.9 tests PASS** (G0.9 41 + G0.4–G0.8 225).
- **339/339 total Node22 tests PASS**, 0 failures.
- PG17 **disposable service job PASS**: actual **24 independent DB connections** got **1 claimed / 23 duplicate**, exactly **one row**; altered payload gets **conflict**. SQL positive/negative tests (invalid digest, different installation/MID, wrong provider, private schema, RLS/SECURITY INVOKER, denied untrusted role) PASS.
- Third job **NO-GO is tested by refusal**, not proof that real replay is safe.

**Important test interpretation:** Node mock parallelism and disposable PG17 atomic inserts **prove the candidate design**, not that live n8n Messenger uses it. No real Meta POST replay/duplicate UAT was performed; real n8n dedupe remains the older check-then-record flow.

For PostgreSQL 17 official atomicity semantics: https://www.postgresql.org/docs/17/sql-insert.html .

## 4. What remains BLOCKED

1. Actual original QA Meta App/Page independent owner proof, explicitly approved isolated callback and real No-Send provider-only QA test. Existing one-event shadow uses live Messenger DEMO and sends from legacy branch.
2. Production-grade **privately hosted**, restricted and persistently monitored replay store, with documented retry window, stable HMAC key epoch and safe key rotation, retention cleanup, crash/recovery behavior, per-provider identity and trigger ordering. G0.10 SQL is a reference **only**, and test roles do not constitute a production security design.
3. Authorized zero-downtime cutover from current Messenger **\`rowNotExists\` → later MID recording** to atomic claim **before any sends or Shadow calls**. This would modify Published production behavior and must receive separate Owner approval, snapshot/checkpoint, rollback and live duplicate/manual QA. **Not performed.**
4. Original actual Store owners for 2 Products + 2 Orders, canonical Tenant→Store binding, JWT same-Tenant Shop A/B RLS and independent recovery acceptance. No auto-backfill or hosted DDL/RLS.
5. Zalo OA native webhook authentication and original channel authority, customer cross-channel linking; unrelated to the Messenger replay candidate.
6. No assumption of customer-visible delivery: Meta accepted one original legacy reply, device delivery not independently verified.

## 5. Authority and release gate

- No credential, App Secret, Meta token, customer message, stock, Orders, payment or customer data was read/written by G0.10.
- No new n8n workflow, public endpoint, provider Send or Meta app subscription change; all connected n8n calls **READ-ONLY**.
- Existing Messenger, Shadow and Central Core Published versions remain unchanged during this G0.10 work. They were changed by the parallel authorized V17.13 team before G0.10 and this was explicitly verified.
- **Owner deferred actual local-machine backup**; maintain this task as deferred. This is **not** accepted recovery for Supabase hosted RLS/data migration.
- **LIVE Durable Replay = BLOCKED**. **DISPOSABLE PG17 Atomic Replay = TESTED**.
- All source branches/PRs are Draft, unmerged.

## 6. Minimal rollback

For this candidate, close Draft PR #272: **no live database/workflow side effect to rollback**. Disposable PostgreSQL 17 CI service is automatically discarded after run. Do **not** remove QA assets, rotate credentials, stop the live Messenger workflow, change callback or apply PG SQL to hosted as part of rollback.

If a later separately approved production promotion fails, use an independently reviewed version checkpoint and verify exact Messenger/Shadow/Core active versions before any rollback. Do not assume the earlier legacy Messenger \`d5c96...\` is current after V17.13.

## 7. Next proposed action: G0.11 — Replay Cutover Design × Authorized Zero-Send Test Harness

- Team n8n and Security to review **duplicate-prevention placement**, whether existing MID Data Table recording is atomic, and pre-send idempotency semantics (exactly-once *outbound* is a separate challenge from exactly-once *event claim*).
- Propose an **inactive private test adapter** that simulates upstream verified Meta event and invokes persistent replay claim **without** connecting to the live send branch. Test parallel duplicate, process crash after claim, retries, recovery and owner consent.
- Obtain explicit separate Owner change approval to attach real DB credential, create private replay storage and update any Published workflow. Current G0.10 does not authorize these actions.
- Continue independently verified original Page/Store ownership and current hosted recovery gate; do not block safe source QA on repeated local-machine backup tasks.

**Checkpoint:** \`G10_REAL_SIGNED_SHADOW_4431_4432_4433_VERIFIED__PG17_24_CONCURRENCY_1_CLAIM__339_NODE22_PASS__LIVE_REPLAY_NO_GO\`.
