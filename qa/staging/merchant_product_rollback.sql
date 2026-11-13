-- Run only on the approved Supabase staging database, as a QA operator.
-- Impersonates claims at the database boundary. No identity or grant changes.
BEGIN;
SET LOCAL statement_timeout = '15s';
DO $$
DECLARE
  shop record;
  actor uuid;
  foreign_shop uuid;
  sku_tag text := 'QA-V11-' || gen_random_uuid()::text;
  version1 timestamptz;
  version2 timestamptz;
  own_count integer := 0;
BEGIN
  FOR shop IN SELECT id, slug FROM public.tenants WHERE
    (id, slug) IN (('9c8c524c-88db-4771-8ab0-a4316298494c'::uuid,'qa-staging-shop-a-20261110'),
                   ('4b12fc28-4fc3-4b06-bbf1-72a1f62ad5c5'::uuid,'qa-staging-shop-b-20261110'))
  LOOP
    own_count := own_count + 1;
    SELECT m.user_id INTO STRICT actor FROM public.tenant_memberships m
    WHERE m.tenant_id=shop.id AND m.active AND m.role='owner'
    ORDER BY m.user_id LIMIT 1;
    foreign_shop := CASE WHEN shop.id='9c8c524c-88db-4771-8ab0-a4316298494c'::uuid
      THEN '4b12fc28-4fc3-4b06-bbf1-72a1f62ad5c5'::uuid ELSE '9c8c524c-88db-4771-8ab0-a4316298494c'::uuid END;
    PERFORM set_config('request.jwt.claim.sub',actor::text,true);
    SET LOCAL ROLE authenticated;
    version1 := public.save_merchant_product(shop.id,sku_tag,'QA',100,true,3,NULL);
    version2 := public.save_merchant_product(shop.id,sku_tag,'QA edited',200,false,NULL,version1);
    IF version2 <= version1 OR NOT EXISTS (SELECT FROM public.products WHERE tenant_id=shop.id
      AND sku=sku_tag AND price_vnd=200 AND stock_on_hand=3 AND NOT is_active AND name='QA edited') THEN
      RAISE EXCEPTION 'edit readback mismatch'; END IF;
    BEGIN PERFORM public.save_merchant_product(shop.id,sku_tag,'stale',1,true,NULL,version1);
      RAISE EXCEPTION 'stale edit accepted'; EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
    BEGIN PERFORM public.save_merchant_product(foreign_shop,sku_tag,'foreign',1,true,NULL,version2);
      RAISE EXCEPTION 'foreign write accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN UPDATE public.products SET price_vnd=1 WHERE sku=sku_tag AND tenant_id=shop.id;
      RAISE EXCEPTION 'direct update accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN PERFORM public.save_merchant_product(shop.id,sku_tag,'bad price',-1,true,NULL,version2);
      RAISE EXCEPTION 'negative price accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
    BEGIN PERFORM public.save_merchant_product(shop.id,sku_tag || '-bad','bad stock',10,true,-1,NULL);
      RAISE EXCEPTION 'negative stock accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
    RESET ROLE;
    IF (SELECT count(*) FROM app_private.audit_events WHERE tenant_id=shop.id AND actor_id=actor
        AND metadata->>'sku'=sku_tag AND event_type='product_create') <> 1
       OR (SELECT count(*) FROM app_private.audit_events WHERE tenant_id=shop.id AND actor_id=actor
        AND metadata->>'sku'=sku_tag AND event_type='product_edit') <> 1 THEN
      RAISE EXCEPTION 'audit mismatch'; END IF;
    PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
    SET LOCAL ROLE authenticated;
    BEGIN PERFORM public.save_merchant_product(shop.id,sku_tag,'nonmember',10,true,NULL,version2);
      RAISE EXCEPTION 'nonmember write accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    RESET ROLE;
  END LOOP;
  IF own_count <> 2 THEN RAISE EXCEPTION 'required two QA shops'; END IF;
END $$;
ROLLBACK;
