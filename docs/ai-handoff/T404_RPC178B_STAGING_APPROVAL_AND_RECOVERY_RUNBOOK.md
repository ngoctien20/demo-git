# TIEN404 AI — RPC17.8B Owner Authority × Scoped Staging Schema Migration Runbook

**2026-11-17 JST — PROPOSED. No staging migration approved or executed.**

## Verified baseline (read-only Supabase)
- Parent RPC17.8A Draft PR #355 exact HEAD `abc8745360ff0a774d89194872e7e632d5342ca3`, prior CI 502/502 PASS.
- Supabase project `ifxlvrhyjhbzbrkdsida` ACTIVE_HEALTHY, PostgreSQL 17. Existing dev branches: 0.
- The `rpc178_qa` private schema remains absent; `public.stores` and `public.store_memberships` absent, `public.orders/products` no Store ID.
- Existing `public`, `tien404_r1_qa`, `tien404_v175_qa`, `tien404_dialogue_private` schemas must not be modified.
- Prior migrations include `qa_private_owner_challenge_issuer`, `qa_owner_pairing_dashboard_two_shops`, `v12_3_shop_b_private_session_qa`, `v175e2b_private_auth_customer_binding_intake_no_grants`. **Audit and reuse their legitimate QA intent only after authorization**; do not assume they are proof of canonical store membership.

## Important identity/security discovery
- `public.qa_owner_pairing` is a SECURITY DEFINER function executable by `authenticated`.
- `public.qa_shop_b_zalo_claim` is a SECURITY DEFINER function executable by `anon`.
- Function grants by themselves do not prove a vulnerability or valid owner identity. Their implementations/guards, execution paths, and provider signing need independent review before relying on them in Store admission.
- `tien404_r1_qa` owner proof functions are different QA-only paths with no anon/authenticated execute according to the audited function permissions. They are not a canonical Store Owner authorization service without stronger evidence.

## Exact proposed migration gate
1. Out-of-band owner/operator fresh MFA proof, independent security reviewer, exact Store A/B identity, owner consent, TTL-bounded signed permission receipts to exact DDL SHA and `rpc178_qa` project/schema.
2. Confirm no new paid Supabase branch or unexpected spend; owner approves any cost explicitly after quote if needed.
3. Capture **actual** staging backup/snapshot and demonstrate restore against staging-compatible isolated recovery environment. GitHub disposable pg_dump/restore success DOES NOT prove actual staging backup restorability.
4. Inventory before/after schema, permissions, policy/role grants, migrations and Data API exposure; verify exact candidate SQL from RPC17.8A, copy to a reviewed versioned migration only after approval. The candidate has psql metacommands and is NOT directly a Supabase migration.
5. DDL scope is only `rpc178_qa`; four private tables, RLS+FORCE RLS, no policies/grants. Do not modify public Commerce, auth, users, data, credentials or R2.
6. Confirm hard deny for anon/authenticated/service_role on new schema, no Data API exposure; migration is not yet real Store A/B JWT UAT (schema inaccessible).
7. To run actual JWT A/B tests later, separately design and approve a privately authenticated route with real Store authority and narrowly scoped RLS policies; never auto-GRANT or expose schema just to pass a test. Existing parent RPC17.8 GET-only runner cannot run against private unexposed schema.
8. Strict stop on schema collision, policy drift, owner proof mismatch, compromised provider signature or missing independent rollback evidence.

## Verification and rollback
- CI exercises candidate schema in a disposable PostgreSQL 17 GitHub Actions service, with synthetic data and pg_dump/restore within the job only. No staging data accessed and no real JWTs handled.
- The independent source preflight (`qa/v152-rpc178b/immutable-preflight.mjs`) binds project, schema, DDL SHA, role boundaries and evidence checklist but returns BLOCKED even when all self-reported assertions are true; it is not a signed evidence verifier.
- No auto-drop on Supabase. Any future live rollback must be separately authorized with exact migration ID, inventory and backup/restore evidence.
- Keep RPC16 inactive Worker, Access DENY ALL, no R2 uploads, no Messenger/Zalo sends, no customer data changes.

**DECISION: STAGING DDL NO-GO · REAL JWT A/B NO-GO · HOSTED MERCHANT INTAKE NO-GO.**
