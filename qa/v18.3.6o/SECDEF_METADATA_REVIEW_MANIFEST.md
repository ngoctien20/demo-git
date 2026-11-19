# TIEN404 V18.3.6O — Staging SECDEF Metadata-to-Review Manifest

**Status:** `METADATA VERIFIED / FUNCTION BODY NOT ACCESSED / OWNER REVIEW APPROVAL NOT GRANTED`  
**Observed:** 2026-11-19 JST  
**Project:** Supabase staging `ifxlvrhyjhbzbrkdsida` (PostgreSQL 17.11)

## Exactly four public SECURITY DEFINER functions

| Function | PostgreSQL owner | Effective EXECUTE | SHA-256 of function identity |
|---|---|---|---|
| `qa_owner_pairing(p_shop uuid, p_action text, p_challenge uuid)` | postgres | authenticated | `b87688afabac23d1828a17051ae8596b5df15404bb4a8a6892ee7ff497bb32d1` |
| `qa_shop_b_zalo_claim(p_challenge uuid, p_code text, p_sender text, p_event text)` | postgres | anon | `c97e1a56edd33a5a3fcc250c4aa0c7b3d02c7820bce7d7a63f0ac1b23d92f6c4` |
| `save_merchant_product(p_tenant uuid, p_sku text, p_name text, p_price bigint, p_active boolean, p_initial_stock integer, p_expected_updated_at timestamptz)` | postgres | authenticated | `39f0171952722cb6df1cef490efb7da6eb3ee15a310638a355d6ebe2a81283a5` |
| `tien404_tester_track_change()` | postgres | service_role | `2a0407fbba3194dff4e01673a3b38b4358700f328737da63d9dfe5eb269cfe31` |

The stored identity hash is:
`SHA256(UTF8(schema + '.' + name + '(' + pg_get_function_identity_arguments(oid) + ')'))`.

**IMPORTANT:** This is a hash of the *function identity*, **NOT** a hash of `pg_get_functiondef` or source code. It proves metadata integrity only and **cannot** prevent a function body from changing while keeping its signature. A fresh body fingerprint and manual review may only be collected in a separately authorized, private environment. Do not name this manifest an approved code snapshot.

All four have explicit `search_path` configuration (presence only; no values read). All four have the highly privileged owner role `postgres`. Effective `EXECUTE` is an SQL permission check, **NOT** proof of actual Data API exposure or exploitability. Ownership may bypass RLS; confidential invocation guards and Store scoping are *unreviewed*.

## Scope and request to review — not authorization

1. Obtain **explicit owner approval** for a precise list of 1–4 function signatures/digests and a defined <=1h review window in staging.
2. Appoint an independent, separately authorized human reviewer. Confirm no impersonation and separation from implementer.
3. Capture confidential pre-review grants and execution-route mapping; never paste function bodies, embedded strings, JWTs, customer PII or secrets in a GitHub PR.
4. In the approved private workspace, evaluate `SECURITY DEFINER` owner bypass, `auth.uid()`/JWT trust, argument validation, Tenant/Store authority, dynamic SQL, pinned `search_path` **value**, EXECUTE grants, PostgREST exposed schemas and code dependencies.
5. Record only **redacted findings and immutable review evidence references**. A vulnerability finding must have a bounded fixture negative test, impact, owner approval, snapshot, rollback proposal and independent signoff before any actual grant change.
6. Each security repair is **a separate authorization**, not an automatic consequence of the inspection.

## Session metadata supporting the future GoTrue work

- `auth.sessions` is a real relation with RLS enabled. Session values were **not** read.
- PostgreSQL effective direct `SELECT` on `auth.sessions` for `anon`, `authenticated`, and `service_role` is **false** for each in this project.
- Therefore a future transaction-bound session verifier cannot assume ordinary client or `service_role` direct read access; it requires a separately reviewed private trust boundary **without broadly granting access**.
- Two canonical `public.stores`/`public.store_memberships` tables and six Commerce `store_id` fields remain absent. Do not backfill or migrate based solely on this manifest.

**Machine-readable:** `SECDEF_METADATA_MANIFEST.json`, validated by `secdef-manifest-review.mjs`.  
**Reproducible audit:** `READ_ONLY_SECDEF_METADATA.sql` (SELECT-only; no function bodies or session rows).

**Risk gate:** `M-SECDEF-01 REVIEW_REQUIRED`, not a confirmed exploitable vulnerability; `BODY_REVIEW=BLOCKED`; `GRANT_CHANGE=NO-GO`.

Sources:
- https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/api/securing-your-api
