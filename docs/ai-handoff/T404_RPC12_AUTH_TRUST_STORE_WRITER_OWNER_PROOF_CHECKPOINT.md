# TIEN404 RPC12 — Trusted Store Writer (Supabase Auth contract) × Original Store Ownership Proof

**Date:** 2026-11-17 JST. **Scope:** Draft source + disposable PostgreSQL 17, no live database migration, no send.
**Depends on:** RPC9 #233 → RPC10 six-surface branch → RPC11 draft PR #279 (tested PG17 CI SUCCESS).

## 1. What was independently observed (READ ONLY)
- Project `ifxlvrhyjhbzbrkdsida`, Supabase staging PostgreSQL 17.
- 2 Tenants; exactly 2 Products + 2 Orders; 3 active tenant owners with matching `auth.users`; Tenant slot 1 has 2 owners, slot 2 has 1.
- All 6 Commerce public tables are Store-less and have tenant-level `PERMISSIVE` SELECT policies.
- Both orders have `order_source='manual'`; original Store origin **cannot** be inferred from it.
- 0 `app_private.order_idempotency`, 0 `app_private.audit_events`, 0 `factory_private.events`, 0 `factory_private.agent_runs`.
- No public canonical Stores/Store Memberships yet. **No verified individual-row Owner attribution.**

## 2. Architectural candidate, NOT a hosted deployment
- Caller authentication boundary: **Supabase Auth JWT verified by PostgREST**; verified identity is returned by actual hosted `auth.uid()` (derived from JWT claims injected by trusted middleware), not user-editable request body, tenant hints, `raw_user_meta_data`, or synthetic_actor GUC.
- Public *SECURITY INVOKER* API wrapper → private *SECURITY DEFINER* product writer **owned by dedicated `NOLOGIN NOBYPASSRLS` DB role**, not superuser/postgres. No `service_role` in frontend.
- API only accepts `p_store` + product fields; server resolves `tenant_id` from canonical Store and checks active `store_memberships` + `tenant_memberships` with `auth.uid()`. Caller-controlled Store ID is never treated as authorization.
- RLS applies to writer role on Products (SELECT, INSERT WITH CHECK, UPDATE USING + WITH CHECK), membership and Store reads. Writer has only necessary SELECT/INSERT/UPDATE grants and no DELETE privileges. Application `authenticated` role gets EXECUTE only and no direct Product write grant.
- Lock Store/member/Tenant member rows `FOR SHARE` during write. RLS and SQL privileges need formal hosted least-privilege review. Later real concurrent revocation testing required.
- Existing `public.save_merchant_product` **not replaced**, because tenant-only authorization remains incompatible and actual Owner Store proof is missing.

## 3. Critical limitations of disposable testing
- CI creates a stub `auth.uid()` from `request.jwt.claim.sub` inside `t404_rpc8_ci`, deliberately reproducing the PostgREST downstream **contract**, **not** verifying cryptographic JWTs, live sessions, or actual Supabase Auth login. Direct SQL sessions can forge this GUC; they must never be used as a production security boundary.
- Hosted acceptance must use **two independently logged-in Supabase Auth users with actual access tokens** submitted over authenticated PostgREST, never SQL `SET ROLE` or SQL editor with service/postgres privileges.
- Need same Tenant with distinct Store A/B, activated/revoked memberships, and real JWT negative checks for reads and writes, cross-Tenant, stale sessions, disabled Store, direct-table requests, and public definer RPC bypass.
- No real customer rows or secrets are exported in CI.

## 4. Four-row ownership intake (PRIVATE, not in GitHub)
For each original hosted Product P1/P2 and Order O1/O2, preserve an independently audited private, encrypted package:
1. Original record ID and Tenant relationship, traceable in primary source; keyed HMAC row binding, never plain SHA on low-entropy IDs in public repo.
2. Merchant onboarding/store contract and canonical Store authority, supported by original catalog/merchant import/provider source log.
3. Real Merchant owner consent and **independent reviewer** attestation from independent authenticated actors; hashes alone cannot authenticate signers.
4. Cross-check no evidence conflicts; use a secure artifact store with retention policy, encrypted access, independent signers.
5. Final evidence package signed by independent authorized parties, externally authenticated; **never auto-backfill from tenant membership or order_source**.

`qa/v152-rpc12/owner-packet-private-template.json` is an **empty template only**; its checker remains HARD NO-GO even when all syntactic fields are populated. Existing H11R.11 signature structure applies only to metadata and does not prove the underlying real source.

## 5. Dependencies / release gates
- G0 real four-row original provenance attested independently — **BLOCKED**.
- G1 scoped encrypted Auth/Storage/DB backup + independent restore acceptance — **BLOCKED**; historical H11R partial application archive remains owner-accepted *with limitations*.
- G2 authorized M1 + all downstream writer/caller compatibility — **BLOCKED**.
- G3 six-surface composite FK / atomic RLS transaction + expected reader blackout, hosted authorization — **BLOCKED**.
- G4 two real authenticated Supabase Auth JWTs, same-Tenant different-Store A/B PostgREST UAT — **BLOCKED**.
- G5 separate Controller + Security Reviewer + DB Operator sign-off — **BLOCKED**.

## 6. Rollback
This draft creates only source/QA assets; close draft PR / delete branch to revert. There are **zero hosted schema/data/secret/RPC changes** to roll back. No merge and no automatic publish.

**CHECKPOINT:** `RPC12_AUTH_UID_CONTRACT_CANDIDATE; FOUR_ROW_ORIGIN_UNATTESTED; REAL_JWT_UAT_NOT_RUN; HOSTED_NO_GO`.