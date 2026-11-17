# TIEN404 RPC17.5 — Canonical Store Authority: schema/RLS design review (NOT A MIGRATION)

**Status:** PROPOSED DESIGN / DO NOT RUN AGAINST LIVE OR STAGING WITHOUT SEPARATE APPROVAL.

## Existing staging findings (read-only)
- Project `ifxlvrhyjhbzbrkdsida`, ACTIVE_HEALTHY.
- `public.tenants` and `public.tenant_memberships` have RLS and FORCE RLS.
- `public.products` and `public.orders` have RLS + FORCE RLS; read policies use tenant-membership checks, **not Store membership**.
- Products, Orders, Customers, Conversations, Messages, Order Items have tenant_id but no store_id; user data was not accessed.
- `tien404_r1_qa.tenant_identity_map` has tenant_key, store_key, bot_key, auth_tenant_id (2 row estimate), RLS; mapping does NOT authenticate user/session or establish owner right. DO NOT silently promote this QA map into canonical authority.
- `tien404_v175_qa.order_ownership` is a separate order/customer-level QA guard, not canonical Store Owner proof.
- Total 3 auth.users, 2 users with session records, one tenant with >=2 active tenant members; these counts are NOT proof of real Store A/B authorization.
- No independent private Merchant/Operator P1/P2/O1/O2 primary proof or real two-session Store UAT accepted.

## Proposed minimal canonical model (not implemented)
1. `private_or_authorized.stores`: (id UUID PK, tenant_id UUID FK tenants, status, authority_version integer, created_at). Unique (tenant_id, id); status only active, suspended, deleted; soft-delete with controlled audit.
2. `private_or_authorized.store_memberships`: (store_id UUID, tenant_id UUID, user_id UUID FK auth.users, role, active, authority_version, created_at), composite FK (tenant_id,store_id) to stores; composite PK (tenant_id, store_id, user_id). Server-controlled role and membership writes; never trust `user_metadata`, browser-supplied tenant/store or unsigned header.
3. Keep `tenant_memberships` as coarser tenant eligibility gate; require **both tenant and Store membership** for Store-scope reads/writes.
4. Add store_id to commerce tables via additive migration, validated FK (tenant_id,store_id), index (tenant_id,store_id[,sku/order_id]), strict backfill from verified owner authority only. No guessed assignment of legacy tenant rows. **No cutover while any legacy row unresolved**.
5. RLS `TO authenticated`: authenticated `auth.uid()`, joined active tenant membership and matching active Store membership, version matches stores version; `USING` and `WITH CHECK` for writes (when separately approved). Owner/Manager privileges constrained by authorized Store; read-only staff is scoped. Service-role bypass is never a security proof.
6. Privileged operations require a separately scoped trusted writer with explicit session/Store owner verification and independent QA; no exposed SECURITY DEFINER or unwarranted GRANT.
7. The public website and existing n8n DEMO must not be migrated implicitly. Snapshot, migration plan, read-only preflight, and rollback first.

## Real Auth UAT acceptance requirements
- Private two distinct Supabase Auth sessions with server-side verified issuer, signature, expiration and active session; do not copy JWTs into GitHub/ChatGPT.
- Same canonical Tenant with Store A and Store B, verified distinct IDs and explicit Store memberships for appropriate subjects.
- B cannot read A's Products/Orders/Customers even if B is a Tenant manager (and vice versa); cross-Tenant C cannot read A or B; revoked member loses access; inactive Store denies.
- Verified tests must use **real PostgREST RLS path** under `authenticated` using genuine separate tokens; DB superuser or service_role queries do not prove RLS. Read-only no-send UAT first.
- Negative tests must include mismatched or forged store_id, user_metadata role injection, stale/expired token, stale ownership_version, revoked session, wrong issuer, disabled store.
- Audit artifacts must contain only safe PASS/FAIL metadata, request IDs and masked actor refs, no PII or tokens.
- Independent security reviewer and owner/finance/operator acceptance before any hosted scanner/DO/Access deployment.

## Change control and rollback
- Current work is source and documentation only. No schema/table, seed, membership, RLS, grants, token, R2, Cloudflare or hosted changes.
- A later migration requires independent written owner approval, versioned SQL, pre-change backup & restore rehearsal, immutable git SHA and separate rollback plan; verify no accidental broader access before adding RLS policy.
- If a Store mapping lacks original proof, BLOCK migration and UAT; retain tenant-only legacy behavior isolated in its existing staging/DEMO context.
- Existing unrelated RPC10 failing CI remains a separate issue.

**DECISION: PRIVATE REAL STORE A/B NO-GO.**
