# TIEN404 — CBOT-MSG-CANARY-03C
## Durable One-Shot Backend × Private Backup/Restore Acceptance × Final One-Recipient Authorization

**Checkpoint:** 2026-11-17 JST  
**Parent:** [CBOT-MSG-CANARY-03B Draft PR #235](https://github.com/ngoctien20/demo-git/pull/235) at `9446f4cdb9c4c10d64fa7264fa50d9b99bb0d055`.  
**Release class:** SOURCE/DISPOSABLE QA only. **Messenger LIVE02 = NO-GO until independent private gates pass.**

### 1. Directly VERIFIED hosted and n8n read-only baseline

- Supabase `tien404-staging` project `ifxlvrhyjhbzbrkdsida`: ACTIVE_HEALTHY, Postgres 17.11; **0** `private_canary.one_shot_claims` tables, **0** `private_canary.claim_one_shot` RPCs, **0** public canonical `stores`, **0** `store_memberships`. These counts came from a read-only SQL transaction; no DDL issued.
- Messenger `Z7FdV7uDvApfbURQ`: ACTIVE, exactly 27 nodes, Published `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`. Existing legacy AI Agent still has five business toolWorkflow links, GET/POST callback unchanged.
- New n8n `get_workflow_history` returned **one** retained saved version: the same Published ID; `get_workflow_version` (read-only) returned **27 nodes**, **23 connection groups**, **3 credential-bearing nodes** (Crypto, Google Sheets Tool, HTTP Request). Node names and connection JSON matched the current live graph.
- **Not a full backup:** n8n version history is evidence that one workflow version can be opened, not evidence of an independently encrypted export or recovery of underlying credential values, encryption key, triggers or external resources. The connector exposes credential reference IDs/names, **not secret values**. No full private backup or disposable restore has been verified.
- Historic LIVE01 #4176 read-only proved signed Page→PSID→Meta recipient/MID match, plus user-confirmed Messenger display; user has native App Administrator screenshot and self-attested Page Full Control. **No signed new LIVE02 grant**, Page-level app subscription review, time-bound recipient allowlist or independent final permission was obtained.
- Prior Canary no-send n8n QA #4177/#4180/#4181/#4190 all remain separate and Inactive. No need to repeat LIVE01 or create duplicate webhook.

### 2. Durable atomicity: actual disposable PostgreSQL CI test, not hosted deployment

Code:
- `qa/cbot-messenger-canary03c/disposable-postgres-one-shot.sql`: schema `canary_disposable_qa`, grant table and claim table keyed by **UUID grant_id PRIMARY KEY**, SHA256-sized hashed app/Page/recipient/marker, expiry/revocation state, transactional `INSERT ... SELECT FROM preapproved grants ... ON CONFLICT (grant_id) DO NOTHING RETURNING`. `SECURITY INVOKER`, RLS-enabled tables, explicit PUBLIC revokes, dedicated `NOLOGIN` runtime role and an unprivileged intruder role. This file is **only for a new empty disposable PostgreSQL service**; not a production migration or approved Store data model.
- `qa/cbot-messenger-canary03c/pg17-disposable-parallel-proof.py`: **64 separate PostgreSQL client connections** (16 workers concurrently) contest the same preissued synthetic grant, verify **exactly 1 winning INSERT and 63 rejected**; confirm no second MID reuse, new connection sees previously consumed grant, expired/revoked or wrong app/Page/recipient/marker denied; outsider cannot read or execute; runtime cannot mint/change grants. No Meta Send, Order, AI model or network outside ephemeral PostgreSQL CI.
- `.github/workflows/cbot-msg-canary03c-disposable-pg17-restore-nosend.yml`: GitHub Actions `postgres:17` disposable service, runs actual `psql` tests and source QA independently. This is meaningful **real SQL test evidence only after a green CI job at the exact commit**. If Actions are absent/pending/fail, do not classify the PostgreSQL test as TESTED.
- **Non-transferability:** a green disposable PostgreSQL CI proves the unique-key transaction pattern for the tested schema and 64 connections. It does **not** create a hosted Supabase table/RPC, prove JWT/RLS, native Meta HMAC, adapter credential isolation, N-worker n8n behavior, actual network failure/restart, provider Send, or real production recovery.

**Important invariant:** A single `grant_id` is consumed once BEFORE any provider Send. The result is **at-most-one attempted send** when *all* routes share the same durable database. If provider Send returns timeout/unknown, do not retry blindly. At-most-once `≠` exactly-once delivered. Different Meta event IDs cannot consume the same grant twice. Only a trusted server may issue the grant after **native signed Page + QA sender + short TTL + consent**; web chat input is never authority.

### 3. Private backup and restore: exact operator certification procedure

Current workflow saved version is a good *comparison baseline*, but `private_encrypted_backup=NOT_VERIFIED`. Before any source patch is promoted:

1. **Scoped written authorization:** operator owns backup action for workflow `Z7FdV7uDvApfbURQ`, exact version above, owner authorizes private export, storage, retention and inspection; independent reviewer signs scope, does not need production login.
2. **Private export:** use n8n's supported workflow download/export mechanism, save full node parameters, connections, settings, version metadata and a credential reference **inventory** to operator-controlled private storage; exclude customer execution data and raw credentials from public artifacts. If the exported workflow contains inline tokens or secrets, treat the export as secret-grade, restrict access and never paste/upload to GitHub/ChatGPT. Exported credential *references* alone do not contain the underlying credential secret or guarantee recovery.
3. **Encrypt before transport:** AES-256 or equivalent private store with separately held key and retention policy. Generate a local cryptographic SHA-256 digest and verify archive integrity. Do not post archive contents, hashes tied to raw secrets, paths or encryption keys into public issue comments.
4. **Disposable restore:** on a separately authorized inactive disposable n8n environment, import the workflow without activating webhook, compare 27 nodes/23 connection groups and node parameter inventory, verify credential mapping with placeholders or separately authorized recovery secrets, test GET verification logic with synthetic data, confirm no Meta Send/business tool/Orders. Never attach the live Page callback or live token during restore.
5. **Reviewer acceptance:** independent reviewer checks exact source/version, complete archive scope, role/credential restoration limitations, backup integrity, disposal, and operator rollback runbook. Record only `private_receipt_id`, `date`, `approved scope`, `attestation outcome` in a private ledger. Do NOT use a screenshot of a 27-node editor or n8n Version History alone as backup/restore proof.
6. **Rollback validation:** record authorized cutover patch SHA and a deterministic procedure to revert to the saved original 27-node version and confirm signed Messenger HMAC and single responder without touching customer Orders. Test with synthetic events first. **Actual rollback must not be attempted on production until the owner authorizes that change.**

**Partial backup caveat:** Prior local Supabase application archive missing Auth/Storage is **not** a full Supabase service recovery proof. It must not be reused to approve an n8n workflow recovery or Commerce migration.

### 4. Private one-recipient final release ticket

The owner can choose the same Messenger account used for LIVE01, now technically matched from a real signed event to the Meta send recipient. However, the final authorization ticket MUST independently specify privately:

- The exact Page and App authorization/permissions, reviewer identity and fresh consent; one QA recipient PSID securely bound server-side to a verified signed inbound event, not pasted client text.
- `grant_id` kept secret and one-time, expiry ideally minutes (not indefinite), exact input marker `TIEN404-CANARY-LIVE02`, fixed reply hash, send budget **1**, and explicit no Commerce/customer data access.
- Actual versioned **executable** n8n patch that isolates CANARY→Prepare→existing single Meta Send with **zero writer tools**, controls normal customers and double responder, and preserves HMAC/dedup; staging tests include one/multiple messages, concurrent event ID collisions and uncertain-send recovery.
- Deployed private durable transaction, least-privilege authenticated caller, all recipient proof and atomic tests; reviewer-approved private full backup and disposable restore.
- Final **specific written owner/operator authorization for the exact patch SHA/version/one-send scope**, not inferred from an earlier generic agreement to run QA. Mark LIVE02 as `NOT_SENT` until that action is explicitly authorized.

### 5. Milestone gates with honest evidence

| Gate | Current | Evidence required to upgrade |
| --- | --- | --- |
| Native Meta App Admin | VERIFIED via supplied developer screenshot | App role only; not Page Business full-control |
| LIVE01 Page/PSID/MID chain | VERIFIED real event #4176 | Historical identity correlation, not a new grant |
| Hosted one-shot backend | **ABSENT (VERIFIED)** | Approved migration and least-privilege RLS/function on target |
| PostgreSQL transactional design | IMPLEMENTED source | Exact SHA CI green with 64 sessions, then staging independent |
| Multi-worker durable atomicity in target | **BLOCKED** | Real target transaction/concurrency/restart proof |
| n8n original version inventory | VERIFIED | 27 nodes, 23 connections, 3 credential-bearing nodes |
| Encrypted full independent backup | **BLOCKED** | Operator private archive and integrity receipt |
| Disposable n8n full restore | **BLOCKED** | Independent credential/parameter/route restoration QA |
| One private Page/recipient LIVE02 grant | **BLOCKED** | Fresh native ownership/consent + expiring allowlist |
| Exact executable safe patch + signed approval | **BLOCKED** | Independent patch diff and security rollback signoff |
| LIVE02 one real message | **NOT RUN — NO-GO** | Approve exact one-send action after all prior gates |

### 6. QA, security, change ledger and rollback

- **VERIFIED:** Supabase staging read-only counts; n8n active and version history; historical signed LIVE01 recipient match. No secret values or PSIDs copied into source files.
- **IMPLEMENTED:** disposable PostgreSQL DDL and 64-connection runner; CI wiring; fail-closed status gate; private recovery and final consent SOP.
- **TESTED:** only after exact-head CI reports success; otherwise source `NOT YET VERIFIED`. Prior n8n #4190 synthetic one-process test remains PASS but is not PostgreSQL proof.
- **NO LIVE WRITES:** Supabase staging not migrated, n8n Published not edited/published/unpublished, Meta app/page/tokens not changed, no new provider sends or Order/customer writes.
- **ROLLBACK:** close Draft PR to undo source-only additions. PostgreSQL CI service is ephemeral and discarded. n8n QA workflows created in earlier milestones remain INACTIVE and are not deleted by closing the PR. There is no 03C production rollback because no production cutover occurred.
- **NEXT:** `CBOT-MSG-CANARY-03D — Verified Disposable PG Atomicity × Private Full Workflow Backup Operator Acceptance × Scoped LIVE02 Release Decision` (only after this CI and private evidence).

**Decision until all high-risk gates:** `CBOT_CANARY_LIVE02=NO_GO`.
