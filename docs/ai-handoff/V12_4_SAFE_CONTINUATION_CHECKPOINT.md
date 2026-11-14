# TIEN404 AI — V12.4 Safe Continuation Checkpoint

**Recorded:** 2026-11-15 JST (from DB observations at 2026-11-14 15:30 UTC)  
**Stage:** EXPERIMENTAL / STAGING / Draft PR #41  
**No production change. No new credential. No Zalo auto-send. No Order commit.**

## 1. VERIFIED — Supabase and active systems

- Supabase `tien404-staging` ref `ifxlvrhyjhbzbrkdsida`, PostgreSQL 17.11.
- Existing migration `20261114144917_v12_3_shop_b_private_session_qa` still installed. `tien404_dialogue_private.shop_b_sessions` and `shop_b_receipts` remain **0 / 0 rows** after V12.4 attempts.
- QA Shop A: 2 orders + 2 outbox. QA Shop B: 2 orders + 2 outbox. Shop B F01 price `199000 VND`, stock `5`; `nonheld_outbox=0`. No customer data modified.
- Roles `anon`, `authenticated` and `service_role` still have **no schema USAGE or table SELECT/INSERT** on private dialogue schema. No backend DB executor provisioned.
- Cloudflare Zalo outbound gateway version `ef7b7a33-5551-48e0-954b-646c047b5c6d`, `ZALO_SEND_ENABLED=false`.
- Zalo Shadow `OgDZNSAvKEvhnAvn` published `f00ba506-c52a-4340-9a0c-809fd9c6ea9a`, remains active.
- **Concurrent change from another workstream:** V1 protected Zalo webhook `yIJk8LvJoLF40Z62` has new published version `8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e` (history: V12.3 customer-routing read-only EXT03). Diff versus previous `08f22ee1-cf5a-4459-bd33-bf80ac67af0e`: **4 nodes + 4 edges, 0 existing nodes/edges removed or modified**. This branch calls `sIPs6egzIwOY1GNv`; it is independent of Shop B session work. No attempt to revert/publish it. This is not proof of full customer-router security acceptance.

## 2. PostgreSQL concurrency investigation

**Attempt V12.4 via Supabase connector (2 separate DB PIDs):**

- Synthetic row only: scope `repeat('f',64)`, binding marker `V12_4_BENCH_TIMING_QA`.
- Holder A: PID `452583`; row lock acquired `2026-11-14T15:20:20.854171Z`, released around `15:20:28.862370Z`.
- Waiter B: PID `452585`; requested lock at `15:20:33.914058Z`, returned `15:20:33.914902Z`; wait **0.000844s**.
- These are **distinct PostgreSQL backend processes but not overlapping**. The Supabase MCP executor dispatched B too late for contention. Therefore **DO NOT mark the real row-lock race PASS**; previous V12.3 attempt was also inconclusive.
- Both attempts cleaned ONLY their named QA fixture. Post-readback confirms sessions and receipts **0/0**. No grant, extension install, schema edit or production writes.

**Next acceptance mechanism:**
`qa/zalo/v124-two-session-lock.sh` runs **two independent psql OS processes** with a synchronized `LOCK_HELD` barrier. It refuses non-staging host/project, requires explicit QA flag, forbids transaction pooler port 6543, waits for actual row-lock contention and enforces at least 1.5 seconds wait and distinct Postgres PIDs; cleans only named fixture via trap. **CI only checked `bash -n`: script has NOT yet been run against Supabase**.

Run only in a trusted developer/Work environment with an approved staging DB connection (use an existing secret manager or `PGPASSFILE`, never GitHub/chat). Do not grant browser roles or upload a database password to the repo. A session-pooler or direct Postgres connection is required.

## 3. IMPLEMENTED — Shop B owner signed ingress resolver candidate

New, **not deployed**, `qa/zalo/shop-b-trusted-owner-resolver.cjs`:

- Accepts fixed, canonical Zalo V1 normalized inbound envelope, signed with **independent server-only HMAC-SHA256 key** (not Zalo Bot Token) and max ±120s timestamp skew.
- Fixed Shop B-only query to `tien404_r1_qa.owner_bindings`, `owner_pairing_claims_v3`, `shop_bots`; checks pairing `paired`, claim `CONFIRMED`, exact recipient, `dry_run`, `synthetic_qa`, non-expired.
- Returns trusted `owner` / `event` shape for existing `processTurn()` and Postgres adapter. Derives a stable SHA256 binding namespace that changes after re-pair. No raw sender stored in session/outbox and no Orders/Zalo writes.
- Rejects unsigned/forged events, wrong bot, group chat, expired signatures, mismatched claim, replay attack at the session receipt layer.
- **Not yet connected to V1 or customer router.** No bridge HMAC secret is created. Provider ingress must first verify Zalo webhook authentication and securely sign; no client or AI can self-attest `source_verified=true` or supply the HMAC key.
- Intended for **Owner Shop B QA only**, not a public-customer path or a generic multi-tenant authorization pattern.

## 4. TESTED

- `qa/zalo/shop-b-trusted-owner-resolver.test.cjs`: **32/32 PASS** with synthetic HMAC key, fake DB provider and no credential.
- Combined GitHub CI **148/148 PASS**: 44 conversation + 44 session + 28 Postgres adapter fake-pool + 32 trusted Owner resolver. Run: `43610439701`, job `132494140542`. Bash `-n` of two-psql QA script succeeded.
- Unit tests are not equivalent to real HMAC bridge deployment or real PostgreSQL contention.
- Supabase private RLS, role denial, unique scope/receipt constraints and rollback were already tested on real SQL in V12.3. No new database migrations in V12.4.

## 5. BLOCKED / RISKS

**P0:** No proof yet of actual simultaneous database row lock + same receipt contest; tools currently dispatch calls sequentially in our measured attempts.

**P0:** Need approved private staging DB credential with least privilege and secure server-only HMAC key to test the actual adapter. No credentials exist in this workstream and no new grants were made.

**P0:** Provider webhook normalized event signature, persistent session service and store-scoped catalog readback have not been integrated. Current published Shadow still only supports single-turn read-only QA preview, not true conversational order processing.

**P0:** Existing `tien404_r1_qa.commit_order_qa` must remain unconnected to Zalo chat until separate write approval after transaction tests, explicit confirmation and data readback.

**P1:** Zalo outbound auto-reply `ZALO_SEND_ENABLED=false`, never enable without separate Owner permission and provider policy checks. Full physical Supabase backup/PITR still unverified.

## 6. APPROVAL REQUIRED

Before extending into next phase, obtain separate explicit approval for:
- Creating or referencing **least-privilege backend Postgres credential** and secure HMAC key in staging secret manager (no secret disclosure to chat / frontend / Sheets).
- Enabling **read-only** bridge of HMAC-verified inbound to the private session adapter (after DB concurrency accepted).
- Later: distinct approval for sandbox Orders commit and for any outbound Zalo auto-reply.

This V12.4 step made only additive GitHub code/test/doc changes in Draft PR #41. No approval was assumed for credentials, webhook publishing or Orders.

## 7. CHECKPOINT / NEXT

- Latest tested source SHA `7cf796de9fc506e9fb62ce118bd3f232841762df` (148 tests pass).
- Draft PR #41 remains **OPEN / DRAFT**, base `work/v12-r1-shop-owned`.
- Next: run `qa/zalo/v124-two-session-lock.sh` using a trusted staging Postgres session-pooler/direct connection after secret/config approval. Confirm holder/waiter distinct PID and measured wait >1.5s, then perform concurrent duplicate-receipt test.
- Validate current independent V12.3 customer-router branch separately; do not mix Owner and public-customer sessions.
- Only after evidence and signoff, develop HMAC ingress bridge and read-only integration, then new approvals for Order sandbox write and auto-reply.

**Rollback:** Revert/close PR #41 for V12.4 code; no V12.4 database/Cloudflare/n8n rollback needed. V12.3 private tables retained, empty and inaccessible.
