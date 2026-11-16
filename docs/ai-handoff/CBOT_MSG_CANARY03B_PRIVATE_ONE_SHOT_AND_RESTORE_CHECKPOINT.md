# TIEN404 — CBOT-MSG-CANARY-03B
## Private QA Recipient Proof × Atomic One-Shot Claim × Independent Patch/Restore Acceptance

**Checkpoint:** 2026-11-17 (Asia/Tokyo)  
**Parent:** [Draft PR #221](https://github.com/ngoctien20/demo-git/pull/221) HEAD `a3946cc4769c454a0a1c3c28104e88e97c928b2b`.  
**Scope:** Page-only deterministic greeting; no real Commerce Store, Products/Orders, Meta send, Supabase migration, credential inspection or Published modification. **RELEASE NO-GO**.

### 1. Verified actual baseline (new READ-ONLY check)

- n8n Published `Z7FdV7uDvApfbURQ`: **ACTIVE 27 nodes**, `activeVersionId=d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`.
- GET `Webhook` and POST `Webhook1` retain the same `tien404-messenger-qa` callback. Agent still has **5 legacy business toolWorkflow connections** plus read-only Products.
- Previous LIVE01 #4176 had HMAC and Meta Send accepted and user-confirmed display; this is delivery evidence, not identity authority.
- Previous 13-case QA workflow `bOaSukunPYUWg2pS` and receiver-pairing `CCb5PTNSRjYc9OfY` are **INACTIVE**. Last #4181 correctly paired one synthetic Page/sender/message ID with original `Prepare Messenger Reply`, but did not test native HMAC or concurrency.
- The operator's screenshot shows **Meta Developer App Administrator**. Native Page Business Full Control is user-attested; no independent Page+app subscribed permissions or a **specific private QA PSID** with owner consent has been certified in this session.
- No verified backend Canary claim table found from n8n Data Tables search; no running exact atomic one-use guarantee on n8n/Pg. **Do not assume the existing n8n Message ID dedup is an atomic global one-grant guard**.

### 2. Independent private recipient evidence — not collected, not faked

Source-only `qa/cbot-messenger-canary03b/private-evidence-redacted-status.json` is **public status**, never a store of actual PSID, Page ID or tokens. It records:
- App Administrator role: `ADMIN_UI_OBSERVED`.
- Page Full Control: `OWNER_ATTESTED`, not independently reviewed.
- App+Page `messages`, designated QA recipient, explicit consent/expiry/revocation, security reviewer, one-message authorization, protected backup and atomic backend: **PRIVATE_EVIDENCE_NOT_PRESENT**.
- `assessPrivateProofRecord` always returns **NO_GO**; changing strings to `VERIFIED` or inserting a token/PSID fails closed. No public checklist or self-signed claim can authorize sending.

**Operator-only private verification procedure, WITHOUT posting secrets here:**
1. In native Meta Page access and Meta Developers, independently inspect current Page owner / Page tasks / App link, `pages_messaging` permission and application status. Verify App-level `messages` and the Page's subscribed-app entry **read-only**. LIVE01 only shows the path worked in that session.
2. Use the exact Facebook QA account that already sent LIVE01; privately associate its Page-scoped sender PSID **obtained by a trusted server from a signed inbound event** with the intended Page and user consent. Do **not** use customer text, an arbitrary pasted ID, or a public screenshot as identity authority.
3. The private registry should store encrypted or protected Page+PSID values, scope to **one Page, one recipient, one explicit greeting, one short expiry**, one-use grant ID, a revocation path, and a reviewer-held decision receipt. The public GitHub record holds only a non-sensitive status and version digest.
4. If native role, Page subscription or QA recipient is absent/expired/unmatched, the release stays NO-GO and no tester should send LIVE02.

### 3. Atomic one-shot contract — at-most-one attempt, NOT exactly-once delivery

- `qa/cbot-messenger-canary03b/atomic-claim-private-gate.mjs` contains **only a synthetic in-memory adapter**, used to test the protocol. It refuses external Page/recipient values; `WeakSet`-issued QA proof cannot be forged by cloning, and every result has `can_send=false`.
- **Grant ID is the unique-key**, not the Meta event ID. Thus a second DIFFERENT Messenger MID cannot use the same one-reply grant. Authorization (signed HMAC, dedup, Page/recipient binding, consent, TTL, exactly one marker) must pass **before** claiming.
- `createSyntheticClaimLedger().claimOnce()` simulates an atomic insertion in one JS execution. **Even 100/100 concurrent local attempts are NOT proof of transactions across n8n workers, processes, database connections, server restarts or Meta retries.**
- `ONE_SHOT_POSTGRES_REVIEW_ONLY.sql` is an unexecuted proposal using `UNIQUE(grant_id)`, `INSERT ... ON CONFLICT (grant_id) DO NOTHING RETURNING ...`, `SECURITY INVOKER`, schema RLS and no public grants. It intentionally lacks real grants/RLS policies and cannot accept arbitrary callers. Real operator/reviewer must evaluate database permissions and backup before applying.
- The claim must be **persisted BEFORE any external Send**, and every sender path must honor it. This design limits attempts, but an interrupted/unknown provider response means delivery may be **zero**; do not auto-retry without explicit incident review. A claimed record is NOT a Meta Send ID and MUST NOT be marked Delivered automatically.
- Required before release: actual database-level concurrency/restart tests, distinct-event replay, multi-instance lock collision, expiration boundary, uncertain-send recovery, rate limits, and no writer/secondary responder reachability on the true deployed graph.

### 4. Independently verifiable source rollback, NOT a real backup

- `qa/cbot-messenger-canary03b/redacted-rollback-rehearsal.mjs` loads the **redacted** 27-node fixture from #221, derives the exact locked source patch and calculates `SHA-256` topology digests.
- Makes an **in-memory, local** candidate copy with 5 added nodes and one replaced routing edge, verifies it is 32 nodes, then reconstitutes the original 27-node redacted topology byte-for-byte (JSON string equivalent) and verifies the original checksum is restored.
- **This is not a full n8n workflow export**, not a private encrypted archive, not a credential backup and **not a deployment/restore test**. Credentials and sensitive node parameters were intentionally removed from the public fixture.
- `qa/cbot-messenger-canary03b/private-backup-restore-public-status.json` therefore reports full export, encrypted archive, independent reviewer and actual restore = **false**. No user-owned backup has been taken or certified by this PR.
- Before production, an authorized private operator must snapshot the **exact current active 27-node workflow**, full node parameters + version + credential-reference inventory (without exposing tokens), encrypted private storage, integrity hash, and conduct **disposable** restore/dry-run with independent security validation. Preserve n8n workflow ID/credentials semantics and app callback. Then sign **exact** patch SHA, QA Page/recipient, expiry, total max sends=1 and rollback instructions.
- **Rollback of source changes:** close Draft PR. **Rollback of live routing:** not applicable today because no live patch was applied. Real future rollback requires a verified full private snapshot and a recorded cutover/restore operation; do not use this redacted file as a restore export.

### 5. Release gates

| Gate | Evidence status | Required |
| --- | --- | --- |
| 03B-01: Published identity and current 27-node topology | VERIFIED read-only | Pin SHA/version and compare before any later edit |
| 03B-02: App role | VERIFIED via screenshot | Native Meta App Administrator |
| 03B-03: One Page + one QA account native consent and PSID | **BLOCKED** | Private verified binding and expiry |
| 03B-04: Atomic one-use contract | SOURCE TEST ONLY | Deployed private transactional backend + durable concurrency proof |
| 03B-05: Patch exact no-writer route | SOURCE LOCKED | Real executable staging regression and cross-message pairing |
| 03B-06: Backup/restore | REDACTED TOPOLOGY REHEARSAL ONLY | Full encrypted operator backup and disposable restore |
| 03B-07: Independent security signoff | NOT PRESENT | Reviewer accepts Page/PSID, patch SHA, recipient scope, rollback and budgets |
| 03B-08: Explicit one-recipient LIVE02 send/publish | NOT GRANTED | Specific scoped user/operator approval after evidence |
| 03B-09: Live one-message acceptance | NOT RUN | Signed event, exactly one Meta Send MID, zero business tools/Orders and user-visible reply |

**No-go** until 03B-03 to 03B-08 have *independent evidence*. The current work is permitted source QA, not the authority to mutate Meta or Published.

### 6. Actual change ledger and next checkpoint

- **VERIFIED:** n8n Published and latest Canary QA workflow remain as in PR #221. No existing global claim table evidence or real private PSID authorization was obtained.
- **IMPLEMENTED:** synthetic at-most-one claim engine; review-only transactional SQL; private proof intake gate; in-memory topology restore rehearsal; dedicated tests and GitHub CI.
- **TESTED:** offline CI at exact HEAD once complete; real LIVE02 is **NOT RUN**.
- **LIVE CHANGES IN THIS MILESTONE:** None (no n8n workflow creation/execute/publish, no database write, no Meta API/provider send, no token, no customer Order). Prior QA workflows stay Inactive.
- **RELEASE:** NO-GO.
- **Next:** `CBOT-MSG-CANARY-03C — Private One-Recipient Attestation × Durable Atomic Backend Approval × Full Backup/Restore Operator Acceptance`. Owner should provide only redacted native Page role/QA recipient confirmation; all PSID/token/backup paths remain PRIVATE. A future real cutover requires *new*, narrow consent for the exact reviewed patch and live send.

**Checkpoint:** `CBOT-MSG-CANARY-03B — Atomic Source Contract × Redacted Restore QA × Private Authority Pending × LIVE02 NO-GO`.
