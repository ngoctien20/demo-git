# TIEN404 AI — RPC17.8 Checkpoint

**Date:** 2026-11-17 JST
**Classification:** IMPLEMENTED SOURCE-ONLY / CI PENDING / REAL JWT A/B NO-GO / HOSTED NO-GO.

## Parent
- RPC17.7 Draft PR #347 HEAD `9ed17301966995976af4fab4ac7f0791da429920`, branch based exactly on this commit.
- No overlaps with a pre-existing RPC17.8 PR at start.

## Verified live inventory (READ ONLY)
- Supabase project `ifxlvrhyjhbzbrkdsida` ACTIVE_HEALTHY PostgreSQL 17.
- Supabase branches: `[]`; `rpc178_qa` missing; no canonical `public.stores` or `public.store_memberships`; `public.products/orders` zero store_id columns.
- Existing user/session row counts are not proof of two live JWTs or owner authority.
- This PR performed zero writes to Supabase, Cloudflare, R2, n8n, customers, messages, credentials or billing.

## Implemented
- `qa/v152-rpc178/private-readonly-uat.mjs`: fixed-origin read-only A/B Auth-user + PostgREST disposable QA scope diagnostic. Private environment / positive assertion never authorizes release, migration or send. Reject redirects, wrong project, missing valid publishable key, mismatched identity, same JWT, Store mis-scope, cross-store disclosure, bad payload and network failures; never return token, order or customer data.
- `qa/v152-rpc178/private-runner-cli.mjs`: opt-in private-only CLI. Never execute in GitHub CI with real tokens and never log Auth raw response or JWT. This script does not verify live session revocation or owner proof; requires separate private broker.
- `qa/v152-rpc178/private-readonly-uat.test.mjs`: injected synthetic fetch cases for positive own-store/negative cross-store checks and fail-closed behavior. No network/credential.
- `docs/ai-handoff/T404_RPC178_PRIVATE_JWT_AB_HOSTED_ADMISSION_RUNBOOK.md`: exact approval and restoration gates for later independently approved Supabase QA schema provisioning.
- GitHub CI source-only, inherits RPC13–RPC17.7 Node regressions; no hosted writes or real Auth calls.

## Blockers
- Real owner/operator consent and independently verified real Store A/B Auth/session and canonical Store membership missing.
- `rpc178_qa` schema and private PostgREST route not present, and public Commerce policies remain Tenant-only. No RLS hosted UAT accepted.
- No explicit approval for staging Supabase migration, new branch fees, security permission changes, Access Allow, customer uploads or production.
- Separate RPC10 workflow CI failure still unresolved.
- Rollback by closing Draft PR only; no hosted resource rollback.

**CHECKPOINT: RPC178_SOURCE_ONLY · REAL_JWT_AB_NO_GO · HOSTED_MIGRATION_NO_GO · RPC16_PRESERVED**
