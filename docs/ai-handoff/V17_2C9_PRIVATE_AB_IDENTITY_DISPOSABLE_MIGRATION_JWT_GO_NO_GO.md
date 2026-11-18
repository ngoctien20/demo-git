# V17.2C.9 — Private A/B Identity Verification × Disposable Store Migration Authorization × Real JWT UAT GO/NO-GO

Date: 2026-11-18 JST
Parent: Draft GitHub PR #392, baseline prior HEAD `709672b6a7f7ce1ca45912f8f17967002ad301af`.
Database: Supabase staging `ifxlvrhyjhbzbrkdsida`, PostgreSQL 17.11, ACTIVE_HEALTHY.
Current outcome: **NO_GO_STRUCTURAL_OR_IDENTITY_PRECONDITIONS**.

## VERIFIED — independent read-only facts

- Prior source-only GitHub Actions run 44148410173 completed SUCCESS. This is source-only and does not attest hosted JWT/RLS.
- Supabase project has **zero development branches** returned by `list_branches`; do not assume a disposable branch or recoverable migration exists.
- The exact SQL stored at `qa/v172c-rpc-closure/v172c9-private-auth-ab-readonly-preflight.sql` was fetched from GitHub commit `a437940d2149c75e29a083144d8f2337288084be` and independently executed against staging using SELECT only. It returned:
  - auth_users=3;
  - session_rows_historical_not_current_jwt_proof=7;
  - tenants_with_two_active_owners=1;
  - tenants_with_two_owner_session_records=0;
  - tenants_with_two_qa_store_keys=0;
  - tenants_with_owner_store_overlap=0;
  - canonical_store_tables=0;
  - commerce_store_columns=0;
  - product_rows_protected=2, order_rows_protected=2;
  - automatic_preflight_result=`NO_GO_STRUCTURAL_OR_IDENTITY_PRECONDITIONS`.
- Interpretation: There is one Tenant with two active Auth-backed owner membership rows, but **no Tenant with two such owner accounts both represented in historical `auth.sessions` rows**. The session count is not a real-time JWT validation and may be stale. Zero actual signed consent receipts and no independently proven Store A/B ownership.
- The screenshot from previous user turn visibly confirmed n8n credential's **Header Name** `x-tien404-pairing` and allowed Supabase staging domain; value remained masked. Supabase Vault equality and RPC execution success still unproven.
- Existing Zalo V2 Published workflow `OgDZNSAvKEvhnAvn` remains a known RPC dependency and **must not** lose `anon EXECUTE` while dependent.

## IMPLEMENTED — testable admission contract only

- Added `qa/v172c-rpc-closure/v172c9-private-consent-admission.test.cjs` to existing Node source-only CI collection. The suite checks synthetic distinct-actor, distinct-Store, per-actor consent, private authentication, reviewer, bounded QA/no-send, recovery, RLS fixtures and secret JWT evidence flags. 17 tests in source; even a completely authorized synthetic fixture results in `REVIEW_ONLY_NOT_AUTOMATIC_GO`, never a real GO.
- This does NOT create consent receipts, generate JWTs, verify sessions live, execute hosted RPCs, or deploy Store tables.

## PROPOSED — independently approved private consent path

1. **Identity**: Actor A and Actor B separately authenticate in protected QA session. A trusted verifier computes a non-reversible receipt reference from server-side Auth user ID and signed/valid session; do not export email, phone, JWT, refresh token, session ID, provider identifiers, Vault secrets or credentials.
2. **Separate consent**: Each actor approves their *own* QA role and narrowly scoped synthetic Store, no-send read-only tests, revocation and expiry; server checks independent signatures and stores actual receipts only in private registry. Owner role in public.tenant_memberships is not consent.
3. **Canonical authority**: Two distinct Store UUIDs and dedicated membership rows within the SAME disposable QA Tenant, not inferred from text Store keys. Require server-issued Store/channel authority and tenant/store composite FK.
4. **Recovery**: Pre-migration schema backup/restore rehearsal, no-cost/approved-cost bound and QA-data destruction plan, independent review and explicit schema-migration authorization; no Supabase branch or rollback proof was observed.
5. **Real JWT**: Only after above passes, use two genuine short-lived private Auth JWTs to request scoped read-only synthetic Store catalog with A→A/B→B allow and A→B/B→A, unknown actor, invalid, expired and revoked deny. Non-mutating evidence with pseudonyms only. No provider send or order write.
6. **RPC compatibility**: Keep `qa_shop_b_zalo_claim`, `qa_owner_pairing`, `save_merchant_product` existing grants until all active caller contracts and Owner A/B negative UAT pass.

## GO/NO-GO decision matrix

| Gate | Evidence | Decision |
|---|---|---|
| Header Name provenance | Operator screenshot | VERIFIED, pass name only |
| Supabase healthy | Live project inspection | VERIFIED |
| Source QA | Previous Actions SUCCESS; new suite pending CI | SOURCE ONLY |
| Two independently authenticated A/B actors | No private pair proof; no dual-owner session record pair | NO-GO |
| Actor A/B independent private consent | Not provided/verified | NO-GO |
| Two same-Tenant canonical Stores | No tables or Store mapping pair | NO-GO |
| Isolated disposable migration & rollback | No branch/restore proof; no approved DDL | NO-GO |
| Real JWT A/B hosted RLS negative UAT | Not performed | NOT AUTHORIZED |
| Production / RPC privilege closure | Live caller and incomplete Store authority | NO-GO |

## Status / changes / rollback

VERIFIED: database and branch metadata, prior CI.
IMPLEMENTED: read-only SQL and local source-only admission test plus this checkpoint document.
TESTED: exact read-only SQL executed, NO-GO result; new test may only be called PASS after CI.
BLOCKED: independent actor consent, private JWT, scoped Store schema admission, hosted tests.
NO CHANGES to Supabase data/schema, Auth, n8n, Cloudflare, credentials, production, Zalo sends or payment.
Rollback: close Draft PR #392 or revert these source-only commits. No DB rollback needed.

Next milestone: **V17.2C.10 — Private Consent Intake Readiness × Reversible Disposable Schema Staging × Independent Real JWT A/B Admission**. Do not treat project user 'continue' as both actors' signatures or approval of schema DDL.
