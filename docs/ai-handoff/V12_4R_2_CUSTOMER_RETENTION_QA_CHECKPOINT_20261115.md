# TIEN404 AI V12.4R.2 — CUSTOMER CORE RETENTION QA CHECKPOINT

Date: 2026-11-15 JST. Environment: source-only staging QA; no production deploy.
Stage: EXPERIMENTAL. Build on existing PR #52, without modifying PR #41 Owner workstream.

## Audited / VERIFIED
- PR #41 Shop B Owner / Sessions and PR #52 Customer AI Reply Pilot remain OPEN in GitHub search. Kept separate; neither merged.
- Customer Core source lives in qa/commerce/v124-core on work/v124-public-ai-reply-pilot-20261115. Catalog, HMAC QA ingress, resolver, PostgreSQL customer sessions, receipts, rate limiter, disabled adapters and blocked cost gate existed prior to this change.
- n8n snapshots: yIJk8LvJoLF40Z62 Published v8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e; sIPs6egzIwOY1GNv Published v8d91d23c-cd87-462f-a112-9cca2340bec8; OgDZNSAvKEvhnAvn Published vf00ba506-c52a-4340-9a0c-809fd9c6ea9a. Reply Guard nKNKDLO4l2PXL4tx / Intent Draft uGesZLvNkhY4ZO6l / Commerce sandbox iyfGUiEsZlNTBWOR remain Inactive.
- Supabase staging ifxlvrhyjhbzbrkdsida audit: tien404_r1_qa.catalog has same fixture SKU F01 across qa-tenant-a / qa-store-a at 159000 VND, stock 3 and qa-tenant-b / qa-store-b at 199000 VND, stock 5; shop bots dry_run + synthetic_qa. No anon/authenticated USAGE on QA schema or SELECT catalog. These are fixtures, not business prices.
- Supabase public products/orders/member tables have RLS enabled and corresponding SELECT policies; no customer-session production schema was created by this task.
- n8n Gateway credits available for OpenAI model type, but NO proven hard quota/cost cap. No paid model inference run by this task.

## Implemented V12.4R.2
- Added qa/commerce/v124-core/postgres/retention.cjs: read-only aggregate inspect of stale customer sessions/receipts; default minimum session retention 24h, receipt grace 5m, bounded batch size 1..250.
- Added an explicitly named sweepDisposableQaOnly method that requires TIEN404_EPHEMERAL_PG=yes, PGHOST=127.0.0.1, PGDATABASE=tien404_core_ephemeral and validates current_database() in a transaction; DELETE uses SKIP LOCKED, bounded batch, no customer ID returned. Never exported from core/index.cjs.
- Four standalone retention policy/privacy/guard tests, one actual PostgreSQL 17 integration test of two expired and one active synthetic sessions and receipt cascade; README and version.qaSuite=12.4R.2-retention-qa. Core lifecycle remains EXPERIMENTAL.
- No hosted retention job, no DB schema, role/RLS/grant change, no n8n change, no channel send, no order/outbox writes.

## TESTED / Evidence
- GitHub Draft PR #62: https://github.com/ngoctien20/demo-git/pull/62; head 0c33a489cb66f8f9fe4e9d3b4d01924d515ad0ae.
- GitHub Actions run 43627755773: safety-tests SUCCESS, 121/121 source regressions, 20/20 disposable PostgreSQL 17 integration tests, zero failures.
- hosted-catalog-read job was SKIPPED for this branch by deliberate branch+secret guard. Do not claim this new branch passed hosted HTTP tests. Previous run of main PR #52 has separate hosted HTTP 9/9, not retested here.
- Separate source compilation + local harness smoke: PASS inspect read-only, reject Supabase-host deletion, bounded SKIP LOCKED queries. No cloud writes.

## Remaining issues / gates
- P0 BLOCKED: customer catalog hosted tenant/store-scoped RLS service role / least-privilege dedicated backend mapping. QA role isolation is tested only with disposable PG17 roles; credentials, migration and grants require explicit approval.
- P0 BLOCKED: reliable external provider authentication and bot-to-shop mapping to this Core; do not connect or publish Zalo/Messenger/Website/Telegram.
- P1 BLOCKED: hard AI budget cap verified for specific trial (0.10 USD max, 10 calls, GPT-5.4 nano as referenced in V12.4R spec). No LLM calls, no changes to billing or credentials.
- P1 BLOCKED: hosted retention requires dedicated maintenance role/RLS approvals, backup, schedule, monitoring, and deletion policy approval. No hosted sweep exists.
- P1 TESTS STILL REQUIRED: real authenticated customer service integration, multi-worker concurrency under hosted RLS, fresh price after merchant changes, actual model QA after cost gate, full end-to-end provider QA.
- P2 PROPOSED: verified wholesale/MOQ, size/color/unit, business product-active fields; current QA catalog cannot assert these.

## Rollback
- Before-change branch: checkpoint/v124r-before-customer-retention-20261115.
- PR #62 remains DRAFT, not merged into PR #52 base; source changes can be dropped without hosted DB rollback. No data deletion occurred on Supabase.
- PostgreSQL 17 in GitHub Actions was isolated and disposed after tests.

## Release
Lifecycle EXPERIMENTAL, candidate evaluation possible only after authorization and model/business integration gates. Do not mark APPROVED or RELEASED or connect any channel. 