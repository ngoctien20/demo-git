# TIEN404 AI — V13.4R.1 Render Auth/Data Audit & Merchant Reuse

**Date:** 2026-11-15 JST  
**Stage:** EXPERIMENTAL / STAGING. No merges or production operations.  
**Parent:** PR #71, commit `cf5c7f258b46e03717b9cfbe3eaff038c65d0744`.  
**Branch:** `work/v134r1-merchant-render-reuse-staging`.  
**Render workspace:** My Workspace `tea-dbphgh0n74is73dvsnng` (read-only).

## VERIFIED in connected accounts

**Render:**
- `tien404-auth-staging` static site, service ID `srv-dbpj4irm8hqs73e2h2rg`, branch `work/supabase-auth-staging-v1`, build command `node scripts/build-auth-preview.mjs`, auto-deploy off, most recent `live` deploy `dep-dbsa4fl6e07s7399ab30` of commit `b14501a0ebf04d991302cb32b5d548a68d6b39bd` (2026-11-14).
- `tien404-data-staging` Python FastAPI web service, ID `srv-dbphtas9v7es73bursrg`, branch `ops/tenant-data-platform-v1-staging-20261110`, auto-deploy off, most recent `live` deployment `dep-dbqj9plg1s2s73egr30g` of commit `ab940a95dae8afdff426bc6ac71693833d5348ce` (2026-11-12). These are deployed statuses, NOT full authenticated E2E verification.
- Existing `scripts/build-auth-preview.mjs` publishes `merchant-portal.html` and allowed JS/CSS assets. Existing `assets/merchant-portal.js` verifies `getUser`, membership and tenant selection. Existing `assets/merchant-lists.mjs` supports paginated tenant-scoped `products`, `orders`, `customers`; it checks tenant readback and uses authenticated Supabase client with RLS.
- Existing FastAPI `ops/data-platform/app/main.py` exposes `/api/v1/tenants`, `/api/v1/tenants/{tenant_id}/products`, `/api/v1/tenants/{tenant_id}/orders`, validates JWT through `/auth/v1/user`, membership and tenant readback; excludes customers endpoint. `/health` deliberately returns CONFIGURED_NOT_VERIFIED, not live DB proof.
- Static Auth Merchant and Render Data FastAPI are **separate** services. Neither automatically supplies same-origin `/api/sales-lite/me` to Cloudflare Preview. Cross-domain tokens/cookies must **not** be passed via query strings or session bridging without reviewed architecture.

**Supabase:** Staging table schemas `tenants`, `tenant_memberships`, `customers`, `orders`, `products` verified. SELECT RLS policies on customers/orders require current authenticated active owner/manager membership matching `tenant_id`; products require active member. No real JWT A/B tests in this work. Privileged `qa_shop_b_zalo_claim` anon EXECUTE remains P0 security review issue.

## IMPLEMENTED — isolated on Draft branch

- Added **safe, fixed** link from existing V13.4 Merchant Portal overview to Render's already-built `/merchant-portal.html`, labeled **staging** and describing separate login; no tenant ID, phone, email, credentials, token, order ID, role or session included in URL.
- The existing data-bearing customer/order screens are reused, not duplicated. This is **navigation**, not same-origin Auth API integration.
- Added test verifying exact target HTTPS origin/path, empty query/fragment and `noopener noreferrer`; source/network safety regression. Dedicated CI checks inherited Tier and Commerce safety contracts.
- No change to Render service, GitHub `gh-pages`, Cloudflare Access, Supabase SQL/RLS, real customers/orders, webhook, published n8n, Billing or subscription permissions.

## QA and release blockers

- Source/contract CI must pass on final HEAD; do not cite PR existence as tested.
- Still **BLOCKED**: real authenticated Shop A/B owner/manager and revoked/no-member hosted QA, separate domain SSO decision, `/api/sales-lite/me` adapter, authoritative subscription source, live E2E and durable idempotency, security-definer RPC caller audit.
- Render deploy `live` status doesn't prove current 200/401 or browser sign-in; external probe unavailable in this environment and has not been used as evidence.
- Browser testing on original V13.4R prior commit 5/5 is historical; no new hosted browser E2E.
- No mutation or new provider sends.

## Next safe path

1. With two authorized QA identities, test existing `https://tien404-auth-staging.onrender.com/merchant-portal.html` for Shop A/B, expired/revoked membership, role access and tenant isolation. Preserve real data.
2. Review current Render Auth build SHA vs branch and customer/order display permissions, ensure no stale RLS race; inventory `qa_shop_b_zalo_claim` callers read-only.
3. Choose one canonical identity and API origin, then implement authenticated `/api/sales-lite/me` adapter, replacing QA fixtures only after hosted tests; avoid token relay via URL.
4. Keep SaaS packages research-only until billing/subscription source and owner approval.

## Rollback

Close/revert this stacked Draft PR only. Upstream #71/#70/#69 unchanged. No DB/service rollback required.
