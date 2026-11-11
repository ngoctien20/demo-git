-- Only run after schema/commerce fixtures in the disposable postgres test service.
BEGIN;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  'SELECT nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
SELECT set_config('request.jwt.claim.sub',user_id::text,true),
       set_config('test.tenant',tenant_id::text,true) FROM public.tenant_memberships LIMIT 1;
SELECT set_config('test.foreign',id::text,true) FROM public.tenants WHERE id<>current_setting('test.tenant')::uuid LIMIT 1;
SET LOCAL ROLE authenticated;
DO $$
DECLARE t uuid := current_setting('test.tenant')::uuid; stamp timestamptz;
BEGIN
  stamp := public.save_merchant_product(t,'SKU-QA','Mẫu',159000,true,8,NULL);
  PERFORM public.save_merchant_product(t,'SKU-QA','Mẫu cập nhật',150000,false,NULL,stamp);
  BEGIN PERFORM public.save_merchant_product(t,'SKU-QA','Cũ',1,true,NULL,stamp);
    RAISE EXCEPTION 'stale edit accepted'; EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
  BEGIN PERFORM public.save_merchant_product(current_setting('test.foreign')::uuid,'SKU-QA','Sai shop',1,true,1,NULL);
    RAISE EXCEPTION 'foreign write accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.save_merchant_product(t,'SKU-QA','Trùng',1,true,1,NULL);
    RAISE EXCEPTION 'duplicate accepted'; EXCEPTION WHEN unique_violation THEN NULL; END;
  IF has_function_privilege('anon','public.save_merchant_product(uuid,text,text,bigint,boolean,integer,timestamptz)','EXECUTE')
     OR has_table_privilege(current_user,'public.products','UPDATE') THEN RAISE EXCEPTION 'excess grant'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.products WHERE sku='SKU-QA' AND NOT is_active AND price_vnd=150000 AND stock_on_hand=8) <> 1
     OR (SELECT count(*) FROM app_private.audit_events WHERE event_type IN ('product_create','product_edit')) <> 2
  THEN RAISE EXCEPTION 'product or audit mismatch'; END IF;
END $$;
ROLLBACK;
