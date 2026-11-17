-- TIEN404 RPC11 — Store-bound product writes, disposable synthetic PG17 ONLY.
-- NEVER run against Supabase, production, staging, or customer data.
-- The synthetic_actor GUC is caller-controlled; NOT AUTH / NOT JWT.
-- Source QA uses the pre-existing qa_rpc8 fixture on PR #233 and RPC10 branch.
\set ON_ERROR_STOP on
DO $guard$ BEGIN
 IF current_database()<>'t404_rpc8_ci' OR current_user<>'postgres'
 OR current_setting('tien404.rpc8_ephemeral',true)<>'RPC8_DISPOSABLE'
 OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 OR (SELECT count(*) FROM pg_policies WHERE schemaname='qa_rpc8'
     AND tablename IN ('products','orders','customers','order_items','conversations','messages'))<>6
 OR (SELECT count(*) FROM pg_policies WHERE schemaname='qa_rpc8'
     AND policyname IN ('products_member_read','orders_manager_read','customers_manager_read',
       'order_items_manager_read','conversations_manager_read','messages_manager_read'))<>0
 OR (SELECT count(*) FROM information_schema.columns WHERE table_schema='qa_rpc8'
     AND table_name IN ('products','orders','customers','order_items','conversations','messages')
     AND column_name='store_id' AND is_nullable='NO')<>6
 OR to_regclass('qa_rpc8.store_memberships') IS NULL
 OR to_regclass('qa_rpc8.stores') IS NULL
 THEN RAISE EXCEPTION 'RPC11_REFUSES_HOSTED_OR_INCOMPLETE_SIX_SURFACE_CUTOVER'; END IF;
END $guard$;

-- Privileged test function mimics the danger of SECURITY DEFINER, NOT a production recommendation.
-- Lock all relevant authorization rows FOR SHARE so a concurrent revoke/update
-- cannot complete between authorization and product mutation in this transaction.
CREATE FUNCTION qa_rpc8.create_product_store_v2(
 p_tenant uuid,p_store uuid,p_sku text,p_price bigint,p_stock integer
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE synthetic_actor uuid := qa_rpc8.actor_id(); new_id uuid;
BEGIN
 IF synthetic_actor IS NULL OR p_tenant IS NULL OR p_store IS NULL
 OR p_sku IS NULL OR length(btrim(p_sku)) NOT BETWEEN 1 AND 80 OR p_sku<>btrim(p_sku)
 OR p_price IS NULL OR p_price NOT BETWEEN 0 AND 1000000000000
 OR p_stock IS NULL OR p_stock<0
 THEN RAISE EXCEPTION 'RPC11_INVALID_PRODUCT' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM qa_rpc8.stores s
 JOIN qa_rpc8.store_memberships sm ON sm.tenant_id=s.tenant_id AND sm.store_id=s.id
 JOIN qa_rpc8.tenant_memberships tm ON tm.tenant_id=sm.tenant_id AND tm.user_id=sm.user_id
 WHERE s.tenant_id=p_tenant AND s.id=p_store AND s.active
 AND sm.user_id=synthetic_actor AND sm.active AND sm.role IN ('owner','manager')
 AND tm.active AND tm.role IN ('owner','manager')
 FOR SHARE OF s,sm,tm;
 IF NOT FOUND THEN RAISE insufficient_privilege; END IF;
 new_id := pg_catalog.gen_random_uuid();
 INSERT INTO qa_rpc8.products(id,tenant_id,store_id,sku,price_vnd,stock_on_hand)
 VALUES(new_id,p_tenant,p_store,p_sku,p_price,p_stock);
 RETURN new_id;
END $function$;

CREATE FUNCTION qa_rpc8.update_product_price_store_v2(
 p_tenant uuid,p_store uuid,p_sku text,p_expected_price bigint,p_new_price bigint
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE synthetic_actor uuid := qa_rpc8.actor_id(); changed integer;
BEGIN
 IF synthetic_actor IS NULL OR p_tenant IS NULL OR p_store IS NULL
 OR p_sku IS NULL OR length(btrim(p_sku)) NOT BETWEEN 1 AND 80 OR p_sku<>btrim(p_sku)
 OR p_expected_price IS NULL OR p_expected_price NOT BETWEEN 0 AND 1000000000000
 OR p_new_price IS NULL OR p_new_price NOT BETWEEN 0 AND 1000000000000
 THEN RAISE EXCEPTION 'RPC11_INVALID_PRICE_UPDATE' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM qa_rpc8.stores s
 JOIN qa_rpc8.store_memberships sm ON sm.tenant_id=s.tenant_id AND sm.store_id=s.id
 JOIN qa_rpc8.tenant_memberships tm ON tm.tenant_id=sm.tenant_id AND tm.user_id=sm.user_id
 WHERE s.tenant_id=p_tenant AND s.id=p_store AND s.active
 AND sm.user_id=synthetic_actor AND sm.active AND sm.role IN ('owner','manager')
 AND tm.active AND tm.role IN ('owner','manager')
 FOR SHARE OF s,sm,tm;
 IF NOT FOUND THEN RAISE insufficient_privilege; END IF;
 UPDATE qa_rpc8.products SET price_vnd=p_new_price
 WHERE tenant_id=p_tenant AND store_id=p_store AND sku=p_sku AND price_vnd=p_expected_price;
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>1 THEN RAISE EXCEPTION 'RPC11_PRODUCT_CHANGED_OR_MISSING' USING ERRCODE='PT409'; END IF;
 RETURN changed;
END $function$;
-- No direct INSERT/UPDATE/DELETE grants on products to synthetic user.
REVOKE ALL ON FUNCTION qa_rpc8.create_product_store_v2(uuid,uuid,text,bigint,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION qa_rpc8.update_product_price_store_v2(uuid,uuid,text,bigint,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qa_rpc8.create_product_store_v2(uuid,uuid,text,bigint,integer) TO qa_rpc8_user;
GRANT EXECUTE ON FUNCTION qa_rpc8.update_product_price_store_v2(uuid,uuid,text,bigint,bigint) TO qa_rpc8_user;