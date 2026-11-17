# TIEN404 AI — RPC17.8A Exact Checkpoint

**2026-11-17 JST — Source implementation, no Supabase migration, no real JWT UAT.**

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

## Explicit blockers
- No independently accepted owner/store authority, dedicated operator + reviewer with fresh MFA, prechange restore drill, signed exact DDL scope or real Auth A/B sessions.
- The candidate schema is **private and unexposed**; real PostgREST JWT A/B cannot pass yet, intentionally.
- No approved Finance/cost scope, cloud hosted DO/scanner/CDR acceptance or Merchant Intake approval.
- Existing separate RPC10 workflow failure may appear and is not considered fixed.

## Verification and rollback
- CI outcome must be retrieved from run logs at exact HEAD SHA and counted before reporting as PASS.
- Source rollback by closing this Draft PR; no hosted resources to delete and no data to restore.
- Do not promote to CANDIDATE/APPROVED/RELEASED automatically.

CHECKPOINT: RPC178A_SOURCE_ONLY · PRIVATE_SCHEMA_DDL_CANDIDATE · NO_ROLE_GRANTS · REAL_JWT_AB_NO_GO · SUPABASE_DDL_NO_GO · HOSTED_NO_GO
