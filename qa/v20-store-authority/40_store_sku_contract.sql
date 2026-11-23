-- TIEN404 V20 Store Authority — step 4: CONTRACT (SKU unique per Store). STATUS: PROPOSED.
-- Requires 10 + 20 + 30. Drops UNIQUE(tenant_id,sku) so one SKU can exist in several Stores
-- (own name/price/stock per Store); UNIQUE(tenant_id,store_id,sku) from step 1 stays.
-- The legacy writer save_merchant_product keeps its signature, ACL, validation and error
-- codes, but is pinned to the tenant's default Store (it can no longer reach a branch product
-- by SKU, because the SKU may exist in several Stores). save_merchant_product_in_store is
-- unchanged: its 'sku_taken' now means "taken in this Store".
-- Rollback: 60_store_sku_contract_rollback.sql (refuses while any tenant has a SKU in >1 Store).
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $pre$ BEGIN
 IF to_regprocedure('public.save_merchant_product_in_store(uuid,text,text,bigint,boolean,integer,timestamptz)') IS NULL THEN
  RAISE EXCEPTION 'T404_CONTRACT_PRECHECK_STEP3_MISSING'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.products'::regclass AND conname='products_tenant_store_sku_key') THEN
  RAISE EXCEPTION 'T404_CONTRACT_PRECHECK_STORE_SKU_KEY_MISSING'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.products'::regclass AND conname='products_tenant_id_sku_key') THEN
  RAISE EXCEPTION 'T404_CONTRACT_PRECHECK_ALREADY_APPLIED'; END IF;
 IF pg_get_functiondef('public.save_merchant_product(uuid,text,text,bigint,boolean,integer,timestamptz)'::regprocedure) NOT LIKE '%store_memberships%' THEN
  RAISE EXCEPTION 'T404_CONTRACT_PRECHECK_WRITER_NOT_STORE_AWARE'; END IF;
END $pre$;

-- Writer first: once the tenant-wide key is gone, a (tenant,SKU) lookup could match >1 row.
CREATE OR REPLACE FUNCTION public.save_merchant_product(p_tenant uuid, p_sku text, p_name text, p_price bigint, p_active boolean, p_initial_stock integer, p_expected_updated_at timestamp with time zone)
 RETURNS timestamp with time zone LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  actor uuid := auth.uid();
  changed_at timestamptz;
  target_store uuid;
BEGIN
  -- V20 contract: SKU is unique per Store, so (tenant, SKU) no longer names one row. This
  -- legacy tenant-level writer is pinned to the tenant's DEFAULT Store; other Stores are
  -- written only through save_merchant_product_in_store. Caller must be an active
  -- owner/manager of the default Store with an active tenant membership.
  SELECT d.id FROM public.stores d WHERE d.tenant_id=p_tenant AND d.is_default
    INTO target_store;
  IF actor IS NULL OR target_store IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.tenants t
    JOIN public.tenant_memberships m ON m.tenant_id=t.id AND m.user_id=actor AND m.active
    JOIN public.stores s ON s.tenant_id=t.id AND s.id=target_store AND s.active
    JOIN public.store_memberships sm ON sm.tenant_id=t.id AND sm.store_id=s.id
      AND sm.user_id=actor AND sm.active AND sm.role IN ('owner','manager')
    WHERE t.id=p_tenant
      AND ((t.id='9c8c524c-88db-4771-8ab0-a4316298494c'::uuid AND t.slug='qa-staging-shop-a-20261110')
        OR (t.id='4b12fc28-4fc3-4b06-bbf1-72a1f62ad5c5'::uuid AND t.slug='qa-staging-shop-b-20261110'))
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
    INSERT INTO public.products(tenant_id,store_id,sku,name,price_vnd,is_active,stock_on_hand)
    VALUES(p_tenant,target_store,p_sku,btrim(p_name),p_price,p_active,p_initial_stock)
    RETURNING updated_at INTO changed_at;
  ELSE
    IF p_initial_stock IS NOT NULL THEN
      RAISE EXCEPTION 'stock_is_managed_separately' USING ERRCODE='22023';
    END IF;
    UPDATE public.products SET name=btrim(p_name),price_vnd=p_price,is_active=p_active,
      updated_at=greatest(clock_timestamp(),updated_at + interval '1 microsecond')
    WHERE tenant_id=p_tenant AND store_id=target_store AND sku=p_sku AND updated_at=p_expected_updated_at
    RETURNING updated_at INTO changed_at;
    IF NOT FOUND THEN
      RAISE SQLSTATE 'PT409' USING MESSAGE='product_changed_or_missing';
    END IF;
  END IF;
  INSERT INTO app_private.audit_events(tenant_id,actor_id,event_type,metadata)
    VALUES(p_tenant,actor,
      CASE WHEN p_expected_updated_at IS NULL THEN 'product_create' ELSE 'product_edit' END,
      jsonb_build_object('sku',p_sku,'store_id',target_store));
  RETURN changed_at;
END
$function$;

ALTER TABLE public.products DROP CONSTRAINT products_tenant_id_sku_key;

DO $post$ DECLARE d text := pg_get_functiondef('public.save_merchant_product(uuid,text,text,bigint,boolean,integer,timestamptz)'::regprocedure); BEGIN
 IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.products'::regclass AND conname='products_tenant_id_sku_key') THEN
  RAISE EXCEPTION 'T404_CONTRACT_POST_TENANT_SKU_KEY_STILL_THERE'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.products'::regclass AND conname='products_tenant_store_sku_key') THEN
  RAISE EXCEPTION 'T404_CONTRACT_POST_STORE_SKU_KEY_MISSING'; END IF;
 IF d LIKE '%p.sku=p_sku%' OR d NOT LIKE '%store_memberships%' THEN
  RAISE EXCEPTION 'T404_CONTRACT_POST_WRITER_NOT_PINNED'; END IF;
 IF has_function_privilege('anon','public.save_merchant_product(uuid,text,text,bigint,boolean,integer,timestamptz)','EXECUTE') THEN
  RAISE EXCEPTION 'T404_CONTRACT_POST_ANON_CAN_EXECUTE'; END IF;
 RAISE NOTICE 'T404_V20_STORE_SKU_CONTRACT_OK';
END $post$;
COMMIT;
