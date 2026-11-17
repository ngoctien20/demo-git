# TIEN404 AI — RPC17.7 Independent Store Ownership Proof × Authorized Disposable Supabase QA Migration × Real JWT A/B No-Send UAT

2026-11-17 JST · SOURCE-ONLY · MIGRATION NOT AUTHORIZED · REAL JWT NOT VERIFIED · HOSTED NO-GO

## Inherited baseline
- Exact parent PR #345 (RPC17.6) HEAD `4873d9814ed27b4ea792e3ae4821000191acb2e1` at branch creation.
- RPC17.6 CI run #44088401553: 36/36 disposable PostgreSQL RLS assertions + 412/412 Node tests PASS. Tests do not contain real Supabase Auth JWT, Merchant files, customer data or Cloudflare hosting.
- Supabase project `ifxlvrhyjhbzbrkdsida` ACTIVE_HEALTHY. Latest read-only SELECT: 0 public Store/Store Membership tables; 0 Store ID columns in public Products/Orders; no `rpc177_qa` schema. 3 Auth users, 2 users with session records. This is NOT a proof of real Store A/B auth.
- The RPC16 inactive Worker, Access DENY ALL, private R2 and RPC17.1–17.6 components preserved.

## New work
- `qa/v152-rpc177/private-ownership-proof.mjs`: independent pinned test-only Ed25519 assertions for Owner, Security Reviewer and Finance Delegate, signed canonical tenant/Store A/B/merchant/operator binding, 180-second max TTL, distinct keys/IDs/nonces. Output ALWAYS denies migration, upload, send, and access-policy changes, even when synthetic signatures are valid.
- `qa/v152-rpc177/real-auth-ab-uat-gate.mjs`: offline evaluation of **claimed** independent Supabase Auth session verification, canonical ownership and PostgREST A/B negative evidence; all results BLOCKED until separate authenticated private receipt and human admission. Does not validate JWT or connect to Supabase.
- Negative regression tests for forged signatures, cross-store, stale TTL, spoofed authorities, missing real sessions, revoked users and public sends. No operator secrets in repo.
- `T404_RPC177_PRIVATE_STORE_OWNER_UAT_ADMISSION_PLAN.md`: independent approval and eventual additive disposable QA schema/migration plan, no migration applied.
- GitHub Actions RPC17.7 source-only workflow inherits RPC13–RPC17.6 Node tests, does not run DDL on Supabase or deploy Cloudflare.

## Pending high-trust evidence
1. Real Merchant Owner P1/P2 documents and Store authority O1/O2 independently verified in private authenticated intake, not this chat.
2. Verified operator and separate reviewer identities, fresh MFA, expiring scoped consent and durable replay ledger; finance cost consent if any cost.
3. Existing Store ownership mapping reconciled, pre-change backup/restore and exact disposable-only migration diff approved.
4. Two independent real Supabase JWT sessions with server-side issuer, signature and session verification, canonical Store A/B membership and read-only PostgREST RLS test; third-party/cross-Tenant negative tests.
5. Private scanner/CDR actual hosted acceptance and Cloudflare Access no-public routes before real Merchant evidence.

## Approval and rollback
- No changes to Supabase schema, Auth sessions, memberships, credentials, Cloudflare Worker/DO/Access/R2, Messenger, Zalo, n8n or customer data.
- CI source-only rollback: close/revert this Draft PR; no hosted resources to delete.
- The existing unrelated RPC10 workflow failure remains outside this task.
- CI must be verified against exact HEAD commit before declaring PASS.

CHECKPOINT: RPC177_SOURCE_ONLY · OWNER_SECURITY_FINANCE_PROOF_SYNTHETIC_ONLY · SUPABASE_QA_MIGRATION_UNAUTHORIZED · REAL_JWT_AB_NO_GO · HOSTED_NO_GO
