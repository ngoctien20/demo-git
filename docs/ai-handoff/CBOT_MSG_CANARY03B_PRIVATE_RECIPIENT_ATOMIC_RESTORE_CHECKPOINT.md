# TIEN404 AI — CBOT-MSG-CANARY-03B
## Private Messenger QA Recipient Evidence × Atomic One-Shot Claim × Independent Patch/Restore Acceptance

**Checkpoint:** 2026-11-16 JST · **Proposed release: NO-GO until proof completed**  
**Parent:** [PR #221](https://github.com/ngoctien20/demo-git/pull/221), HEAD `a3946cc4769c454a0a1c3c28104e88e97c928b2b`.  
**Published baseline:** `TIEN404_MESSENGER_TEST`, workflow `Z7FdV7uDvApfbURQ`, active version `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`, **27 nodes**.  
**Scope:** Page-only, one-owner-approved greeting, one intended QA Facebook account, zero Orders/Commerce/Customer data. Source-only; no change to real Meta Page, Published n8n or Supabase.

### 1. Direct independent READ-ONLY recipient provenance (real Meta)

Inspected actual signed Meta webhook **execution #4176** with full input/output in connector **without exporting identifiers**:
- One inbound `TIEN404-CUSTOM-LIVE01` message and one Meta outbound send were recorded. Meta signature HMAC and signature gate succeeded.
- Inbound `pageId`, `senderId`, `messageId` match `Prepare Messenger Reply` values for the same run; `Send Messenger Reply` response `recipient_id` equals that original sender; `message_id` equals downstream verified `metaMessageId`.
- User explicitly acknowledged viewing the matching LIVE01 reply. Developer role screenshot separately shows Meta App **Administrator**.
- **VERIFIED:** event-level Page+PSID pairing and Meta send acceptance; same user self-reported the visible receipt.
- **NOT VERIFIED:** Native Business Page `Full Control` (self-attested only), current App/Page `messages` subscription read-only evidence, that this historic PSID has been explicitly nominated/consented and placed in an expiring **private** production allowlist, or independent security reviewer signature.
- No real Page ID, PSID, token, Meta MID or customer data persisted in `qa/cbot-messenger-canary03b/live01-private-recipient-provenance-20261116.json`. **Do not paste PSID, token, app secret or Page Access Token into ChatGPT, GitHub, logs or screenshots.**

**Private owner intake:** In the legitimate operator portal, the owner must bind *the exact native Page/PSID pair seen in LIVE01* to a **one-recipient**, one-use Page-only QA scope; verify user/tester consent and the App Developer/Tester entitlement if App remains unpublished. Store that binding and expiry (maximum 10 minutes) with HMAC-SHA256 digests under a key that remains outside GitHub. Have a separate reviewer compare native Page permissions and candidate scope, then issue two signed non-sensitive ticket digests. Merely writing `approved=true`, reporting "I'm admin", supplying a screenshot or matching a reply is not enough to grant a live route.

### 2. Atomic one-shot — concrete SQL and failure semantics

A previous project prototype at [PR #127](https://github.com/ngoctien20/demo-git/pull/127) used `qa/v15-hosted-readiness/atomic-replay-d1-DRAFT.sql` for synthetic nonces (Primary Key scope+nonce). This candidate builds on that **principle**, does not copy an experimental fixture into Commerce or silently enable it.

Two review-only PostgreSQL scripts:
- `qa/cbot-messenger-canary03b/PRIVATE_PAGE_ONE_SHOT_SCHEMA_REVIEW_ONLY.sql`: an isolated, non-exposed `t404_canary_private` schema containing short-lived, owner- and reviewer-approved Page/QA-recipient HMAC binding and **immutable** one-shot send-claim ledger with `PRIMARY KEY(canary_id)` plus `UNIQUE(event_hmac)`. Explicit REVOKE for PUBLIC/anon/authenticated, FORCE RLS on both tables. **No worker grants or public RPC policies are defined**. No real PSID/Page ID, customer data, tokens or Commerce Orders.
- `qa/cbot-messenger-canary03b/PRIVATE_ONE_SHOT_ATOMIC_CLAIM_REVIEW_ONLY.sql`: a transaction that locks the pre-approved private authorization `SELECT ... FOR UPDATE`, checks exact Page/PSID/profile HMAC, signed marker, APPROVED state, 10-minute TTL, then uses `INSERT ... ON CONFLICT DO NOTHING RETURNING canary_id`. **Exactly one committed returned row** constitutes permission for *at most one application-level send attempt*, subject to every other external authorization/release gate. Zero rows, timeout or error => no send. Nothing has been applied to Supabase.
- The parameter values must be created by a **trusted verified Meta webhook processor**, not client text, Page ID in the body, OpenAI Agent output, querystring or a public Supabase RPC. The source DDL is not permission to create a privileged RLS-bypassing worker.
- **Critical failure distinction:** database claim is transactional; **Meta HTTP send is not in the same DB transaction**. If the worker crashes after claim, 0 sends may occur. If the provider times out after accepting a send, outcome is UNKNOWN; **never auto-retry**, never delete/rearm a claim. Therefore this is `AT_MOST_ONE_APPLICATION_SEND_ATTEMPT`, NOT guaranteed exactly-once Meta delivery/read receipt.
- A live n8n implementation would have to disable HTTP auto retries, use a trusted DB claimant with proper RLS, enforce no global model/business tools on QA path, and protect arbitrary repeated events and concurrent workers. **Not implemented in Published.** Existing n8n Data Table skip-duplicate/JavaScript Set cannot certify this durable atomic claim across executions.

### 3. Independent QA setup: source restore, SQLite and real PostgreSQL 17 (DISPOSABLE ONLY)

- `qa/cbot-messenger-canary03b/sqlite_one_shot_reference.py` and `test_atomic_one_shot.py` model durable unique constraints with separate SQLite connections/processes, including wrong Page/PSID/config, revoked/expired, replay, races, restart and UNKNOWN send result. **SQLite acceptance is not PostgreSQL acceptance**.
- `qa/cbot-messenger-canary03b/ci_pg17_disposable_claim_restore.sh` executes the **actual source PostgreSQL CTE** against a **new disposable PG17 CI database**, with a hard environment gate `CI_CANARY03B_DISPOSABLE=YES`, exact host, DB, PostgreSQL major and test-only role. It launches **16 independent concurrent PostgreSQL connections** against one approved synthetic campaign, validates exactly one returned claim, wrong Page/PSID and revoked cases, cross-campaign replay uniqueness, private schema privilege restrictions, then `pg_dump`s the **fake schema only** and `pg_restore`s it into a *second disposable CI database*, checking one claim, two FORCE RLS tables and uniqueness constraints.
- **No live Hosted Supabase schema, credential, Orders, token, or customer data** is used. No real Meta Send is made. The synthetic PG17 restore is **not** the n8n Published workflow backup/restore.
- `qa/cbot-messenger-canary03b/independent-restore-roundtrip.mjs` and tests independently apply the **locked** PR #221 27→32 source-only patch in memory and reverse it to the identical **redacted 27-node topology**, detecting extra Send/webhook, mutated existing Agent/tools, unapproved node credentials, missing guard lock and any unintended original-node change. This QA is independent *test code*; **not an independent human security review or hosted restore certification**.

### 4. Real n8n restore source (READ-ONLY) — version is retrievable, backup NOT CERTIFIED

Queried actual n8n `get_workflow_history` then `get_workflow_version`:
- A **single visible saved version**: `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`, created `2026-11-11T10:08:02.477Z`, title `V10.1 Messenger Pilot draft — no echoed prices or ID requests`.
- Successfully retrieved all **27** nodes and connections; node metadata and connections matched the current Published workflow. **Three credential reference slots** were present, no secrets exported.
- The project can *currently* retrieve that history version. This is useful for a rollback operator but **not** an encrypted archive; version retention can prune older entries. No separate private export, archive checksum, n8n version-consistent restore rehearsal, credential rebinding or actually exercised Published rollback has occurred.
- Evidence receipt `qa/cbot-messenger-canary03b/original-published-restore-source-evidence.json` intentionally contains metadata only, not the sensitive full workflow JSON.

### 5. Independent release / authorization decision

| Gate | Now | Required to move forward |
|---|---|---|
| R0 LIVE01 exact Page→PSID→Meta recipient match | **VERIFIED, event-level** | Accepted as source-of-QA-person identity |
| R1 Native Page/admin + App/Page subscription | **PENDING** | Private first-party rights + `messages` App/Page and recipient tester entitlement |
| R2 One-recipient signed/private consent and HMAC registry | **PENDING** | Owner + independent reviewer, Page+PSID, TTL and profile digest; keep data private |
| R3 Atomic claim semantics and concurrency | **TESTED on disposable PG17; HOSTED NOT TESTED** | 16 concurrent contenders→one win, then authorized hosted isolated service QA |
| R4 Hosted claim DB privilege/RLS and operational wiring | **NOT DEPLOYED** | Authorize migration and credential scope; trusted signed webhook binding |
| R5 Source 27→32→27 restore equivalence | **SOURCE QA TESTED; hosted restore NOT TESTED** | 27→32→27 redacted round-trip PASS; real n8n restore pending |
| R6 Real original n8n encrypted backup & restore rehearsal | **NOT CERTIFIED** | Private operator export, checksum, isolated recovery test, backout and version verify |
| R7 Final one-recipient one-send Publisher authorization | **NOT GRANTED** | Exact workflow diff+version, same QA actor, one event, TTL, rollback and external reviewer |
| R8 Real LIVE02 | **NOT RUN** | Only after R1–R7, no writer execution, single MID, owner confirms rendered greeting |

**Important:** User previously explicitly authorized controlled Canary testing. It is sufficient for synthetic source/QA work. **It is not automatic permission to apply hosted schema, use Page Access Tokens, modify n8n Published, generate or send a real Messenger reply, or bypass private security review.**

### 6. Checkpoint / change ledger / rollback

- **VERIFIED:** LIVE01 native execution #4176 Page/PSID/MID equality, user receipt; original Published workflow 27 nodes and history pinned version retrievable (read-only). No sensitive identifiers included.
- **IMPLEMENTED:** source-only private proof record, review-only PG SQL, independent redacted source restore harness, durable SQLite disposable QA, PG17 CI harness and release gate; no hosted changes.
- **TESTED:** 259/259 source Node tests, 19/19 disposable SQLite tests and 16-way disposable PostgreSQL 17 atomic claim plus separate synthetic schema archive/restore PASS. This is NOT hosted Supabase authorization, not original n8n rollback certification, and not LIVE02.
- **BLOCKED:** Native exact one-recipient consent, production atomic claim/RLS wiring, encrypted full n8n backup, independent human reviewer, exact production patch, one-send authorization and real LIVE02.
- **Live changes:** **None**. Existing Messenger Published `Z7FdV7uDvApfbURQ` remains unchanged; QA workflows `VSmXkK7Y1Bb3Dg2w`, `bOaSukunPYUWg2pS` and `CCb5PTNSRjYc9OfY` remain inactive. No new n8n workflow is needed for this milestone.
- **Rollback:** Close this Draft PR to remove source-only files. Disposable CI databases are destroyed by GitHub-hosted job lifecycle. No existing Production or hosted Supabase rollback required as nothing is deployed.

**Next decision after CI:** `CBOT-MSG-CANARY-03C — Private One-Recipient Authority Evidence × Isolated Claim Service & Real n8n Restore Rehearsal`. If R1/R2 and R6 cannot be verified, continue NO-GO, do not send LIVE02.

### 7. FINAL independently observed CI and hosted unchanged — 2026-11-16 JST

**Exact test evidence from GitHub Actions** [run #43877871533](https://github.com/ngoctien20/demo-git/actions/runs/43877871533) (at commit `bf6633045fdfd6084f22c05605af6542b5e4a6d3`, prior to this final documentation update):

- **4/4 jobs SUCCESS**, including release NO-GO gate.
- **259/259 Node.js source regression tests PASS** (19 independent redacted 27→32→27 tests + 240 inherited Messenger and Merchant security source tests).
- **19/19 SQLite disposable tests PASS**: 24-thread and 8-process contention with independent durable connections, wrong Page/PSID, expired/revoked owner, config mismatch and unknown-provider-outcome no-retry. Two initial QA harness errors (SQLite connection failure escaped try and a static lint test matching its own prohibited literal) were corrected; the final exact CI has no such failures.
- **Actual PostgreSQL 17 disposable job SUCCESS**: 16 concurrent independent SQL connections competing for one approved synthetic campaign produced **exactly 1 winner**, 15 non-winners; wrong Page, recipient, profile, revoked permission, different event and cross-campaign replay blocked. This ran the exact reviewed SQL CTE (not a hand-coded in-memory mock) from `PRIVATE_ONE_SHOT_ATOMIC_CLAIM_REVIEW_ONLY.sql`.
- The synthetic private PostgreSQL schema was `pg_dump`ed and `pg_restore`d into a second disposable database, validating 1 claim, 2 FORCE RLS flags, two primary/unique constraints. **No hosted Supabase or n8n data backed up.**
- Final rule-based release job completed **SUCCESS with explicit LIVE02 NO-GO**. CI green does not transform external authorization gaps into permission to send.

**Final connected read-only checks:**
- Supabase staging `ifxlvrhyjhbzbrkdsida`: `t404_canary_private` **schema does not exist, 0 canary tables**. No migration or private QA claim service deployed.
- Messenger Published `Z7FdV7uDvApfbURQ`: **ACTIVE, unchanged exact version `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`, 27 nodes**.
- The three existing manual QA workflows remain **INACTIVE**: `VSmXkK7Y1Bb3Dg2w` (2 nodes), `bOaSukunPYUWg2pS` (4), `CCb5PTNSRjYc9OfY` (6). No new n8n execution, Meta response, paid model, Orders or token action in this milestone.

**Release decision remains: `CANARY03B_NO_GO_LIVE02`.** Blocking items are a privately authenticated Page+one QA recipient binding, an independent reviewer-approved event+config, an approved hosted least-privilege claimant and concurrent ingress integration, an encrypted private export of the **actual** n8n original workflow, independent n8n restore rehearsal and explicit authorization of the **final** one-recipient one-send patch. These are more than source test checkboxes, and this checkpoint does not silently approve them.
