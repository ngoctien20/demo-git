# TIEN404 V17.2C.18 — Private Consent Registry × Atomic Receipt Consumption × Real Auth A/B Admission

Date: 2026-11-18 JST.
Parent: Draft PR #392; prior V17.2C.17 head `c5d0bef612e1a16e5d77de64aeac0da04cccac6e`.
**Status: EPHEMERAL POSTGRES INTEGRATION TESTED; REAL SUPABASE AUTH/JWT NO-GO.**

## VERIFIED
- Previous source CI and PostgreSQL RLS run at V17.2C.17 both SUCCESS (44172552489, 44172552567).
- At start of V17.2C.18 Supabase `tien404-staging` returned zero development branches. This staging contains existing Commerce data. No migration was made.
- GitHub Actions at code commit `4888eb862fa8a2bf5f0da7a110222121dae1b2c1`:
  - source-only suite run **44174178732** completed SUCCESS;
  - ephemeral PostgreSQL 17 run **44174178453**, job `disposable-postgresql-qa`, completed SUCCESS;
  - both the legacy Store RLS/rollback drill and NEW `Private consent registry atomic replay and concurrent consume QA (ephemeral only)` step completed SUCCESS.

## IMPLEMENTED, SOURCE ONLY

1. `qa/v172c-rpc-closure/v172c18-private-consent-registry-candidate_NOT_EXECUTED.sql`: private `tien404_v172c18_private.consent_receipts`, immutable receipt-id PK, project/tenant/store/actor binding, issued/consumed/revoked state, expiry<=24h, RLS enabled and forced, all anon/authenticated privileges revoked; no Data API policy.
2. `qa/v172c-rpc-closure/v172c18-ephemeral-receipt-fixtures.sql`: synthetic QA receipts only.
3. `qa/v172c-rpc-closure/v172c18-atomic-consent-ci-drill.sh`: checks grants, uses a **single conditional SQL UPDATE ... WHERE state='issued' AND expiry... RETURNING receipt_id** as the private-server consume protocol; two competing PostgreSQL connections prove exactly one succeeds. Also checks replay, revoked/expired receipts, mismatched Store.
4. `.github/workflows/v172c15-ephemeral-postgres-qa.yml` extended with registry integration step against container-only PostgreSQL 17 at localhost; no customer credentials or Supabase endpoint.

## Security constraints and limitations

- **Passing an atomic SQL test is NOT proof of operational human consent or JWT validity.** The caller of the private consume operation must separately verify signed receipt, protected current Auth A/B session, independent owner consent and trusted Store authority. These are not implemented as a hosted service.
- The SQL execution in CI is done as local privileged test role; real service must use a narrowly granted trusted principal through a protected backend transaction, not `anon`, `authenticated` or a public SECURITY DEFINER endpoint. In particular do not leak Supabase service-role credentials.
- The test demonstrates per-receipt atomic consume, **not atomic pairing** of A and B in one all-or-nothing transaction; pair consumption must be reviewed and implemented before launch if all-or-nothing UAT admission is required.
- Security review must include replay registry retention, revocation before consume, consent withdrawal, secret rotation, audit logs without PII, project/cost boundary, reviewer independence and multiple server instances.
- No receipt text, JWT, refresh token, password, service secret or real user identifiers stored here.

## GO / NO-GO

| Gate | Result |
|---|---|
| PostgreSQL private schema + explicit grants | TESTED PASS (ephemeral) |
| Atomic one-winner concurrent receipt consume | TESTED PASS (ephemeral) |
| Revoked / expired / replay / wrong Store negative QA | TESTED PASS (ephemeral) |
| Real private consent service + independent A/B owner signatures | BLOCKED |
| Verified server-side Supabase Auth sessions | BLOCKED |
| Approved disposable Supabase QA project/branch, cost, backup restore | BLOCKED |
| Hosted real signed JWT A/B cross-Store PostgREST UAT | NOT RUN — NO-GO |
| Production n8n/Commerce/Zalo release | NO-GO |

No runtime schema/credential/Auth/production/customer write was made. Rollback of this step: close Draft PR #392 or revert source commits. GitHub CI disposable databases self-destruct with job; no Supabase rollback needed.

## Next gated work
1. Design and review a **pairwise atomic A/B intake** so both consent receipts commit or neither does, including locking order and repeat-run denial.
2. A private actual operator must receive independent Auth A/B consents and verify server-side session; no receipt or JWT pasted into ChatGPT.
3. Confirm scope, price and restore strategy before creating a Supabase disposable branch or applying schema.
4. After approvals, stage and test in isolated Supabase, then run real JWT/PostgREST scoped negative UAT with sanitized evidence.
