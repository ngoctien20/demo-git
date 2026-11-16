-- TIEN404 V15.0-04H.1 — REVIEW ONLY / NOT EXECUTED
-- Source of truth: Supabase staging public.products & public.tenant_memberships
-- Must execute ONLY within a verified authenticated Supabase user JWT RLS context.
-- NEVER use postgres/admin/service-role to claim successful user authorization.
-- $1: authenticated membership-authorized QA Shop slug (server verified)
-- $2: exact QA SKU, e.g. QA-A001, no V14.7 A001 alias
-- Explicit redundant tenant/membership filter is defense-in-depth in addition
-- to FORCE RLS and products_member_read on public.products.
SELECT p.sku, p.name, p.price_vnd, p.stock_on_hand, p.is_active
FROM public.products AS p
JOIN public.tenants AS t ON t.id = p.tenant_id
WHERE t.slug = $1
  AND p.sku = $2
  AND p.is_active IS TRUE
  AND EXISTS (
    SELECT 1
    FROM public.tenant_memberships AS m
    WHERE m.tenant_id = p.tenant_id
      AND m.user_id = (SELECT auth.uid())
      AND m.active IS TRUE
  )
LIMIT 1;

-- A real authenticated Owner/Manager/Staff QA browser session must prove:
-- Shop A member SELECT QA-A001 succeeds and QA-B001 does NOT succeed;
-- Shop B member SELECT QA-B001 succeeds and QA-A001 does NOT succeed;
-- expired JWT and anon must not read either product.
-- Do not send JWT, refresh token, account identifiers or real store data to
-- GitHub, ChatGPT, n8n execution logs, browser localStorage or URL query.
-- For public Messenger/Zalo customers, this member-only query is NOT a
-- channel connector: the provider-signed Bot→Shop and merchant-consent
-- gates (V14.8/G2.3) remain a separate approval requirement.
