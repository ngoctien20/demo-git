# TIEN404 AI — RPC17.8B Exact Source Checkpoint

2026-11-17 JST · SOURCE ONLY · STAGING DDL NOT AUTHORIZED · REAL JWT A/B NO-GO

## Inherited
- RPC17.8A Draft PR #355 HEAD `abc8745360ff0a774d89194872e7e632d5342ca3`; CI 502/502 Node tests + disposable PostgreSQL 17 private schema rehearsal PASS.
- Supabase `ifxlvrhyjhbzbrkdsida` ACTIVE_HEALTHY, PostgreSQL 17, no dev branches, no `rpc178_qa` private schema or canonical public Store member tables/Store ID columns.
- Existing `tien404_r1_qa` Owner pairing and private QA migration records must be audited before promotion. Function `public.qa_shop_b_zalo_claim` is SECURITY DEFINER and executable by anon; `public.qa_owner_pairing` is SECURITY DEFINER and executable by authenticated. Permission review alone is not an exploit finding.

## New RPC17.8B source additions
- `qa/v152-rpc178b/immutable-preflight.mjs`: SHA256-bound, scoped owner+reviewer+backup/rollback/cost/access gates, always NO-GO for staged write even when synthetic evidence true.
- `qa/v152-rpc178b/immutable-preflight.test.mjs`: negative source checks for wrong schema, DDL hash, reviewer binding, stale staging baseline, grants, unauthorized sends and hypothetical spend.
- `.github/workflows/v152-rpc178b-restore-nohost.yml`: disposable PostgreSQL 17 CI creates candidate private QA schema, synthetic fixture, pg_dump, DROP and restores only CI schema, verifies RLS+FORCE RLS, row restoration and authenticated access denied; inherited RPC13–17.8A source security regressions.
- `docs/ai-handoff/T404_RPC178B_STAGING_APPROVAL_AND_RECOVERY_RUNBOOK.md`: exact real staging approval and owner identity questions.
- No Supabase DDL, user creation, RLS/Access changes, data writes, R2 uploads, or Messenger/Zalo sends.

## Blockers
- Independently verified real owner Store A/B proof, operator MFA, reviewer receipt, exact live Supabase backup and verified restore, approved DDL and cost scope missing.
- Candidate schema deliberately private/unexposed: no real PostgREST/JWT A/B authenticated route exists.
- No real JWTs admitted to project/GitHub or source test; no Merchant docs received.
- RPC10 six-surface workflow still separately failing.
- Run GitHub CI on the exact final branch SHA before declaring PASS.
- Rollback source only: close Draft PR. No hosted rollback.

CHECKPOINT: RPC178B_SOURCE_ONLY · RESTORE_DRILL_DISPOSABLE_PENDING · SIGNED_OWNER_UNVERIFIED · STAGING_DDL_NO_GO · REAL_AUTH_AB_NO_GO
