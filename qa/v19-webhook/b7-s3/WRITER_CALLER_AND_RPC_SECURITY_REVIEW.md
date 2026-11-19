# TIEN404 V19.0-B7-S3 — Writer Caller Inventory × Privileged RPC Security Review

**Date:** 2026-11-19 JST  
**Scope:** live read-only GitHub/n8n/Supabase audit, synthetic PostgreSQL17 security tests; no DB/data mutation outside disposable CI.
**Decision:** PARTIAL INVENTORY VERIFIED, REAL OWNER A/B STORE AUTH BLOCKED, V2 CANDIDATE NOT APPROVED.
**Parents:** PR #446 (B7-S2), PR #440 (B7-S1), canonical Store Authority PR #417.

## A. Verified call-site inventory; no invented "complete"

| Surface | Evidence | Result | Completeness |
|---|---|---|---|
| Supabase public RPC | PostgreSQL system catalog + pg_get_functiondef | V1 exists and is callable by authenticated; not Store-scoped | Real function verified; actual callers unknown |
| Website gh-pages SHA ff2daf970e8209399a28b2d0cade8a33b9fa71c6 | 37/37 HTML/JS/CJS/MJS/TS-like blobs from exact Git tree inspected for literal save_merchant_product and /rpc/ | Zero direct call-site matches in that snapshot | Only this deployed repo branch/snapshot |
| n8n | 17 named workflow definitions inspected (published where available), including Commerce AI Core, Messenger, Create Order DEMO, Catalog, Cart, Onboarding, Zalo routing and auth adapter QA | No literal V1 RPC endpoint/call in inspected node parameters | Not a scan of every n8n workflow, indirect child services, dynamic destinations or deployed external applications |
| Supabase Edge Functions | list_edge_functions returned one ACTIVE function; source inspected | tien404-r1-owner-preflight v2 verifies JWT at gateway and uses auth.getUser, queries tenants + tenant_memberships; does not call V1 or validate store_memberships | All currently listed Edge Functions; not proof of external consumers |
| GitHub default code search | Search for save_merchant_product and supabase.rpc | No indexed results | Search index is not an authoritative all-branch caller census |
| Render services | Connector requires user-confirmed workspace before any service action | BLOCKED_UNSELECTED_WORKSPACE | No Render services audited; don't choose workspace on user's behalf |
| Private server-to-server clients | No complete trace, request metadata or signed caller map available | UNKNOWN | Need individual service owners and read-only logs |
| Supabase RPC usage telemetry | No complete per-caller RPC trace/record available | UNKNOWN | Requires approved observability plan; avoid PII/secrets |

The JSON counterpart is caller-inventory.json. **Do not infer that zero literal matches means the RPC has no callers or can be removed.**

## B. Live V1 RPC privilege and behavior

Verified from pg_proc and pg_get_functiondef:
- public.save_merchant_product(p_tenant uuid, p_sku text, p_name text, p_price bigint, p_active boolean, p_initial_stock integer, p_expected_updated_at timestamptz).
- SECURITY DEFINER; function owner is postgres; search_path explicitly pinned empty.
- auth.uid() and active tenant membership owner/manager are checked; two QA Tenant allowlist references are in the function.
- authenticated has EXECUTE, anon does not.
- Product data changes are Tenant + SKU, no Store membership/Store ID.
- Tenant-wide UNIQUE(tenant_id, sku) currently exists; D-02 change pending.
- Owner being postgres may bypass ordinary row RLS depending on privileges; manual checks inside privileged function must be threat-reviewed. Do not call this a proven data leak without exploit evidence.
- Preserve V1 until clients and its security behavior are fully reviewed; never silently revoke or replace.

## C. V2 security review, based on exact B7-S2 disposable source

**Positive design choices (synthetic tests only):** explicit p_store, Tenant AND Store membership, active Store, owner/manager permission, strict bigint VND bounds, stock nonnegative, stock changes excluded from edits, optimistic CAS on updated_at, audit in same transaction, narrow EXECUTE in fixture schema, pinned search_path.

**P0 / hard NO-GO:** The B7-S2 mock function calls synthetic_auth_uid() that reads a custom request.jwt.claim.sub GUC. This parameter can be set by an arbitrary PostgreSQL client; it is **not** a JWT verifier, not verified auth.uid() and not a Store-bound real session. B7-S3 PG17 adversarial test deliberately spoofed that value, reaching the stale-update error branch without any JWT. No data changed in the proof. NEVER run this source as a production RPC.

**P1:** SECURITY DEFINER function owner/permissions, grant surface, signed auth identity, service_role bypass and Data API exposure must be reviewed under PR #417. Supabase recommends SECURITY INVOKER when possible; if a privileged function is genuinely required, restrict schema, owner/grants and independently verify Auth+Store membership before every change.

**P1:** CAS using exact timestamps has API formatting/precision contracts to verify; retries may yield conflict. Handle error PT409 deterministically, never silently overwrite changes or inventory. Add concurrent call and rollback fault tests on approved staging after auth/schema gates.

**P1:** New product insert and edit paths must keep SKU/Store tuple uniqueness and current Tenant-wide constraint until D-02 explicitly settled. No automated mapping of legacy NULL Store.

**P1:** Explicit Store-scoped idempotency and authorized audit trail needed before any real commerce product or order write. No claim of real customer data UAT.

## D. Owner A/B evidence status

No real Owner A/B JWTs, validated session test receipts, Store memberships or Stage RLS cross-Store positive/negative tests were available. Store ID is absent on the six public Commerce tables. The existing tenant-only Owner preflight Edge Function can provide a starting point for Auth verification, not Store authority closure. A manually supplied \`VERIFIED\` string, synthetic GUC, or draft PR is NOT sufficient proof.

See REAL_OWNER_AB_ADMISSION_PROCEDURE.md for the scoped 10-case admission matrix. No raw tokens/PII may be submitted.

## E. Approval and rollback

Before live changes:
1. Resolve Render workspace with explicit user choice; identify all server/app callers and record their exact version.
2. Determine D-02 SKU semantics and owner-approved legacy Store mapping.
3. Review canonical PR #417 and staged schema migration on disposable PG17 before touching real Supabase.
4. Build separately audited V2 with real auth.uid(), restricted privileged grants, Store-aware RLS and strict auth/session expiry.
5. Obtain authorized real Owner A/B token-safe UAT and independent security signoff.
6. Perform no-write shadow compatibility, approve rollback and then issue separate narrowly scoped staging change approval.
7. Do not enable hosted Worker canary, callback registration, provider send, payment or production writer as a side effect.

Rollback today is to close/revert only the GitHub Draft PR; there is no hosted artifact to roll back.

**Final:** B7_S3_CALLER_INVENTORY_PARTIAL / PG17_GUC_SPOOF_TESTED / REAL_AUTH_NO_GO / LIVE_RPC_UNCHANGED / PRODUCTION_NO_GO.
