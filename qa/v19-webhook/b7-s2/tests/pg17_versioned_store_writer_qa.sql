\set ON_ERROR_STOP on
-- TIEN404 V19.0-B7-S2. DISPOSABLE POSTGRESQL 17 CI SERVICE ONLY.
-- NOT a migration, NOT real Supabase Auth, NOT a deployable SQL script.
-- QA actor GUC is forgeable in raw PostgreSQL and MUST NEVER be used as
-- production authentication; production must derive actor via auth.uid().
CREATE SCHEMA b7s2;
CREATE ROLE b7s2_client NOLOGIN NOBYPASSRLS;

CREATE TABLE b7s2.stores (
 tenant_id uuid NOT NULL,store_id uuid NOT NULL,
 status text NOT NULL CHECK(status IN('active','suspended')),
 PRIMARY KEY(tenant_id,store_id)
);
CREATE TABLE b7s2.tenant_memberships (
 tenant_id uuid NOT NULL,user_id uuid NOT NULL,role text NOT NULL,
 active boolean NOT NULL,
 PRIMARY KEY(tenant_id,user_id)
);
CREATE TABLE b7s2.store_memberships (
 tenant_id uuid NOT NULL,store_id uuid NOT NULL,user_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN ('store_owner','manager','staff')),
 status text NOT NULL CHECK(status IN ('active','revoked','suspended')),
 expires_at timestamptz NOT NULL,
 PRIMARY KEY(tenant_id,store_id,user_id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES b7s2.stores(tenant_id,store_id)
);
CREATE TABLE b7s2.products (
 tenant_id uuid NOT NULL,store_id uuid NOT NULL,
 sku text NOT NULL,name text NOT NULL,price_vnd bigint NOT NULL CHECK(price_vnd>=0),
 is_active boolean NOT NULL,stock_on_hand integer NOT NULL CHECK(stock_on_hand>=0),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,store_id,sku),
 -- IMPORTANT: mirror legacy UNIQUE(tenant_id,sku), D-02 unresolved.
 UNIQUE(tenant_id,sku),
 FOREIGN KEY(tenant_id,store_id) REFERENCES b7s2.stores(tenant_id,store_id)
);
CREATE TABLE b7s2.audit_log (
 tenant_id uuid NOT NULL,store_id uuid NOT NULL,
 actor_id uuid NOT NULL, sku text NOT NULL,
 action text NOT NULL CHECK(action IN('CREATE','UPDATE')),
 at timestamptz NOT NULL
);

INSERT INTO b7s2.stores VALUES
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','active'),
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','active'),
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','suspended'),
 ('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000004','active');
INSERT INTO b7s2.tenant_memberships VALUES
 ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','owner',true),
 ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','owner',true),
 ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','manager',true),
 ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000004','staff',true),
 ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000005','owner',true),
 ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000006','owner',true),
 ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000007','owner',true),
 ('10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000008','owner',true);
INSERT INTO b7s2.store_memberships VALUES
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','store_owner','active',now()+interval '1 day'),
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','store_owner','active',now()+interval '1 day'),
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','manager','active',now()+interval '1 day'),
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000004','staff','active',now()+interval '1 day'),
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000005','store_owner','revoked',now()+interval '1 day'),
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000006','store_owner','active',now()-interval '1 day'),
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000001','store_owner','active',now()+interval '1 day'),
 ('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000008','store_owner','active',now()+interval '1 day');

-- QA ONLY: mimic the shape of auth.uid() without actually verifying Supabase JWTs.
-- A user can SET this custom GUC in ordinary PostgreSQL. Never deploy this shim.
CREATE FUNCTION b7s2.synthetic_auth_uid() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO '' AS $$
DECLARE raw text;
BEGIN
 raw:=current_setting('request.jwt.claim.sub',true);
 IF raw IS NULL OR raw='' THEN RETURN NULL; END IF;
 RETURN raw::uuid;
EXCEPTION WHEN invalid_text_representation THEN RETURN NULL;
END $$;

-- Versioned Store-aware candidate. The real approved implementation will
-- replace synthetic_auth_uid() with verified auth.uid() and approved public
-- Store schema; this is NOT the literal SQL to publish on Supabase.
CREATE FUNCTION b7s2.save_product_store_v2(
 p_tenant uuid,p_store uuid,p_sku text,p_name text,
 p_price bigint,p_active boolean,p_initial_stock integer,
 p_expected_updated_at timestamptz
) RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE actor uuid:=b7s2.synthetic_auth_uid();
 changed timestamptz;
BEGIN
 IF actor IS NULL OR p_tenant IS NULL OR p_store IS NULL OR
 NOT EXISTS(
  SELECT 1 FROM b7s2.stores s
  JOIN b7s2.store_memberships sm
   ON sm.tenant_id=s.tenant_id AND sm.store_id=s.store_id
  JOIN b7s2.tenant_memberships tm
   ON tm.tenant_id=sm.tenant_id AND tm.user_id=sm.user_id
  WHERE s.tenant_id=p_tenant AND s.store_id=p_store AND s.status='active'
    AND sm.user_id=actor AND sm.status='active'
    AND sm.expires_at>now() AND sm.role IN ('store_owner','manager')
    AND tm.active AND tm.role IN ('owner','manager')
 ) THEN
   RAISE EXCEPTION 'store_access_denied' USING ERRCODE='42501';
 END IF;
 IF p_sku IS NULL OR length(btrim(p_sku)) NOT BETWEEN 1 AND 80 OR
  p_sku<>btrim(p_sku) OR p_name IS NULL OR
  length(btrim(p_name)) NOT BETWEEN 1 AND 250 OR
  p_price IS NULL OR p_price NOT BETWEEN 0 AND 1000000000000 OR
  p_active IS NULL
 THEN
  RAISE EXCEPTION 'invalid_product' USING ERRCODE='22023';
 END IF;
 IF p_expected_updated_at IS NULL THEN
  IF p_initial_stock IS NULL OR p_initial_stock<0 THEN
   RAISE EXCEPTION 'invalid_initial_stock' USING ERRCODE='22023';
  END IF;
  INSERT INTO b7s2.products(
    tenant_id,store_id,sku,name,price_vnd,is_active,stock_on_hand
  ) VALUES(p_tenant,p_store,p_sku,btrim(p_name),p_price,p_active,p_initial_stock)
  RETURNING updated_at INTO changed;
 ELSE
  IF p_initial_stock IS NOT NULL THEN
   RAISE EXCEPTION 'stock_is_managed_separately' USING ERRCODE='22023';
  END IF;
  UPDATE b7s2.products
    SET name=btrim(p_name),price_vnd=p_price,is_active=p_active,
    updated_at=greatest(clock_timestamp(),updated_at+interval '1 microsecond')
    WHERE tenant_id=p_tenant AND store_id=p_store AND sku=p_sku
     AND updated_at=p_expected_updated_at
    RETURNING updated_at INTO changed;
  IF NOT FOUND THEN
   RAISE EXCEPTION 'product_changed_or_missing' USING ERRCODE='PT409';
  END IF;
 END IF;
 INSERT INTO b7s2.audit_log(tenant_id,store_id,actor_id,sku,action,at)
  VALUES(p_tenant,p_store,actor,p_sku,
   CASE WHEN p_expected_updated_at IS NULL THEN 'CREATE' ELSE 'UPDATE' END,
   clock_timestamp());
 RETURN changed;
END $$;

REVOKE ALL ON FUNCTION b7s2.save_product_store_v2(
 uuid,uuid,text,text,bigint,boolean,integer,timestamptz) FROM PUBLIC;
GRANT USAGE ON SCHEMA b7s2 TO b7s2_client;
GRANT EXECUTE ON FUNCTION b7s2.save_product_store_v2(
 uuid,uuid,text,text,bigint,boolean,integer,timestamptz) TO b7s2_client;

-- Utility to assert a specific SQLSTATE without hiding other errors.
CREATE FUNCTION b7s2.qa_expect_error(expected_state text,stmt text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path TO '' AS $$
DECLARE actual text;
BEGIN
 BEGIN
  EXECUTE stmt;
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS actual = RETURNED_SQLSTATE;
 END;
 IF actual IS DISTINCT FROM expected_state THEN
  RAISE EXCEPTION 'expected SQLSTATE %, got %',expected_state,coalesce(actual,'SUCCESS');
 END IF;
 RETURN 'PASS_EXPECTED_'||expected_state;
END $$;
GRANT EXECUTE ON FUNCTION b7s2.qa_expect_error(text,text) TO b7s2_client;

-- Test 1: no direct data access to the function's SECURITY DEFINER tables.
SET ROLE b7s2_client;
SELECT 1/(CASE WHEN
 NOT has_table_privilege(current_user,'b7s2.products','SELECT')
 AND NOT has_table_privilege(current_user,'b7s2.products','INSERT')
 AND NOT has_table_privilege(current_user,'b7s2.products','UPDATE')
 AND NOT has_table_privilege(current_user,'b7s2.audit_log','SELECT')
 THEN 1 ELSE 0 END) AS qa_direct_DML_denied;

-- Test 2: no actor -> denied (simulated absent auth).
SELECT b7s2.qa_expect_error('42501',$q$
 SELECT b7s2.save_product_store_v2(
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'SKU-A','QA A',159000,true,5,NULL)
$q$) AS qa_missing_actor_denied;

SET request.jwt.claim.sub='30000000-0000-0000-0000-000000000001';
-- Test 3: Owner A can insert into own Store.
SELECT set_config('b7s2.qa.a_etag',b7s2.save_product_store_v2(
 '10000000-0000-0000-0000-000000000001',
 '20000000-0000-0000-0000-000000000001',
 'SKU-A','QA A',159000,true,5,NULL)::text,false) AS qa_owner_A_create;

-- Test 4: Owner A cannot impersonate Store B; Tenant Owner with no Store member denied.
SELECT b7s2.qa_expect_error('42501',$q$
 SELECT b7s2.save_product_store_v2(
 '10000000-0000-0000-0000-000000000001',
 '20000000-0000-0000-0000-000000000002',
 'SKU-X','Cross-store',159000,true,5,NULL)
$q$) AS qa_cross_store_denied;
SELECT b7s2.qa_expect_error('42501',$q$
 SELECT b7s2.save_product_store_v2(
 '10000000-0000-0000-0000-000000000001',
 '20000000-0000-0000-0000-000000000003',
 'SKU-S','Suspended',159000,true,5,NULL)
$q$) AS qa_suspended_store_denied;
SELECT b7s2.qa_expect_error('22023',$q$
 SELECT b7s2.save_product_store_v2(
 '10000000-0000-0000-0000-000000000001',
 '20000000-0000-0000-0000-000000000001',
 'SKU-X','Negative Price',-1,true,5,NULL)
$q$) AS qa_invalid_price_denied;
SELECT b7s2.qa_expect_error('22023',$q$
 SELECT b7s2.save_product_store_v2(
 '10000000-0000-0000-0000-000000000001',
 '20000000-0000-0000-0000-000000000001',
 'SKU-X','Stock Negative',159000,true,-1,NULL)
$q$) AS qa_invalid_stock_denied;
SELECT b7s2.qa_expect_error('23505',$q$
 SELECT b7s2.save_product_store_v2(
 '10000000-0000-0000-0000-000000000001',
 '20000000-0000-0000-0000-000000000001',
 'SKU-A','Dup A',159000,true,5,NULL)
$q$) AS qa_duplicate_sku_denied;

-- Test 5: update requires optimistic token and cannot change inventory.
SELECT b7s2.qa_expect_error('22023', format($q$
 SELECT b7s2.save_product_store_v2(
 '10000000-0000-0000-0000-000000000001',
 '20000000-0000-0000-0000-000000000001',
 'SKU-A','QA A',159000,true,99,%L::timestamptz)
$q$,current_setting('b7s2.qa.a_etag'))) AS qa_edit_stock_direct_denied;
SELECT set_config('b7s2.qa.a_etag_new',b7s2.save_product_store_v2(
 '10000000-0000-0000-0000-000000000001',
 '20000000-0000-0000-0000-000000000001',
 'SKU-A','QA A Updated',169000,true,NULL,
 current_setting('b7s2.qa.a_etag')::timestamptz)::text,false)
 AS qa_owner_A_update;
SELECT b7s2.qa_expect_error('PT409',format($q$
 SELECT b7s2.save_product_store_v2(
 '10000000-0000-0000-0000-000000000001',
 '20000000-0000-0000-0000-000000000001',
 'SKU-A','STALE',199000,true,NULL,%L::timestamptz)
$q$,current_setting('b7s2.qa.a_etag'))) AS qa_stale_update_denied;
RESET ROLE;

-- Test 6: Store B Owner creates B and sees Tenant-wide SKU constraint D-02.
SET ROLE b7s2_client;
SET request.jwt.claim.sub='30000000-0000-0000-0000-000000000002';
SELECT b7s2.qa_expect_error('23505',$q$
 SELECT b7s2.save_product_store_v2(
 '10000000-0000-0000-0000-000000000001',
 '20000000-0000-0000-0000-000000000002',
 'SKU-A','Same SKU Different Store',159000,true,5,NULL)
$q$) AS qa_legacy_tenant_sku_uniqueness;
SELECT b7s2.save_product_store_v2(
 '10000000-0000-0000-0000-000000000001',
 '20000000-0000-0000-0000-000000000002',
 'SKU-B','QA B',159000,true,7,NULL) AS qa_owner_B_create;
RESET ROLE;

-- Test 7: Manager A can edit; Staff is denied; missing Store membership denied.
SET ROLE b7s2_client;
SET request.jwt.claim.sub='30000000-0000-0000-0000-000000000003';
SELECT b7s2.save_product_store_v2(
 '10000000-0000-0000-0000-000000000001',
 '20000000-0000-0000-0000-000000000001',
 'SKU-A','Manager Edit',179000,true,NULL,
 current_setting('b7s2.qa.a_etag_new')::timestamptz) AS qa_manager_A_edit;
SET request.jwt.claim.sub='30000000-0000-0000-0000-000000000004';
SELECT b7s2.qa_expect_error('42501',$q$
 SELECT b7s2.save_product_store_v2(
 '10000000-0000-0000-0000-000000000001',
 '20000000-0000-0000-0000-000000000001',
 'SKU-STAFF','Unauthorized Staff Write',1,true,1,NULL)
$q$) AS qa_staff_denied;
SET request.jwt.claim.sub='30000000-0000-0000-0000-000000000005';
SELECT b7s2.qa_expect_error('42501',$q$
 SELECT b7s2.save_product_store_v2(
 '10000000-0000-0000-0000-000000000001',
 '20000000-0000-0000-0000-000000000001',
 'SKU-REVOKED','Revoked',1,true,1,NULL)
$q$) AS qa_revoked_denied;
SET request.jwt.claim.sub='30000000-0000-0000-0000-000000000006';
SELECT b7s2.qa_expect_error('42501',$q$
 SELECT b7s2.save_product_store_v2(
 '10000000-0000-0000-0000-000000000001',
 '20000000-0000-0000-0000-000000000001',
 'SKU-EXPIRED','Expired',1,true,1,NULL)
$q$) AS qa_expired_denied;
SET request.jwt.claim.sub='30000000-0000-0000-0000-000000000007';
SELECT b7s2.qa_expect_error('42501',$q$
 SELECT b7s2.save_product_store_v2(
 '10000000-0000-0000-0000-000000000001',
 '20000000-0000-0000-0000-000000000001',
 'SKU-NOSTORE','Tenant Owner No Store',1,true,1,NULL)
$q$) AS qa_tenant_owner_without_store_denied;
RESET ROLE;

-- Test 8: verify unchanged stock, exact prices, row counts, tenant scope and audit.
SELECT 1/(CASE WHEN
 (SELECT count(*) FROM b7s2.products)=2
 AND (SELECT price_vnd FROM b7s2.products WHERE sku='SKU-A')=179000
 AND (SELECT stock_on_hand FROM b7s2.products WHERE sku='SKU-A')=5
 AND (SELECT stock_on_hand FROM b7s2.products WHERE sku='SKU-B')=7
 AND (SELECT count(*) FROM b7s2.audit_log)=4
 AND (SELECT count(*) FROM b7s2.audit_log WHERE action='CREATE')=2
 AND (SELECT count(*) FROM b7s2.audit_log WHERE action='UPDATE')=2
 AND (SELECT count(*) FROM b7s2.products WHERE store_id='20000000-0000-0000-0000-000000000001')=1
 AND (SELECT count(*) FROM b7s2.products WHERE store_id='20000000-0000-0000-0000-000000000002')=1
 THEN 1 ELSE 0 END) AS qa_final_atomic_scope_and_audit;
SELECT 'V19_B7_S2_VERSIONED_STORE_WRITER_PG17_OFFLINE_PASS' AS checkpoint;
