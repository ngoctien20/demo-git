-- Rollback of 40_store_sku_contract.sql: restores UNIQUE(tenant_id,sku) and the step-2
-- store-aware writer body (verbatim copy of 20_store_aware_writer.sql). Refuses while any
-- tenant holds the same SKU in more than one Store: those rows are data and must be renamed
-- or removed deliberately first (nothing is deleted here).
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $pre$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.products'::regclass AND conname='products_tenant_id_sku_key') THEN
  RAISE EXCEPTION 'T404_CONTRACT_ROLLBACK_NOT_APPLIED'; END IF;
 IF EXISTS (SELECT 1 FROM public.products GROUP BY tenant_id,sku HAVING count(*)>1) THEN
  RAISE EXCEPTION 'T404_CONTRACT_ROLLBACK_SKU_IN_SEVERAL_STORES'; END IF;
END $pre$;
ALTER TABLE public.products ADD CONSTRAINT products_tenant_id_sku_key UNIQUE(tenant_id,sku);
CREATE OR REPLACE FUNCTION public.save_merchant_product(p_tenant uuid, p_sku text, p_name text, p_price bigint, p_active boolean, p_initial_stock integer, p_expected_updated_at timestamp with time zone)
 RETURNS timestamp with time zone LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  actor uuid := auth.uid();
  changed_at timestamptz;
  target_store uuid;
BEGIN
  -- V20 Store authority: the caller must be an active owner/manager of the Store the row
  -- lives in (existing product by tenant+SKU, otherwise the tenant's default Store), with an
  -- active tenant membership and an active Store. Tenant role alone no longer suffices.
  SELECT coalesce(
    (SELECT p.store_id FROM public.products p WHERE p.tenant_id=p_tenant AND p.sku=p_sku),
    (SELECT d.id FROM public.stores d WHERE d.tenant_id=p_tenant AND d.is_default))
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
DO $post$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.products'::regclass AND conname='products_tenant_id_sku_key') THEN
  RAISE EXCEPTION 'T404_CONTRACT_ROLLBACK_FAILED'; END IF;
 RAISE NOTICE 'T404_V20_STORE_SKU_CONTRACT_ROLLBACK_OK';
END $post$;
COMMIT;
