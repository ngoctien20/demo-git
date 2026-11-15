# TIEN404 AI V13.5R.1 — Hosted Auth / Shop A-B Security Readiness

**Date:** 2026-11-15 JST. **Audit: LIVE DATABASE METADATA ONLY; signed-user hosted QA NOT RUN.**
**Environment:** Supabase staging `ifxlvrhyjhbzbrkdsida`; Auth Render static staging; no production actions.

## VERIFIED — metadata (read-only)
- `public.tenants`, `tenant_memberships`, `orders`, `customers`, `products` have RLS **enabled and FORCE RLS**.
- PostgreSQL `anon`: `SELECT` on all five tables = **false**. `authenticated`: `SELECT` = **true**, `UPDATE` = **false**.
- `orders`: `id uuid`, `tenant_id uuid`, `status text`, `total_vnd bigint`, `created_at timestamptz`; V13.5 read-only projection matches.
- `orders_manager_read`: active `tenant_memberships` where `user_id=auth.uid()`, `tenant_id=orders.tenant_id`, role owner/manager; customers follow same policy. Tenant + membership SELECT policies use matching `auth.uid()`.
- Both QA tenants exist, with *active membership counts*: Shop A owner: **1**; Shop B owner: **2** (read-only aggregated metadata, no user IDs disclosed). This is fixture presence, **not evidence that separate users cannot read each other**.
- `public.qa_shop_b_zalo_claim(p_challenge uuid,p_code text,p_sender text,p_event text)` is SECURITY DEFINER and `anon EXECUTE=true`, `authenticated EXECUTE=false`. Risk remains; no ACL modification.
- Render `tien404-auth-staging` and `tien404-data-staging` have auto-deploy disabled; no V13.5R.1 deployment was made.
- No browser tab connected to authenticated Render merchant sessions during this audit. Shell external network DNS could not resolve the staging hostname; no anonymous 200/302 claims made.

## NOT VERIFIED — required real tests

The connected Supabase SQL administrative context may bypass the exact HTTP auth/RLS path; do **not** count admin SQL metadata or mock JWT tests as hosted isolation. Do **not** fetch/stash credentials, OTP or tokens in PR/issues/logs.

| Real scenario | Expected | Evidence required | Status |
|---|---|---|---|
| Authenticated Shop A owner reads A orders | Only A | Authorized HTTPS session, redacted row counts | BLOCKED |
| Same session asks B orders | No B rows | Redacted HTTP response/no PII | BLOCKED |
| Shop B owner reads B orders / requests A | B only | Independent authorized session | BLOCKED |
| Anonymous or revoked session asks orders | 401/403 or zero by RLS, no data | Actual API result | BLOCKED |
| Revoked membership with still-valid JWT | Empty/denied with authoritative RLS, stale UI locked | Before/after screenshots without secrets | BLOCKED |
| Owner/manager versus staff | Staff denied orders unless separately approved | Real policy response | BLOCKED |
| Revalidate after 5 minutes, logout, shop switch | No cross-shop stale data | Browser E2E with authorized QA identities | BLOCKED |
| Legacy `account.html` route | Opens canonical `merchant-portal.html`, without token/role/query | Hosted build after explicitly approved staging release | BLOCKED |

**Progress already TESTED:** PR #78 mocked Shop A Orders/Role contracts; PR #81 static canonical entry + mocked locked page and route. These are **not** real hosted tests.

## Security P0 decision

1. Review all RPC callers (n8n/Worker/GitHub source) and current rollback path for `qa_shop_b_zalo_claim` before changing its `EXECUTE` grant. A limited n8n sample of Zalo ingress/router/Shop B QA workflows did not show a literal RPC reference; not exhaustive.
2. Preserve live ACL, RLS, secrets and auth users pending **separate explicit owner approval** for any change.
3. For hosted QA, run authenticated HTTP checks in an authorized user session; do not expose JWT in screenshots or chat. No customer record writes.
4. Do not promote code beyond EXPERIMENTAL until Shop A/B positive/negative proof exists.

## Rollback

No DB mutation, so none is required. Close Draft PR #81 to discard source changes. Never rotate credentials as a workaround for missing QA session evidence.
