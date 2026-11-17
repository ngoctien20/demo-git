-- V15.0-10U.2: disposable PG17 only. Synthetic fixture, NEVER hosted or production.
-- Reference v1 table shape and synthetic Owner RPC analogs, NOT copies of live function bodies.
BEGIN;
CREATE SCHEMA auth;
CREATE SCHEMA tien404_r1_qa;
CREATE ROLE anon NOLOGIN NOBYPASSRLS;
CREATE ROLE authenticated NOLOGIN NOBYPASSRLS;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE TABLE public.tenants (id uuid PRIMARY KEY);
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
-- WARNING: set_config in these disposable tests simulates a verified subject;
-- it is NOT JWT verification and may NEVER be accepted as hosted JWT proof.
CREATE TABLE tien404_r1_qa.shop_bots (
  tenant_key text NOT NULL, store_key text NOT NULL, bot_key text NOT NULL,
  enabled_mode text NOT NULL DEFAULT 'dry_run',
  identity_status text NOT NULL DEFAULT 'synthetic_qa',
  PRIMARY KEY (tenant_key,store_key,bot_key)
);
CREATE TABLE tien404_r1_qa.tenant_identity_map (
  tenant_key text PRIMARY KEY, store_key text NOT NULL, bot_key text NOT NULL,
  auth_tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id),
  UNIQUE(store_key,bot_key),
  FOREIGN KEY(tenant_key,store_key,bot_key)
    REFERENCES tien404_r1_qa.shop_bots(tenant_key,store_key,bot_key)
);
CREATE TABLE tien404_r1_qa.catalog (
  tenant_key text NOT NULL,store_key text NOT NULL,bot_key text NOT NULL,sku text NOT NULL,
  product_name text NOT NULL, price_vnd bigint NOT NULL CHECK (price_vnd>0),
  stock integer NOT NULL CHECK (stock>=0),
  PRIMARY KEY(tenant_key,store_key,bot_key,sku),
  FOREIGN KEY(tenant_key,store_key,bot_key)
    REFERENCES tien404_r1_qa.shop_bots(tenant_key,store_key,bot_key)
);
ALTER TABLE tien404_r1_qa.catalog ENABLE ROW LEVEL SECURITY;
-- Synthetic v1 Owner function analogs. DO NOT equate with the live Owner RPC implementations.
CREATE FUNCTION public.qa_owner_pairing(p_shop uuid,p_action text,p_challenge uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $$ BEGIN RETURN jsonb_build_object('ok',EXISTS(SELECT 1 FROM tien404_r1_qa.tenant_identity_map
  WHERE auth_tenant_id=p_shop AND p_action='verify' AND p_challenge IS NOT NULL)); END $$;
REVOKE ALL ON FUNCTION public.qa_owner_pairing(uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qa_owner_pairing(uuid,text,uuid) TO authenticated;
CREATE FUNCTION tien404_r1_qa.owner_authorized_qa(p_tenant_key text,p_store_key text,p_bot_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $$ SELECT EXISTS(SELECT 1 FROM tien404_r1_qa.tenant_identity_map
 WHERE tenant_key=p_tenant_key AND store_key=p_store_key AND bot_key=p_bot_key) $$;
REVOKE ALL ON FUNCTION tien404_r1_qa.owner_authorized_qa(text,text,text) FROM PUBLIC;
INSERT INTO public.tenants VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO auth.users VALUES
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222'),
 ('33333333-3333-4333-8333-333333333333');
INSERT INTO tien404_r1_qa.shop_bots(tenant_key,store_key,bot_key) VALUES
 ('qa-tenant-a','qa-store-a','qa-bot-a'),
 ('qa-tenant-a','qa-store-a2','qa-bot-a2'),
 ('qa-tenant-b','qa-store-b','qa-bot-b');
INSERT INTO tien404_r1_qa.tenant_identity_map VALUES
 ('qa-tenant-a','qa-store-a','qa-bot-a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('qa-tenant-b','qa-store-b','qa-bot-b','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO tien404_r1_qa.catalog VALUES
 ('qa-tenant-a','qa-store-a','qa-bot-a','F01','QA Shirt A',159000,3),
 ('qa-tenant-a','qa-store-a2','qa-bot-a2','F01','QA Shirt A2',179000,7),
 ('qa-tenant-b','qa-store-b','qa-bot-b','F01','QA Shirt B',199000,5);
COMMIT;