# TIEN404 AI — RPC17.8A Exact Checkpoint

**2026-11-17 JST — SOURCE IMPLEMENTED / DISPOSABLE PG17 CI VERIFIED / NO SUPABASE MIGRATION / REAL JWT A/B NO-GO.**

## Parent and current state
- Parent RPC17.8 Draft PR #353 baseline exact SHA `1d4cf92edc9482000481d5954033cdd373446ad9`.
- Verified GitHub RPC17.8 CI 470/470 source PASS.
- Live Supabase `ifxlvrhyjhbzbrkdsida` ACTIVE_HEALTHY, PostgreSQL 17, zero branches; `rpc178_qa` absent; public Store/Membership tables absent, public Commerce no Store IDs.
- No hosted additions or Supabase writes. Existing Cloudflare RPC16 public Worker and Access DENY ALL preserved, no Messenger/Zalo sends.

## Source changes
1. `qa/v152-rpc178a/sql/private-schema-candidate.sql`: review-only private schema `rpc178_qa`, four tables with RLS/FORCE RLS, no policies/grants; strict collision refusal. DO NOT apply to Supabase without independent authorization.
2. `qa/v152-rpc178a/sql/disposable-private-schema-assertions.sql`: isolated PostgreSQL 17 structural, ACL, RLS and tenant/store composite FK acceptance; synthetic rows in disposable CI only.
3. `qa/v152-rpc178a/migration-admission.mjs` and negative tests: scope, owner/security/finance/backup/restore/cost boundaries default NO-GO, raw JWT rejection, no permission grants even when simulated flags all true.
4. `.github/workflows/v152-rpc178a-private-schema-nohost.yml`: ephemeral PG17 and Node inherited RPC17.8–RPC13 source regression; **no hosted/cloud deploy or Supabase connector writes**.
5. Independent approval runbook for real Store A/B setup, private UAT and restore.

## CI and live scope readback verified
- GitHub Actions RPC17.8A run #44092940482 on commit `de3ab203c224b77a3a1679ae86699f42fdd9fdf8`: SUCCESS; **502/502 Node tests PASS, 0 FAIL** (32 new RPC17.8A + 470 inherited) and isolated PostgreSQL 17 candidate DDL/12 logged acceptance confirmations for forced RLS, no policies/grants, authenticated SELECT denial and schema collision refusal.
- This is a disposable PG17 service, NOT real Supabase schema permissions. Real service_role bypass behavior, schema exposure, snapshots and Auth JWTs not yet accepted.
- After CI, read-only Supabase SELECT confirms `rpc178_qa` absent, no public Store/Store Membership tables and zero store_id columns in public Products/Orders.
- Independent RPC10 GitHub workflow still reports failure outside this scope.

## Explicit blockers
- No independently accepted owner/store authority, dedicated operator + reviewer with fresh MFA, prechange restore drill, signed exact DDL scope or real Auth A/B sessions.
- The candidate schema is **private and unexposed**; real PostgREST JWT A/B cannot pass yet, intentionally.
- No approved Finance/cost scope, cloud hosted DO/scanner/CDR acceptance or Merchant Intake approval.
- Existing separate RPC10 workflow failure may appear and is not considered fixed.

## Verification and rollback
- CI outcome must be retrieved from run logs at exact HEAD SHA and counted before reporting as PASS.
- Source rollback by closing this Draft PR; no hosted resources to delete and no data to restore.
- Do not promote to CANDIDATE/APPROVED/RELEASED automatically.

CHECKPOINT: RPC178A_PR355 · CI_NODE_502_502_PG17_PRIVATE_SCHEMA_PASS · SUPABASE_STAGING_UNCHANGED · REAL_JWT_AB_NO_GO · SUPABASE_DDL_NO_GO · HOSTED_NO_GO
