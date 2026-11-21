# TIEN404 V19.8.8 — Hosted Supabase UAT Schema Preview (DO NOT APPLY)

**PROPOSED / NOT APPLIED / NOT MERGED.** This design is for a separately approved and disposable Supabase project, never current TIEN404 staging or personal BIO. Creating a new project or development branch can incur charges. User must approve the organization and the quoted cost first.

## Why hosted execution is blocked
Read-only verification shows only two connected projects (TIEN404 staging and personal BIO), with no Supabase development branch. The shared staging Commerce schema still lacks canonical Store scope. Real Owner A/B signed JWT Data API acceptance has not been performed. Previous PostgreSQL tests used mock identities.

## Isolated fixture setup — SQL preview
Only after owner approval, in the exact disposable project. No real customer data or live Bot tokens. The fixture models one tenant, Stores A/B, and same SKU with different price/stock; all data tables have Store RLS. No write privilege is granted to authenticated owners.

~~~sql
-- REVIEW ONLY. Never apply on shared TIEN404 staging / BIO / production.
BEGIN;
CREATE TABLE public.t404_uat1988_tenants (
 tenant_id uuid primary key, code text not null unique
);
CREATE TABLE public.t404_uat1988_stores (
 tenant_id uuid not null references public.t404_uat1988_tenants(tenant_id),
 store_code text not null check(store_code in ('A','B')),
 primary key(tenant_id,store_code)
);
CREATE TABLE public.t404_uat1988_memberships (
 tenant_id uuid not null,store_code text not null,
 user_id uuid not null references auth.users(id),
 active boolean not null default false,
 primary key(tenant_id,store_code,user_id),
 foreign key(tenant_id,store_code) references public.t404_uat1988_stores(tenant_id,store_code)
);
CREATE TABLE public.t404_uat1988_products (
 tenant_id uuid not null,store_code text not null,sku text not null,
 price_vnd bigint not null check(price_vnd>0),
 stock_on_hand integer not null check(stock_on_hand>=0),
 fixture_tag text not null check(fixture_tag='V1988_SYNTHETIC_ONLY'),
 primary key(tenant_id,store_code,sku),
 foreign key(tenant_id,store_code) references public.t404_uat1988_stores(tenant_id,store_code)
);
CREATE TABLE public.t404_uat1988_orders (
 tenant_id uuid not null,store_code text not null,order_ref text not null,
 fixture_tag text not null check(fixture_tag='V1988_SYNTHETIC_ONLY'),
 primary key(tenant_id,store_code,order_ref),
 foreign key(tenant_id,store_code) references public.t404_uat1988_stores(tenant_id,store_code)
);
CREATE TABLE public.t404_uat1988_conversations (
 tenant_id uuid not null,store_code text not null,conversation_ref text not null,
 fixture_tag text not null check(fixture_tag='V1988_SYNTHETIC_ONLY'),
 primary key(tenant_id,store_code,conversation_ref),
 foreign key(tenant_id,store_code) references public.t404_uat1988_stores(tenant_id,store_code)
);
ALTER TABLE public.t404_uat1988_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t404_uat1988_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t404_uat1988_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t404_uat1988_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t404_uat1988_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.t404_uat1988_products FORCE ROW LEVEL SECURITY;
ALTER TABLE public.t404_uat1988_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.t404_uat1988_conversations FORCE ROW LEVEL SECURITY;
CREATE POLICY v1988_self_member_read ON public.t404_uat1988_memberships
 FOR SELECT TO authenticated USING(user_id=(select auth.uid()) AND active=true);
CREATE POLICY v1988_store_products_read ON public.t404_uat1988_products
 FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.t404_uat1988_memberships m WHERE
  m.tenant_id=t404_uat1988_products.tenant_id AND
  m.store_code=t404_uat1988_products.store_code AND
  m.user_id=(select auth.uid()) AND m.active=true)
);
CREATE POLICY v1988_store_orders_read ON public.t404_uat1988_orders
 FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.t404_uat1988_memberships m WHERE
  m.tenant_id=t404_uat1988_orders.tenant_id AND
  m.store_code=t404_uat1988_orders.store_code AND
  m.user_id=(select auth.uid()) AND m.active=true)
);
CREATE POLICY v1988_store_conversations_read ON public.t404_uat1988_conversations
 FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.t404_uat1988_memberships m WHERE
  m.tenant_id=t404_uat1988_conversations.tenant_id AND
  m.store_code=t404_uat1988_conversations.store_code AND
  m.user_id=(select auth.uid()) AND m.active=true)
);
REVOKE ALL ON public.t404_uat1988_memberships,
 public.t404_uat1988_products,public.t404_uat1988_orders,
 public.t404_uat1988_conversations FROM anon,authenticated;
GRANT SELECT ON public.t404_uat1988_memberships,
 public.t404_uat1988_products,public.t404_uat1988_orders,
 public.t404_uat1988_conversations TO authenticated;
INSERT INTO public.t404_uat1988_tenants VALUES
 ('00000000-0000-0000-0000-000000000198','QA_ONLY_SHARED_TENANT');
INSERT INTO public.t404_uat1988_stores VALUES
 ('00000000-0000-0000-0000-000000000198','A'),
 ('00000000-0000-0000-0000-000000000198','B');
INSERT INTO public.t404_uat1988_products VALUES
 ('00000000-0000-0000-0000-000000000198','A','F01',159000,5,'V1988_SYNTHETIC_ONLY'),
 ('00000000-0000-0000-0000-000000000198','B','F01',189000,9,'V1988_SYNTHETIC_ONLY');
INSERT INTO public.t404_uat1988_orders VALUES
 ('00000000-0000-0000-0000-000000000198','A','V1988_A_01','V1988_SYNTHETIC_ONLY'),
 ('00000000-0000-0000-0000-000000000198','B','V1988_B_01','V1988_SYNTHETIC_ONLY');
INSERT INTO public.t404_uat1988_conversations VALUES
 ('00000000-0000-0000-0000-000000000198','A','V1988_A_01','V1988_SYNTHETIC_ONLY'),
 ('00000000-0000-0000-0000-000000000198','B','V1988_B_01','V1988_SYNTHETIC_ONLY');
COMMIT;
~~~

## Provision two real Auth QA accounts in the disposable target
Create two independent test users using the disposable Supabase Auth system. Do NOT share email, password, JWT or auth user IDs in ChatGPT or GitHub. In the approved project's private SQL editor, map each user to one Store using a reviewed operator-only insert:

~~~sql
-- ONLY in the approved disposable project, replace placeholders PRIVATELY.
insert into public.t404_uat1988_memberships(tenant_id,store_code,user_id,active) values
('00000000-0000-0000-0000-000000000198','A','<OWNER_A_AUTH_UUID>',true),
('00000000-0000-0000-0000-000000000198','B','<OWNER_B_AUTH_UUID>',true);
~~~

## Run real Auth / PostgREST UAT locally, AFTER isolated target approval
The runner uses two passwords entered interactively without echoing them. It obtains real signed Auth JWTs from the disposable project's Auth endpoint, verifies both via GET /auth/v1/user, and tests Store-scoped SELECT via PostgREST, anonymous denial and invalid-bearer rejection. Password-login may create new Auth sessions on the disposable target. The runner never prints JWTs or credential strings.

~~~powershell
$env:T404_UAT_EXPLICIT='APPROVED_ISOLATED_READONLY'
$env:T404_UAT_PROJECT_REF='<APPROVED_DISPOSABLE_PROJECT_REF>'
$env:T404_UAT_TARGET_OWNER_APPROVED='<SAME_APPROVED_DISPOSABLE_PROJECT_REF>'
$env:T404_UAT_PUBLISHABLE_KEY='<PUBLIC_ANON_OR_PUBLISHABLE_KEY>'
node qa/channel-v1988/owner-ab-real-auth-readonly-uat.mjs
Remove-Item Env:T404_UAT_EXPLICIT,Env:T404_UAT_PROJECT_REF,Env:T404_UAT_TARGET_OWNER_APPROVED,Env:T404_UAT_PUBLISHABLE_KEY
~~~

Never use any service-role or sb_secret_ key. The runner blocks project IDs ifxlvrhyjhbzbrkdsida (active shared staging) and svxkwpmxgnfvewzwsbdt (personal BIO) even with the flag.

## Acceptance and limits
Real Auth login for Owner A and Owner B must succeed with distinct account IDs, and GET /auth/v1/user must accept signed bearer JWTs. Each Owner must read exactly one row in each of the three fixture tables and no foreign Store rows. Anonymous reads must return no data; deliberately invalid bearer must fail. Negative test without positive fixture is not evidence. All evidence printed is aggregate/test labels only.

**A fixture UAT PASS does not validate the existing Commerce migration, live Bot→Store authority, writes, inventory reservations, or provider sends.** Full 24-case real Owner A/B test plan on versioned Commerce schema remains a separate admission gate. Any unexpected access => NO-GO.

## Rollback
Only approved disposable-project operator may delete isolated test users/data/project after the test, with explicit permission. These draft materials do not change any hosted system. Close Draft PR #459 to roll back the preparation.

Checkpoint: V19.8.8_PREPARED_REAL_JWT_DATA_API_UAT_NO_HOSTED_TARGET_YET
