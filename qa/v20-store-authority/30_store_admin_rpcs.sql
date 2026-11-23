-- TIEN404 V20 Store Authority — step 3: Store administration RPCs. STATUS: PROPOSED (offline only).
-- Requires 10 + 20. Adds three SECURITY DEFINER RPCs so an owner can actually run more than one
-- Store without service_role or direct table writes (authenticated still has SELECT only):
--   create_store(p_tenant, p_store_key, p_name)            tenant OWNER only; caller becomes Store owner
--   set_store_member(p_store, p_user, p_role, p_active)     tenant owner or Store owner; target must be an
--                                                           active member of the same tenant; nobody edits
--                                                           their own row; the last active Store owner stays
--   save_merchant_product_in_store(p_store, ...)            same rules as save_merchant_product but the Store
--                                                           is explicit (no default-store guess)
-- Same QA tenant allow-list as the live writer. UNIQUE(tenant_id,sku) is still kept, so one SKU
-- lives in one Store per tenant until the contract phase retires save_merchant_product (v1).
-- Rollback: 70_store_admin_rpcs_rollback.sql (drops only these functions; Stores created through
-- them stay, and 90 refuses while a tenant has more than one Store).
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $pre$ BEGIN
 IF to_regclass('public.store_memberships') IS NULL THEN RAISE EXCEPTION 'T404_ADMIN_PRECHECK_EXPAND_MISSING'; END IF;
 IF pg_get_functiondef('public.save_merchant_product(uuid,text,text,bigint,boolean,integer,timestamptz)'::regprocedure) NOT LIKE '%store_memberships%' THEN
  RAISE EXCEPTION 'T404_ADMIN_PRECHECK_WRITER_NOT_STORE_AWARE'; END IF;
 IF to_regprocedure('public.create_store(uuid,text,text)') IS NOT NULL THEN RAISE EXCEPTION 'T404_ADMIN_PRECHECK_ALREADY_APPLIED'; END IF;
END $pre$;

-- QA allow-list shared by the three RPCs (same two tenants as the live writer).
CREATE FUNCTION app_private.t404_qa_tenant_allowed(p_tenant uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id=p_tenant
  AND ((t.id='9c8c524c-88db-4771-8ab0-a4316298494c'::uuid AND t.slug='qa-staging-shop-a-20261110')
    OR (t.id='4b12fc28-4fc3-4b06-bbf1-72a1f62ad5c5'::uuid AND t.slug='qa-staging-shop-b-20261110')))
$f$;
REVOKE ALL ON FUNCTION app_private.t404_qa_tenant_allowed(uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.create_store(p_tenant uuid, p_store_key text, p_name text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE actor uuid := auth.uid(); new_id uuid;
BEGIN
 IF actor IS NULL OR NOT app_private.t404_qa_tenant_allowed(p_tenant) OR NOT EXISTS (
   SELECT 1 FROM public.tenant_memberships m
   WHERE m.tenant_id=p_tenant AND m.user_id=actor AND m.active AND m.role='owner') THEN
  RAISE EXCEPTION 'access_denied' USING ERRCODE='42501';
 END IF;
 IF p_store_key IS NULL OR p_store_key !~ '^[a-z][a-z0-9-]{1,62}$' OR p_store_key='main'
    OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 150 THEN
  RAISE EXCEPTION 'invalid_store' USING ERRCODE='22023';
 END IF;
 IF (SELECT count(*) FROM public.stores s WHERE s.tenant_id=p_tenant) >= 20 THEN
  RAISE EXCEPTION 'store_limit_reached' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.stores(tenant_id,store_key,name,is_default)
  VALUES (p_tenant,p_store_key,btrim(p_name),false) RETURNING id INTO new_id;
 INSERT INTO public.store_memberships(tenant_id,store_id,user_id,role,active)
  VALUES (p_tenant,new_id,actor,'owner',true);
 INSERT INTO app_private.audit_events(tenant_id,actor_id,event_type,metadata)
  VALUES (p_tenant,actor,'store_create',jsonb_build_object('store_id',new_id,'store_key',p_store_key));
 RETURN new_id;
EXCEPTION WHEN unique_violation THEN
 RAISE EXCEPTION 'store_key_taken' USING ERRCODE='23505';
END $f$;

CREATE FUNCTION public.set_store_member(p_store uuid, p_user uuid, p_role text, p_active boolean)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE actor uuid := auth.uid(); tid uuid;
BEGIN
 SELECT s.tenant_id INTO tid FROM public.stores s WHERE s.id=p_store;
 IF actor IS NULL OR tid IS NULL OR NOT app_private.t404_qa_tenant_allowed(tid) OR NOT (
   EXISTS (SELECT 1 FROM public.tenant_memberships m
           WHERE m.tenant_id=tid AND m.user_id=actor AND m.active AND m.role='owner')
   OR EXISTS (SELECT 1 FROM public.store_memberships sm
           JOIN public.tenant_memberships m ON m.tenant_id=sm.tenant_id AND m.user_id=sm.user_id AND m.active
           WHERE sm.tenant_id=tid AND sm.store_id=p_store AND sm.user_id=actor AND sm.active AND sm.role='owner')) THEN
  RAISE EXCEPTION 'access_denied' USING ERRCODE='42501';
 END IF;
 IF p_user IS NULL OR p_user=actor OR p_role IS NULL OR p_role NOT IN ('owner','manager','staff') OR p_active IS NULL THEN
  RAISE EXCEPTION 'invalid_member' USING ERRCODE='22023';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id=tid AND m.user_id=p_user AND m.active) THEN
  RAISE EXCEPTION 'not_a_tenant_member' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.store_memberships(tenant_id,store_id,user_id,role,active)
  VALUES (tid,p_store,p_user,p_role,p_active)
  ON CONFLICT (tenant_id,store_id,user_id) DO UPDATE SET role=EXCLUDED.role, active=EXCLUDED.active;
 IF NOT EXISTS (SELECT 1 FROM public.store_memberships sm
   WHERE sm.tenant_id=tid AND sm.store_id=p_store AND sm.active AND sm.role='owner') THEN
  RAISE EXCEPTION 'last_store_owner' USING ERRCODE='22023';
 END IF;
 INSERT INTO app_private.audit_events(tenant_id,actor_id,event_type,metadata)
  VALUES (tid,actor,'store_member_set',
   jsonb_build_object('store_id',p_store,'user_id',p_user,'role',p_role,'active',p_active));
END $f$;

CREATE FUNCTION public.save_merchant_product_in_store(p_store uuid, p_sku text, p_name text, p_price bigint, p_active boolean, p_initial_stock integer, p_expected_updated_at timestamptz)
 RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE actor uuid := auth.uid(); tid uuid; changed_at timestamptz;
BEGIN
 SELECT s.tenant_id INTO tid FROM public.stores s WHERE s.id=p_store AND s.active;
 IF actor IS NULL OR tid IS NULL OR NOT app_private.t404_qa_tenant_allowed(tid) OR NOT EXISTS (
   SELECT 1 FROM public.store_memberships sm
   JOIN public.tenant_memberships m ON m.tenant_id=sm.tenant_id AND m.user_id=sm.user_id AND m.active
   WHERE sm.tenant_id=tid AND sm.store_id=p_store AND sm.user_id=actor AND sm.active AND sm.role IN ('owner','manager')) THEN
  RAISE EXCEPTION 'access_denied' USING ERRCODE='42501';
 END IF;
 IF p_sku IS NULL OR length(btrim(p_sku)) NOT BETWEEN 1 AND 80 OR p_sku<>btrim(p_sku)
    OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 250
    OR p_price IS NULL OR p_price NOT BETWEEN 0 AND 1000000000000 OR p_active IS NULL THEN
  RAISE EXCEPTION 'invalid_product' USING ERRCODE='22023';
 END IF;
 IF p_expected_updated_at IS NULL THEN
  IF p_initial_stock IS NULL OR p_initial_stock < 0 THEN
   RAISE EXCEPTION 'invalid_initial_stock' USING ERRCODE='22023';
  END IF;
  BEGIN
   INSERT INTO public.products(tenant_id,store_id,sku,name,price_vnd,is_active,stock_on_hand)
   VALUES (tid,p_store,p_sku,btrim(p_name),p_price,p_active,p_initial_stock)
   RETURNING updated_at INTO changed_at;
  EXCEPTION WHEN unique_violation THEN
   -- Tenant-wide SKU uniqueness is kept in the expand phase; never reveal which Store holds it.
   RAISE EXCEPTION 'sku_taken' USING ERRCODE='23505';
  END;
 ELSE
  IF p_initial_stock IS NOT NULL THEN
   RAISE EXCEPTION 'stock_is_managed_separately' USING ERRCODE='22023';
  END IF;
  UPDATE public.products SET name=btrim(p_name),price_vnd=p_price,is_active=p_active,
    updated_at=greatest(clock_timestamp(),updated_at + interval '1 microsecond')
  WHERE tenant_id=tid AND store_id=p_store AND sku=p_sku AND updated_at=p_expected_updated_at
  RETURNING updated_at INTO changed_at;
  IF NOT FOUND THEN RAISE SQLSTATE 'PT409' USING MESSAGE='product_changed_or_missing'; END IF;
 END IF;
 INSERT INTO app_private.audit_events(tenant_id,actor_id,event_type,metadata)
  VALUES (tid,actor,CASE WHEN p_expected_updated_at IS NULL THEN 'product_create' ELSE 'product_edit' END,
   jsonb_build_object('sku',p_sku,'store_id',p_store));
 RETURN changed_at;
END $f$;

REVOKE ALL ON FUNCTION public.create_store(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_store_member(uuid,uuid,text,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_merchant_product_in_store(uuid,text,text,bigint,boolean,integer,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_store(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_store_member(uuid,uuid,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_merchant_product_in_store(uuid,text,text,bigint,boolean,integer,timestamptz) TO authenticated;

DO $post$ DECLARE f text; BEGIN
 FOREACH f IN ARRAY ARRAY['public.create_store(uuid,text,text)','public.set_store_member(uuid,uuid,text,boolean)',
   'public.save_merchant_product_in_store(uuid,text,text,bigint,boolean,integer,timestamptz)'] LOOP
  IF has_function_privilege('anon',f,'EXECUTE') THEN RAISE EXCEPTION 'T404_ADMIN_POST_ANON_CAN_EXECUTE %', f; END IF;
  IF NOT has_function_privilege('authenticated',f,'EXECUTE') THEN RAISE EXCEPTION 'T404_ADMIN_POST_AUTH_CANNOT_EXECUTE %', f; END IF;
 END LOOP;
 IF has_table_privilege('authenticated','public.stores','INSERT') OR has_table_privilege('authenticated','public.store_memberships','INSERT') THEN
  RAISE EXCEPTION 'T404_ADMIN_POST_DIRECT_WRITE_GRANTED'; END IF;
 RAISE NOTICE 'T404_V20_STORE_ADMIN_RPCS_OK';
END $post$;
COMMIT;
