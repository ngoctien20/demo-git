# TIEN404 — RPC17.8 Private Disposable Supabase QA Admission & Real JWT A/B Runbook

**Version:** 2026-11-17 JST. **Status: PROPOSED / SOURCE-ONLY; DO NOT DEPLOY OR EXECUTE A STAGING MIGRATION.**

## Current verified state
- GitHub parent: RPC17.7 Draft PR #347 HEAD `9ed17301966995976af4fab4ac7f0791da429920` at branch creation, CI 454/454 source-only PASS.
- Supabase staging `ifxlvrhyjhbzbrkdsida` ACTIVE_HEALTHY; zero active Supabase development branches as of audit. **Creating a new Supabase branch is not free by default and requires quoted cost + explicit approval.**
- Read-only SQL: `rpc178_qa` does not exist; no `public.stores` or `public.store_memberships`; no `store_id` columns on public Products/Orders. 3 Auth users and 2 users with session rows, which are NOT real independently verified A/B Store sessions.
- RPC17.6 disposable PG17 test (36/36 RLS assertions + 412/412 Node tests) is **not** real Supabase Auth/JWT UAT.
- No new Cloudflare Access, DO, R2, n8n, Messenger, Zalo, billing or user data writes in RPC17.8.

## Authorization decision — staged gates

**M0. Private owner/operator admission: NOT ACCEPTED.** Sole founder may approve a bounded **disposable test-only** scope, but self-asserted Store ownership does not replace cryptographic, server-side QA identity verification. Independently record owner identity, scope, MFA/session, baseline, consent expiry, operator access, budget cap and rollback. Do not put source IDs or proof documents in GitHub or ChatGPT.

**M1. Proposed disposable Supabase QA schema: NOT AUTHORIZED.** Before creating `rpc178_qa`, require:
1. Exact database/schema inventory and verified snapshot/restore procedure, checksum/rollback artifact, owner consent specifically naming `rpc178_qa`, and independent security reviewer acceptance.
2. Compare additive schema against the prior `qa/v152-rpc176/sql/disposable-schema.sql`. Never execute that test file in Supabase; it creates `auth.uid()`, `authenticated`, and synthetic fixtures that are only safe in disposable Postgres.
3. Dedicated private QA role with minimum grants, prevent exposure of raw QA schema in Data API until explicit scoped security review; do not alter existing public Store, Orders, Products, RLS, credentials or sessions.
4. No real Merchant orders, phones, IDs, documents, imported production data, callbacks, egress or sends.
5. Migration begins only after explicit user approval for the exact DDL and remediation/rollback; no automatic rollback via DROP without separate authorized inventory.

**M2. Real Auth A/B: BLOCKED.** To run real JWT tests, require two independently verified Supabase Auth accounts, distinct live sessions (not merely session table rows), canonical trusted Store A/B membership records, and a private approved test endpoint implementing `rpc178_qa.products` under PostgREST RLS. Authentication via `/auth/v1/user` verifies Auth-reported user identity but DOES NOT alone verify current active session/revocation or true Merchant ownership; add private session/ownership validation. Never send raw JWTs to tools, GitHub CI, ChatGPT, code review or logs.

**M3. Private no-send GET-only diagnostic: NOT EXECUTED.** The optional `qa/v152-rpc178/private-runner-cli.mjs` must be launched only by an independently authorized operator on a private workstation with a verified secret broker. It refuses by default; it can ONLY request:
- `GET https://ifxlvrhyjhbzbrkdsida.supabase.co/auth/v1/user` for each of A and B;
- `GET .../rest/v1/products?select=id,tenant_id,store_id&id=eq.<uuid>` with `Accept-Profile: rpc178_qa` and each respective JWT.
- Four observations: A→A one fixture row, A→B zero; B→A zero, B→B one. No content beyond UUIDs. No POST/PATCH/PUT/DELETE, no browser/webhook send, no R2, no scanner or production transaction.
The CLI is **only** a diagnostic and its `DIAGNOSTIC_PASSED_HUMAN_REVIEW_REQUIRED` is NOT release, not a Store authorization receipt, not independent security acceptance and not a substitute for revoked-session or cross-Tenant UAT. It must not be run against public legacy `products` while they have tenant-only RLS.

## Acceptance evidence to collect privately (not supplied yet)
- Independent owner and security reviewer signed scope, approved staging-only schema, MFA, cost/rollback and restore evidence, code SHA.
- Two live JWTs privately held; verified Auth issuer + expected user ID + active session IDs and canonical Store A/B owner records, external cross-Tenant C test.
- Direct PostgREST authenticated role read-only RLS positive own-store and negative cross-store reads, revoked user, inactive Store, stale authority, false `user_metadata` role and no-send evidence.
- Evidence must be blinded to counts, statuses and correlation IDs, not raw JWT, PII or documents.
- Independent reviewer records **GO/NO-GO** based on actual evidence. This source implementation **cannot set GO**.

## Current user approval needed
Explicit approval for **disposable schema-only staging work** after presenting exact DDL, isolated role/grants, zero-cost/quoted-cost expectation, pre-change backup and rollback evidence, and exact UAT fixture. If new Supabase branch is required, consult `get_cost` and obtain user confirmation before creation. Do not interpret this document or a project phase name as approval to mutate the database.

## Rollback and status
This RPC17.8 PR only adds source files and CI. Roll back by closing/reverting this Draft PR. No new hosted resources exist from RPC17.8. Separate RPC10 CI failure remains unresolved.

**CHECKPOINT: RPC178_SOURCE_ONLY · PRIVATE_JWT_GET_RUNNER_MOCK_TESTED · REAL_STORE_AB_JWT_NO_GO · SUPABASE_MIGRATION_UNAUTHORIZED · HOSTED_NO_GO**
