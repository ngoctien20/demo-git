\set ON_ERROR_STOP on
-- V18.0-P0C independent disposable Postgres 17 ONLY
-- All actors, UUIDs, secrets, and tenant fixtures are synthetic. No cloud credentials.
-- Two fixed QA tenant UUID allowlist literals in save_merchant_product were
-- replaced with fake UUIDs; three main routine bodies otherwise come from read-only deployed definition.
DO $$
BEGIN
 IF current_database() <> 't404_v180_p0c_ci' OR current_user <> 'postgres'
 OR current_setting('server_version_num')::int < 170000 THEN
  RAISE EXCEPTION 'DISPOSABLE_POSTGRES17_ONLY';
 END IF;
END $$;
CREATE ROLE anon NOLOGIN NOBYPASSRLS;
CREATE ROLE authenticated NOLOGIN NOBYPASSRLS;
CREATE SCHEMA auth;
CREATE SCHEMA extensions;
CREATE SCHEMA vault;
CREATE SCHEMA tien404_r1_qa;
CREATE SCHEMA app_private;
CREATE SCHEMA qa;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
 LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE public.tenants(id uuid PRIMARY KEY, slug text NOT NULL);
CREATE TABLE public.tenant_memberships(tenant_id uuid,user_id uuid,active boolean,role text,
 PRIMARY KEY(tenant_id,user_id));
CREATE TABLE public.products(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
 sku text NOT NULL,name text NOT NULL,price_vnd bigint NOT NULL,stock_on_hand integer NOT NULL,
 is_active boolean NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,sku));
CREATE TABLE app_private.audit_events(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 tenant_id uuid,actor_id uuid,event_type text NOT NULL,metadata jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE TABLE vault.decrypted_secrets(name text PRIMARY KEY,decrypted_secret text);
CREATE TABLE tien404_r1_qa.tenant_identity_map(
 tenant_key text,store_key text,bot_key text,auth_tenant_id uuid,
 PRIMARY KEY(tenant_key,store_key,bot_key));
CREATE TABLE tien404_r1_qa.shop_bots(
 tenant_key text,store_key text,bot_key text, enabled_mode text,identity_status text,
 PRIMARY KEY(tenant_key,store_key,bot_key));
CREATE TABLE tien404_r1_qa.owner_pairing_challenges(
 tenant_key text,store_key text,bot_key text,challenge_id uuid PRIMARY KEY,
 owner_ref text NOT NULL,code_hash text NOT NULL, expires_at timestamptz NOT NULL,
 used_at timestamptz,failed_attempts integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), requester_user_id uuid);
CREATE TABLE tien404_r1_qa.owner_pairing_claims_v3(
 tenant_key text,store_key text,bot_key text,challenge_id uuid PRIMARY KEY,
 recipient_ref text NOT NULL,inbound_event_ref text NOT NULL UNIQUE,
 status text NOT NULL,claimed_at timestamptz NOT NULL DEFAULT now(),confirmed_at timestamptz);
CREATE OR REPLACE FUNCTION tien404_r1_qa.issue_owner_challenge(p_tenant text,p_store text,p_bot text)
RETURNS TABLE(challenge uuid,code text) LANGUAGE plpgsql AS $stub$
BEGIN
 challenge:='33333333-3333-4333-8333-333333333333';
 code:='0123456789abcdef0123456789abcdef';
 INSERT INTO tien404_r1_qa.owner_pairing_challenges
 (tenant_key,store_key,bot_key,challenge_id,owner_ref,code_hash,expires_at,requester_user_id)
 VALUES(p_tenant,p_store,p_bot,challenge,'SYNTHETIC_OWNER',code,now()+interval '5 minutes',auth.uid())
 ON CONFLICT(challenge_id) DO UPDATE SET expires_at=EXCLUDED.expires_at,used_at=NULL;
 RETURN NEXT;
END $stub$;
CREATE OR REPLACE FUNCTION tien404_r1_qa.confirm_owner_pairing_v3_qa(p_tenant text,p_store text,p_bot text,p_challenge uuid)
RETURNS boolean LANGUAGE plpgsql AS $stub$
DECLARE n int;
BEGIN
 UPDATE tien404_r1_qa.owner_pairing_challenges SET used_at=clock_timestamp()
 WHERE tenant_key=p_tenant AND store_key=p_store AND bot_key=p_bot AND challenge_id=p_challenge
 AND used_at IS NULL AND expires_at>now();
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n=1 THEN
  UPDATE tien404_r1_qa.owner_pairing_claims_v3 SET status='confirmed',confirmed_at=now()
  WHERE challenge_id=p_challenge;
 END IF;
 RETURN n=1;
END $stub$;
CREATE OR REPLACE FUNCTION tien404_r1_qa.claim_owner_pairing_v3_synthetic(
 p_tenant text,p_store text,p_bot text,p_challenge uuid,p_code text,p_recipient text,p_inbound_event text)
RETURNS boolean LANGUAGE plpgsql AS $stub$
DECLARE n integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM tien404_r1_qa.owner_pairing_challenges
  WHERE tenant_key=p_tenant AND store_key=p_store AND bot_key=p_bot AND challenge_id=p_challenge
  AND code_hash=p_code AND used_at IS NULL AND expires_at>now() AND failed_attempts<5)
 THEN RETURN false; END IF;
 INSERT INTO tien404_r1_qa.owner_pairing_claims_v3
 (tenant_key,store_key,bot_key,challenge_id,recipient_ref,inbound_event_ref,status)
 VALUES(p_tenant,p_store,p_bot,p_challenge,p_recipient,p_inbound_event,'pending')
 ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT;
 RETURN n=1;
END $stub$;
INSERT INTO public.tenants(id,slug) VALUES
 ('11111111-1111-4111-8111-111111111111','qa-staging-shop-a-20261110'),('22222222-2222-4222-8222-222222222222','qa-staging-shop-b-20261110');
INSERT INTO public.tenant_memberships(tenant_id,user_id,active,role) VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true,'owner'),
 ('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true,'staff'),
 ('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true,'owner');
INSERT INTO tien404_r1_qa.tenant_identity_map VALUES
 ('qa-tenant-a','qa-store-a','qa-bot-a','11111111-1111-4111-8111-111111111111'),
 ('qa-tenant-b','qa-store-b','qa-bot-b','22222222-2222-4222-8222-222222222222');
INSERT INTO tien404_r1_qa.shop_bots VALUES
 ('qa-tenant-a','qa-store-a','qa-bot-a','dry_run','synthetic_qa'),
 ('qa-tenant-b','qa-store-b','qa-bot-b','dry_run','synthetic_qa');
INSERT INTO tien404_r1_qa.owner_pairing_challenges
(tenant_key,store_key,bot_key,challenge_id,owner_ref,code_hash,expires_at,requester_user_id)
VALUES('qa-tenant-b','qa-store-b','qa-bot-b','44444444-4444-4444-8444-444444444444',
'SYNTHETIC_OWNER','0123456789abcdef0123456789abcdef',now()+interval '5 minutes','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
INSERT INTO vault.decrypted_secrets VALUES
 ('qa_shop_b_zalo_claim_key',repeat('S',64));

-- Deployed RPC semantics: qa_owner_pairing; save_merchant_product QA UUID literals substituted only.
CREATE OR REPLACE FUNCTION public.qa_owner_pairing(p_shop uuid, p_action text, p_challenge uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 m tien404_r1_qa.tenant_identity_map%ROWTYPE;
 c tien404_r1_qa.owner_pairing_challenges%ROWTYPE;
 claim tien404_r1_qa.owner_pairing_claims_v3%ROWTYPE;
 code text;
BEGIN
 SELECT i.* INTO m FROM tien404_r1_qa.tenant_identity_map i
 JOIN tien404_r1_qa.shop_bots b USING(tenant_key,store_key,bot_key)
 JOIN public.tenant_memberships tm ON tm.tenant_id=i.auth_tenant_id
 WHERE i.auth_tenant_id=p_shop AND tm.user_id=auth.uid() AND tm.active AND tm.role='owner'
 AND (i.tenant_key,i.store_key,i.bot_key) IN (('qa-tenant-a','qa-store-a','qa-bot-a'),('qa-tenant-b','qa-store-b','qa-bot-b'))
 AND b.enabled_mode='dry_run' AND b.identity_status='synthetic_qa'
 FOR SHARE OF tm,b;
 IF NOT FOUND THEN RAISE insufficient_privilege; END IF;
 IF p_action='issue' AND p_challenge IS NULL THEN
   SELECT v.challenge,v.code INTO c.challenge_id,code
     FROM tien404_r1_qa.issue_owner_challenge(m.tenant_key,m.store_key,m.bot_key) v;
   SELECT * INTO STRICT c FROM tien404_r1_qa.owner_pairing_challenges h
    WHERE h.tenant_key=m.tenant_key AND h.store_key=m.store_key AND h.bot_key=m.bot_key AND h.challenge_id=c.challenge_id;
   RETURN jsonb_build_object('state','WAITING_FOR_BOT','challengeId',c.challenge_id,'code',code,'expiresAt',c.expires_at,'bot',m.bot_key);
 END IF;
 IF p_action IS NULL OR p_action NOT IN ('status','confirm') OR (p_action='confirm' AND p_challenge IS NULL) THEN RAISE EXCEPTION 'unsupported action' USING ERRCODE='22023'; END IF;
 SELECT * INTO c FROM tien404_r1_qa.owner_pairing_challenges WHERE
   (tenant_key,store_key,bot_key)=(m.tenant_key,m.store_key,m.bot_key)
   AND requester_user_id=auth.uid() AND expires_at>now() AND failed_attempts<5
   AND (p_challenge IS NULL OR challenge_id=p_challenge) ORDER BY created_at DESC LIMIT 1;
 IF NOT FOUND THEN RETURN jsonb_build_object('state','NO_CURRENT_CHALLENGE'); END IF;
 IF p_action='confirm' THEN
   IF c.used_at IS NULL AND tien404_r1_qa.confirm_owner_pairing_v3_qa(m.tenant_key,m.store_key,m.bot_key,c.challenge_id) THEN
     RETURN jsonb_build_object('status','PAIRED','challengeId',c.challenge_id);
   END IF;
   RAISE EXCEPTION 'claim unavailable' USING ERRCODE='PT409';
 END IF;
 SELECT * INTO claim FROM tien404_r1_qa.owner_pairing_claims_v3 WHERE (tenant_key,store_key,bot_key,challenge_id)=(m.tenant_key,m.store_key,m.bot_key,c.challenge_id);
 RETURN jsonb_build_object('state',CASE WHEN c.used_at IS NOT NULL THEN 'CLOSED' WHEN claim.status='PENDING_OWNER_CONFIRMATION' THEN 'PENDING_OWNER_CONFIRMATION' ELSE 'WAITING_FOR_BOT' END,
 'challengeId',c.challenge_id,'expiresAt',c.expires_at,'bot',m.bot_key,
 'recipientFingerprint',left(encode(extensions.digest(claim.recipient_ref,'sha256'),'hex'),12));
END $function$;

-- Deployed RPC semantics: qa_shop_b_zalo_claim; save_merchant_product QA UUID literals substituted only.
CREATE OR REPLACE FUNCTION public.qa_shop_b_zalo_claim(p_challenge uuid, p_code text, p_sender text, p_event text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  gate text;
  supplied text := current_setting('request.headers',true)::jsonb ->> 'x-tien404-pairing';
BEGIN
  SELECT decrypted_secret INTO gate FROM vault.decrypted_secrets WHERE name='qa_shop_b_zalo_claim_key';
  IF gate IS NULL OR length(gate) < 43 OR supplied IS NULL OR length(supplied)>256 OR
    extensions.digest(supplied,'sha256') <> extensions.digest(gate,'sha256') THEN
    RAISE insufficient_privilege;
  END IF;
  IF p_challenge IS NULL OR p_code IS NULL OR p_code !~ '^[0-9a-f]{32}$'
     OR p_sender IS NULL OR length(p_sender) NOT BETWEEN 1 AND 128
     OR p_event IS NULL OR length(p_event) NOT BETWEEN 1 AND 128 THEN RETURN false; END IF;
  RETURN tien404_r1_qa.claim_owner_pairing_v3_synthetic('qa-tenant-b','qa-store-b','qa-bot-b',
    p_challenge,p_code,
    'qa-recipient-' || encode(extensions.hmac('recipient:'||p_sender,gate,'sha256'),'hex'),
    'qa-event-' || encode(extensions.hmac('event:'||p_event,gate,'sha256'),'hex'));
END $function$;

-- Deployed RPC semantics: save_merchant_product; save_merchant_product QA UUID literals substituted only.
CREATE OR REPLACE FUNCTION public.save_merchant_product(p_tenant uuid, p_sku text, p_name text, p_price bigint, p_active boolean, p_initial_stock integer, p_expected_updated_at timestamp with time zone)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  actor uuid := auth.uid();
  changed_at timestamptz;
BEGIN
  IF actor IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.tenants t
    JOIN public.tenant_memberships m ON m.tenant_id=t.id
    WHERE t.id=p_tenant AND m.user_id=actor AND m.active
      AND m.role IN ('owner','manager')
      AND ((t.id='11111111-1111-4111-8111-111111111111'::uuid AND t.slug='qa-staging-shop-a-20261110')
        OR (t.id='22222222-2222-4222-8222-222222222222'::uuid AND t.slug='qa-staging-shop-b-20261110'))
  ) THEN
    RAISE EXCEPTION 'access_denied' USING ERRCODE='42501';
  END IF;
  IF p_sku IS NULL OR length(btrim(p_sku)) NOT BETWEEN 1 AND 80
     OR p_sku<>btrim(p_sku)
     OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 250
     OR p_price IS NULL OR p_price NOT BETWEEN 0 AND 1000000000000
     OR p_active IS NULL THEN
    RAISE EXCEPTION 'invalid_product' USING ERRCODE='22023';
  END IF;
  IF p_expected_updated_at IS NULL THEN
    IF p_initial_stock IS NULL OR p_initial_stock < 0 THEN
      RAISE EXCEPTION 'invalid_initial_stock' USING ERRCODE='22023';
    END IF;
    INSERT INTO public.products(tenant_id,sku,name,price_vnd,is_active,stock_on_hand)
    VALUES(p_tenant,p_sku,btrim(p_name),p_price,p_active,p_initial_stock)
    RETURNING updated_at INTO changed_at;
  ELSE
    IF p_initial_stock IS NOT NULL THEN
      RAISE EXCEPTION 'stock_is_managed_separately' USING ERRCODE='22023';
    END IF;
    UPDATE public.products SET name=btrim(p_name),price_vnd=p_price,is_active=p_active,
      updated_at=greatest(clock_timestamp(),updated_at + interval '1 microsecond')
    WHERE tenant_id=p_tenant AND sku=p_sku AND updated_at=p_expected_updated_at
    RETURNING updated_at INTO changed_at;
    IF NOT FOUND THEN
      RAISE SQLSTATE 'PT409' USING MESSAGE='product_changed_or_missing';
    END IF;
  END IF;
  INSERT INTO app_private.audit_events(tenant_id,actor_id,event_type,metadata)
    VALUES(p_tenant,actor,
      CASE WHEN p_expected_updated_at IS NULL THEN 'product_create' ELSE 'product_edit' END,
      jsonb_build_object('sku',p_sku));
  RETURN changed_at;
END
$function$;


REVOKE EXECUTE ON FUNCTION public.qa_owner_pairing(uuid,text,uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.qa_shop_b_zalo_claim(uuid,text,text,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_merchant_product(uuid,text,text,bigint,boolean,integer,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qa_owner_pairing(uuid,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_merchant_product(uuid,text,text,bigint,boolean,integer,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.qa_shop_b_zalo_claim(uuid,text,text,text) TO anon;
CREATE FUNCTION qa.assert_error(stmt text, expected text) RETURNS void LANGUAGE plpgsql AS $qa$
DECLARE actual text:='NO_ERROR';
BEGIN
 BEGIN EXECUTE stmt;
 EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS actual=RETURNED_SQLSTATE;
 END;
 IF actual<>expected THEN RAISE EXCEPTION 'QA_EXPECTED_SQLSTATE_%_GOT_% stmt:%',expected,actual,left(stmt,80); END IF;
END $qa$;
CREATE FUNCTION qa.assert_bool(stmt text,expected boolean) RETURNS void LANGUAGE plpgsql AS $qa$
DECLARE actual boolean;
BEGIN
 EXECUTE stmt INTO actual;
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'QA_EXPECTED_%_GOT_%',expected,actual; END IF;
END $qa$;
GRANT USAGE ON SCHEMA qa TO anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA qa TO anon,authenticated;


-- RA-01, RP-01: anon cannot call owner/product privileged functions.
SET ROLE anon;
SELECT qa.assert_error('select public.qa_owner_pairing(''11111111-1111-4111-8111-111111111111''::uuid,''issue'',null)','42501');
SELECT qa.assert_error('select public.save_merchant_product(''11111111-1111-4111-8111-111111111111''::uuid,''SKU'',''item'',1,true,1,null)','42501');
-- RZ-01 / RZ-02: missing and incorrect trusted synthetic ingress gate.
SELECT qa.assert_error('select public.qa_shop_b_zalo_claim(''44444444-4444-4444-8444-444444444444''::uuid,''0123456789abcdef0123456789abcdef'',''sender'',''event'')','42501');
SELECT set_config('request.headers','{"x-tien404-pairing":"BAD_SYNTHETIC"}',false);
SELECT qa.assert_error('select public.qa_shop_b_zalo_claim(''44444444-4444-4444-8444-444444444444''::uuid,''0123456789abcdef0123456789abcdef'',''sender'',''event'')','42501');
RESET ROLE;
-- RZ-03/RZ-05: synthetically correct gate, invalid code denied; duplicate claim denied.
SET ROLE anon;
SELECT set_config('request.headers',jsonb_build_object('x-tien404-pairing',repeat('S',64))::text,false);
SELECT qa.assert_bool('select public.qa_shop_b_zalo_claim(''44444444-4444-4444-8444-444444444444''::uuid,''short'',''sender'',''event'')',false);
SELECT qa.assert_bool('select public.qa_shop_b_zalo_claim(''44444444-4444-4444-8444-444444444444''::uuid,''0123456789abcdef0123456789abcdef'',''sender'',''event'')',true);
SELECT qa.assert_bool('select public.qa_shop_b_zalo_claim(''44444444-4444-4444-8444-444444444444''::uuid,''0123456789abcdef0123456789abcdef'',''sender'',''event'')',false);
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM tien404_r1_qa.owner_pairing_claims_v3)<>1 THEN
   RAISE EXCEPTION 'DUPLICATE_ZALO_CLAIM_COUNT';
 END IF;
 RAISE NOTICE 'PASS_RZ_SYNTHETIC_HEADER_INVALID_CODE_AND_REPLAY';
END $$;
-- RA-02: same tenant non-owner explicitly denied.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
SELECT qa.assert_error('select public.qa_owner_pairing(''11111111-1111-4111-8111-111111111111''::uuid,''issue'',null)','42501');
-- RP-03: tenant staff denied product writes.
SELECT qa.assert_error('select public.save_merchant_product(''11111111-1111-4111-8111-111111111111''::uuid,''QA_SKU_1'',''Item'',159000,true,2,null)','42501');
-- RA-03 / RP-02: nonmember denied; caller-controlled metadata cannot override Auth subject.
SELECT set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',false);
SELECT set_config('request.jwt.claim.user_metadata','{"role":"owner"}',false);
SELECT qa.assert_error('select public.qa_owner_pairing(''11111111-1111-4111-8111-111111111111''::uuid,''issue'',null)','42501');
SELECT qa.assert_error('select public.save_merchant_product(''11111111-1111-4111-8111-111111111111''::uuid,''QA_SKU_1'',''Item'',159000,true,2,null)','42501');
-- RA-04: no active mapping of test outsider shop.
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
SELECT qa.assert_error('select public.qa_owner_pairing(''55555555-5555-4555-8555-555555555555''::uuid,''issue'',null)','42501');
-- RA happy-path: owner can issue synthetic challenge for its mapped QA tenant.
SELECT public.qa_owner_pairing('11111111-1111-4111-8111-111111111111'::uuid,'issue',null);
-- RP-06: invalid price / negative starting stock blocked.
SELECT qa.assert_error('select public.save_merchant_product(''11111111-1111-4111-8111-111111111111''::uuid,''QA_SKU_1'',''Item'',-1,true,2,null)','22023');
SELECT qa.assert_error('select public.save_merchant_product(''11111111-1111-4111-8111-111111111111''::uuid,''QA_SKU_1'',''Item'',159000,true,-1,null)','22023');
-- RP-04/RP-09: valid synthetic product insert must create exactly one audit.
SELECT public.save_merchant_product('11111111-1111-4111-8111-111111111111'::uuid,'QA_SKU_1','QA Item',159000,true,2,null);
-- RP-05: optimistic-locking stale update must not mutate.
SELECT qa.assert_error('select public.save_merchant_product(''11111111-1111-4111-8111-111111111111''::uuid,''QA_SKU_1'',''Changed'',159001,true,null,''2020-01-01T00:00:00Z''::timestamptz)','PT409');
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.products)<>1 OR
    (SELECT count(*) FROM app_private.audit_events)<>1 OR
    (SELECT price_vnd FROM public.products WHERE sku='QA_SKU_1')<>159000 THEN
  RAISE EXCEPTION 'FAILED_AUTHORIZED_WRITE_AUDIT_OR_STALE_LOCK';
 END IF;
 -- Known blocker: there is no store_id column or same-tenant Store A/B check in this legacy RPC.
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='store_id') THEN
  RAISE EXCEPTION 'TEST_SETUP_NOT_REPRODUCING_LEGACY_STORE_GAP';
 END IF;
 RAISE NOTICE 'PASS_RPC_AUTH_ROLE_TENANT_VALIDATION_AND_OPTIMISTIC_LOCK';
 RAISE NOTICE 'KNOWN_GAP_RP07_RP08_LEGACY_PRODUCT_HAS_NO_STORE_SCOPE';
 RAISE NOTICE 'NOT_TESTED_NATIVE_PROVIDER_SIGNATURE_REAL_JWT_REAL_VAULT_BACKUP';
END $$;

