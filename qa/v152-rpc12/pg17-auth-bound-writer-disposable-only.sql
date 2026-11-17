-- TIEN404 RPC12: AUTH.UID()-BOUND STORE WRITER, PG17 DISPOSABLE-ONLY REHEARSAL.
-- NOT a Supabase migration, NOT a real JWT test. NEVER RUN ON HOSTED.
-- In ephemeral CI, auth.uid() is a STUB reading synthetic request.jwt.claim.sub.
-- Production Supabase auth.uid() must only trust PostgREST JWT-verified context.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database() <> 't404_rpc8_ci'
    OR current_user <> 'postgres'
    OR current_setting('tien404.rpc8_ephemeral',true) <> 'RPC8_DISPOSABLE'
    OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
    OR to_regclass('qa_rpc8.stores') IS NULL
    OR to_regclass('qa_rpc8.store_memberships') IS NULL
    OR (SELECT count(*) FROM pg_policies WHERE schemaname='qa_rpc8'
        AND tablename IN ('products','orders','customers','order_items','conversations','messages')) <> 6
    OR (SELECT count(*) FROM information_schema.columns
        WHERE table_schema='qa_rpc8' AND column_name='store_id'
        AND table_name IN ('products','orders','customers','order_items','conversations','messages')
        AND is_nullable='NO') <> 6
    OR to_regprocedure('qa_rpc8.create_product_store_v2(uuid,uuid,text,bigint,integer)') IS NULL
 THEN RAISE EXCEPTION 'RPC12_REFUSES_NONDISPOSABLE_OR_INCOMPLETE_PARENT'; END IF;
END $guard$;

-- CI emulates PostgREST setting verified JWT claim AFTER authentication.
-- SQL session GUC is not itself a trusted signature; never use it as a hosted proof.
CREATE SCHEMA auth;
REVOKE ALL ON SCHEMA auth FROM PUBLIC;
CREATE FUNCTION auth.uid() RETURNS uuid
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
 AS $fn$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $fn$;
REVOKE ALL ON FUNCTION auth.uid() FROM PUBLIC;

-- Test-only DB identities. Dedicated function owner NEVER owns Commerce tables.
CREATE ROLE qa_rpc12_authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
CREATE ROLE qa_rpc12_writer NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
CREATE SCHEMA qa_rpc12;
CREATE SCHEMA qa_rpc12_api;
REVOKE ALL ON SCHEMA qa_rpc12,qa_rpc12_api FROM PUBLIC;
GRANT USAGE ON SCHEMA auth TO qa_rpc12_writer,qa_rpc12_authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO qa_rpc12_writer,qa_rpc12_authenticated;
GRANT USAGE ON SCHEMA qa_rpc8 TO qa_rpc12_writer;
GRANT USAGE ON SCHEMA qa_rpc12 TO qa_rpc12_authenticated,qa_rpc12_writer;
GRANT USAGE ON SCHEMA qa_rpc12_api TO qa_rpc12_authenticated;
GRANT SELECT ON qa_rpc8.stores,qa_rpc8.store_memberships,qa_rpc8.tenant_memberships TO qa_rpc12_writer;
GRANT SELECT,INSERT,UPDATE ON qa_rpc8.products TO qa_rpc12_writer;
-- PG17 row-lock FOR SHARE additionally needs a narrowly scoped UPDATE column
-- privilege. RLS has NO UPDATE policies on these authority tables, so this
-- NOLOGIN writer still cannot mutate membership/store status. Verify in CI.
GRANT UPDATE(active) ON qa_rpc8.stores TO qa_rpc12_writer;
GRANT UPDATE(active) ON qa_rpc8.store_memberships TO qa_rpc12_writer;
GRANT UPDATE(active) ON qa_rpc8.tenant_memberships TO qa_rpc12_writer;

-- Writer role is distinct from gateway role; only writer may write under RLS.
CREATE POLICY rpc12_writer_tenant_membership ON qa_rpc8.tenant_memberships
 FOR SELECT TO qa_rpc12_writer
 USING(user_id=(SELECT auth.uid()) AND active AND role IN ('owner','manager'));
CREATE POLICY rpc12_writer_store_membership ON qa_rpc8.store_memberships
 FOR SELECT TO qa_rpc12_writer
 USING(user_id=(SELECT auth.uid()) AND active AND role IN ('owner','manager')
   AND EXISTS(SELECT 1 FROM qa_rpc8.tenant_memberships tm
    WHERE tm.tenant_id=store_memberships.tenant_id
      AND tm.user_id=store_memberships.user_id AND tm.active AND tm.role IN ('owner','manager')));
CREATE POLICY rpc12_writer_store ON qa_rpc8.stores
 FOR SELECT TO qa_rpc12_writer
 USING(active AND EXISTS(SELECT 1 FROM qa_rpc8.store_memberships sm
  WHERE sm.tenant_id=stores.tenant_id AND sm.store_id=stores.id
  AND sm.user_id=(SELECT auth.uid()) AND sm.active AND sm.role IN ('owner','manager')));
-- SELECT ... FOR SHARE is classified as a locking read requiring UPDATE RLS
-- USING in PG17. WITH CHECK(FALSE) prevents ANY actual status mutation;
-- QA must ensure no alternative PERMISSIVE UPDATE policy broadens this deny.
CREATE POLICY rpc12_authority_lock_tenant ON qa_rpc8.tenant_memberships
 FOR UPDATE TO qa_rpc12_writer
 USING(user_id=(SELECT auth.uid()) AND active AND role IN ('owner','manager'))
 WITH CHECK(false);
CREATE POLICY rpc12_authority_lock_member ON qa_rpc8.store_memberships
 FOR UPDATE TO qa_rpc12_writer
 USING(user_id=(SELECT auth.uid()) AND active AND role IN ('owner','manager')
   AND EXISTS(SELECT 1 FROM qa_rpc8.tenant_memberships tm
     WHERE tm.tenant_id=store_memberships.tenant_id
       AND tm.user_id=store_memberships.user_id AND tm.active AND tm.role IN ('owner','manager')))
 WITH CHECK(false);
CREATE POLICY rpc12_authority_lock_store ON qa_rpc8.stores
 FOR UPDATE TO qa_rpc12_writer
 USING(active AND EXISTS(SELECT 1 FROM qa_rpc8.store_memberships sm
   WHERE sm.tenant_id=stores.tenant_id AND sm.store_id=stores.id
     AND sm.user_id=(SELECT auth.uid()) AND sm.active AND sm.role IN ('owner','manager')))
 WITH CHECK(false);
CREATE POLICY rpc12_writer_product_select ON qa_rpc8.products
 FOR SELECT TO qa_rpc12_writer
 USING(store_id IS NOT NULL AND EXISTS(SELECT 1 FROM qa_rpc8.store_memberships sm
  JOIN qa_rpc8.tenant_memberships tm ON tm.tenant_id=sm.tenant_id AND tm.user_id=sm.user_id
  JOIN qa_rpc8.stores s ON s.id=sm.store_id AND s.tenant_id=sm.tenant_id
  WHERE sm.tenant_id=products.tenant_id AND sm.store_id=products.store_id
    AND sm.user_id=(SELECT auth.uid()) AND sm.active AND sm.role IN ('owner','manager')
    AND tm.active AND tm.role IN ('owner','manager') AND s.active));
CREATE POLICY rpc12_writer_product_insert ON qa_rpc8.products
 FOR INSERT TO qa_rpc12_writer
 WITH CHECK(store_id IS NOT NULL AND EXISTS(SELECT 1 FROM qa_rpc8.store_memberships sm
  JOIN qa_rpc8.tenant_memberships tm ON tm.tenant_id=sm.tenant_id AND tm.user_id=sm.user_id
  JOIN qa_rpc8.stores s ON s.id=sm.store_id AND s.tenant_id=sm.tenant_id
  WHERE sm.tenant_id=products.tenant_id AND sm.store_id=products.store_id
    AND sm.user_id=(SELECT auth.uid()) AND sm.active AND sm.role IN ('owner','manager')
    AND tm.active AND tm.role IN ('owner','manager') AND s.active));
CREATE POLICY rpc12_writer_product_update ON qa_rpc8.products
 FOR UPDATE TO qa_rpc12_writer
 USING(store_id IS NOT NULL AND EXISTS(SELECT 1 FROM qa_rpc8.store_memberships sm
  JOIN qa_rpc8.tenant_memberships tm ON tm.tenant_id=sm.tenant_id AND tm.user_id=sm.user_id
  JOIN qa_rpc8.stores s ON s.id=sm.store_id AND s.tenant_id=sm.tenant_id
  WHERE sm.tenant_id=products.tenant_id AND sm.store_id=products.store_id
    AND sm.user_id=(SELECT auth.uid()) AND sm.active AND sm.role IN ('owner','manager')
    AND tm.active AND tm.role IN ('owner','manager') AND s.active))
 WITH CHECK(store_id IS NOT NULL AND EXISTS(SELECT 1 FROM qa_rpc8.store_memberships sm
  JOIN qa_rpc8.tenant_memberships tm ON tm.tenant_id=sm.tenant_id AND tm.user_id=sm.user_id
  JOIN qa_rpc8.stores s ON s.id=sm.store_id AND s.tenant_id=sm.tenant_id
  WHERE sm.tenant_id=products.tenant_id AND sm.store_id=products.store_id
    AND sm.user_id=(SELECT auth.uid()) AND sm.active AND sm.role IN ('owner','manager')
    AND tm.active AND tm.role IN ('owner','manager') AND s.active));

-- Owner gate takes ONLY p_store, not a client-provided tenant or actor.
-- The Store->Tenant assignment is read from the authoritative DB and locked.
-- Dedicated owner has no BYPASSRLS and no DELETE rights.
CREATE FUNCTION qa_rpc12.create_product_inner(p_store uuid,p_sku text,p_price bigint,p_stock integer)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE caller uuid := auth.uid(); trusted_tenant uuid; product_id uuid;
BEGIN
 IF caller IS NULL THEN RAISE EXCEPTION 'RPC12_UNAUTHENTICATED' USING ERRCODE='42501'; END IF;
 IF p_store IS NULL OR p_sku IS NULL OR p_sku<>pg_catalog.btrim(p_sku)
 OR pg_catalog.length(p_sku) NOT BETWEEN 1 AND 80
 OR p_price IS NULL OR p_price NOT BETWEEN 0 AND 1000000000000
 OR p_stock IS NULL OR p_stock<0
 THEN RAISE EXCEPTION 'RPC12_INVALID_PRODUCT' USING ERRCODE='22023'; END IF;
 SELECT s.tenant_id INTO trusted_tenant
 FROM qa_rpc8.stores s
 JOIN qa_rpc8.store_memberships sm ON sm.tenant_id=s.tenant_id AND sm.store_id=s.id
 JOIN qa_rpc8.tenant_memberships tm ON tm.tenant_id=sm.tenant_id AND tm.user_id=sm.user_id
 WHERE s.id=p_store AND s.active AND sm.user_id=caller
 AND sm.active AND sm.role IN('owner','manager') AND tm.active AND tm.role IN('owner','manager')
 FOR SHARE OF s,sm,tm;
 IF trusted_tenant IS NULL THEN RAISE EXCEPTION 'RPC12_STORE_AUTH_DENIED' USING ERRCODE='42501'; END IF;
 product_id := pg_catalog.gen_random_uuid();
 INSERT INTO qa_rpc8.products(id,tenant_id,store_id,sku,price_vnd,stock_on_hand)
 VALUES(product_id,trusted_tenant,p_store,p_sku,p_price,p_stock);
 RETURN product_id;
END $fn$;
CREATE FUNCTION qa_rpc12.update_product_price_inner(p_store uuid,p_sku text,p_expected_price bigint,p_new_price bigint)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE caller uuid := auth.uid(); trusted_tenant uuid; changed integer;
BEGIN
 IF caller IS NULL THEN RAISE EXCEPTION 'RPC12_UNAUTHENTICATED' USING ERRCODE='42501'; END IF;
 IF p_store IS NULL OR p_sku IS NULL OR p_sku<>pg_catalog.btrim(p_sku)
 OR pg_catalog.length(p_sku) NOT BETWEEN 1 AND 80
 OR p_expected_price IS NULL OR p_expected_price NOT BETWEEN 0 AND 1000000000000
 OR p_new_price IS NULL OR p_new_price NOT BETWEEN 0 AND 1000000000000
 THEN RAISE EXCEPTION 'RPC12_INVALID_PRICE' USING ERRCODE='22023'; END IF;
 SELECT s.tenant_id INTO trusted_tenant
 FROM qa_rpc8.stores s
 JOIN qa_rpc8.store_memberships sm ON sm.tenant_id=s.tenant_id AND sm.store_id=s.id
 JOIN qa_rpc8.tenant_memberships tm ON tm.tenant_id=sm.tenant_id AND tm.user_id=sm.user_id
 WHERE s.id=p_store AND s.active AND sm.user_id=caller
 AND sm.active AND sm.role IN('owner','manager') AND tm.active AND tm.role IN('owner','manager')
 FOR SHARE OF s,sm,tm;
 IF trusted_tenant IS NULL THEN RAISE EXCEPTION 'RPC12_STORE_AUTH_DENIED' USING ERRCODE='42501'; END IF;
 UPDATE qa_rpc8.products SET price_vnd=p_new_price
 WHERE tenant_id=trusted_tenant AND store_id=p_store AND sku=p_sku AND price_vnd=p_expected_price;
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>1 THEN RAISE EXCEPTION 'RPC12_STALE_OR_MISSING' USING ERRCODE='PT409'; END IF;
 RETURN changed;
END $fn$;

-- Only owner of the SECURITY DEFINER code is permitted to touch underlying tables.
-- qa_rpc12_writer has NOLOGIN, NO BYPASSRLS and NEVER owns product/membership tables.
GRANT CREATE ON SCHEMA qa_rpc12 TO qa_rpc12_writer;
ALTER FUNCTION qa_rpc12.create_product_inner(uuid,text,bigint,integer) OWNER TO qa_rpc12_writer;
ALTER FUNCTION qa_rpc12.update_product_price_inner(uuid,text,bigint,bigint) OWNER TO qa_rpc12_writer;
REVOKE CREATE ON SCHEMA qa_rpc12 FROM qa_rpc12_writer;
REVOKE ALL ON FUNCTION qa_rpc12.create_product_inner(uuid,text,bigint,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION qa_rpc12.update_product_price_inner(uuid,text,bigint,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qa_rpc12.create_product_inner(uuid,text,bigint,integer) TO qa_rpc12_authenticated;
GRANT EXECUTE ON FUNCTION qa_rpc12.update_product_price_inner(uuid,text,bigint,bigint) TO qa_rpc12_authenticated;

-- Thin SECURITY INVOKER API analogous to public RPC exposed by PostgREST.
-- qa_rpc12_api is NOT an actually exposed hosted schema. Never claim real JWT from this stub.
CREATE FUNCTION qa_rpc12_api.create_product(p_store uuid,p_sku text,p_price bigint,p_stock integer)
 RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path = ''
 AS $fn$ SELECT qa_rpc12.create_product_inner(p_store,p_sku,p_price,p_stock) $fn$;
CREATE FUNCTION qa_rpc12_api.update_price(p_store uuid,p_sku text,p_expected_price bigint,p_new_price bigint)
 RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = ''
 AS $fn$ SELECT qa_rpc12.update_product_price_inner(p_store,p_sku,p_expected_price,p_new_price) $fn$;
REVOKE ALL ON FUNCTION qa_rpc12_api.create_product(uuid,text,bigint,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION qa_rpc12_api.update_price(uuid,text,bigint,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qa_rpc12_api.create_product(uuid,text,bigint,integer) TO qa_rpc12_authenticated;
GRANT EXECUTE ON FUNCTION qa_rpc12_api.update_price(uuid,text,bigint,bigint) TO qa_rpc12_authenticated;

DO $post$ BEGIN
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='qa_rpc8' AND policyname LIKE 'rpc12_writer_%') <> 6
 OR (SELECT count(*) FROM pg_roles WHERE rolname='qa_rpc12_writer' AND rolcanlogin=false AND rolbypassrls=false)<>1
 OR (SELECT count(*) FROM pg_policies WHERE schemaname='qa_rpc8'
     AND tablename IN('stores','store_memberships','tenant_memberships')
     AND cmd='UPDATE')<>3
 OR (SELECT count(*) FROM pg_policies WHERE schemaname='qa_rpc8'
     AND tablename IN('stores','store_memberships','tenant_memberships')
     AND cmd='UPDATE' AND btrim(with_check,'() ')='false')<>3
 OR has_table_privilege('qa_rpc12_authenticated','qa_rpc8.products','INSERT')
 OR has_table_privilege('qa_rpc12_authenticated','qa_rpc8.products','UPDATE')
 OR NOT has_table_privilege('qa_rpc12_writer','qa_rpc8.products','UPDATE')
 THEN RAISE EXCEPTION 'RPC12_LEAST_PRIVILEGE_POSTCHECK_FAILED'; END IF;
END $post$;