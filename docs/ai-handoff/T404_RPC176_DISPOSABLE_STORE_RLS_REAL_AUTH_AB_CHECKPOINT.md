# TIEN404 AI — RPC17.6 Disposable Store Authority Schema × Independent RLS Negative QA × Real Auth A/B Admission

2026-11-17 JST · SOURCE-ONLY GITHUB · LOCAL POSTGRES 17 CI · HOSTED NO-GO

## Parent / verified baseline
- RPC17.5 Draft PR #341, HEAD `0ba2facadb6179efbe176438e69f25fdb7e0d75e` (388/388 source-only PASS).
- Supabase staging `ifxlvrhyjhbzbrkdsida` ACTIVE_HEALTHY, existing public Commerce Products/Orders read policies restrict by tenant membership but have no Store-specific constraint. No Store authority migration performed.
- Preserve RPC16 Access DENY ALL, inactive Worker, disabled previews, private R2. No Cloudflare/Supabase/n8n/Meta/Zalo mutations.

## Delivered source scope
1. `qa/v152-rpc176/sql/disposable-schema.sql`: PostgreSQL 17-only disposable schema `rpc176_qa`; synthetic tenants, Store A/B within same tenant, Store C other tenant, active and revoked memberships, products and orders. Add RLS + FORCE RLS on all six tables; Store membership + Tenant membership + authority version required; Store-scope `USING` policies, product INSERT `WITH CHECK`. TEST SQL ONLY — not a migration.
2. `qa/v152-rpc176/sql/independent-rls-negative.sql`: actual Postgres role `authenticated` under fake `auth.uid()` claim injection on disposable fixture, verifies A cannot read/write B, B cannot read A, cross-tenant denied, Tenant-only manager no Store access, revoked membership, staff restrictions, stale version, disabled store, absent UID and forged user_metadata ignored. Real DB engine RLS, but NOT real Supabase Auth signature verification.
3. `qa/v152-rpc176/private-auth-admission.mjs` and tests: 14 independent human/auth/hosted evidence gates and no-token/no-send/default deny. Synthetic all-true declarations cannot assert real live JWT evidence or grant hosted actions.
4. GitHub Actions PostgreSQL 17 service is isolated/disposable per job and uses fabricated IDs and password; no connection to staging Supabase; no hosted Cloudflare resources or uploads.

## Verified vs missing
- Source and disposable PostgreSQL test outcome must be read from exact GitHub Actions run before claiming PASS.
- No **real** JWT A/B received or validated; no real hosted Store A/B membership changes; current staging has no canonical Store Authorization or commerce store_id.
- Do not use self-declared custom claims as proof; for real UAT use private authenticated PostgREST with separately verified real Supabase users and live session validation.
- No primary Owner/Operator merchant evidence, finance budget consent, separate hosted scanner/CDR or DO accepted.
- The ongoing unrelated RPC10 workflow failures are outside RPC17.6.

## Production safety and rollback
- No migrations on Supabase, no DDL to existing databases, no production Access Allow, no new Cloudflare Worker routes, no R2 evidence upload, no Meta/Zalo send.
- Source-only rollback: close Draft PR or revert branch. CI disposable database is destroyed automatically with the job.
- Next gate is independent design/recovery approval for real staging Store isolation, creation of *separate* disposable QA tenant/store, verified owner staff authority and private two real Auth sessions; run read-only no-send negative RLS under genuine JWT identities only.
- No authorization to merge source into live or start Merchant Intake.

CHECKPOINT: RPC176_DISPOSABLE_POSTGRES17_RLS_SOURCE · REAL_SUPABASE_AUTH_AB_NO_GO · HOSTED_NO_GO
