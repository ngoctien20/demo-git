\set ON_ERROR_STOP on
-- TIEN404 V17.25R — disposable PostgreSQL 17 only.
-- Runs AFTER the unmodified P0D fixture and V17.25N OR/AND extension.
-- All identities and records are synthetic. Never apply to Supabase.
DO $guard$
DECLARE n integer;
BEGIN
 IF current_database()<>'t404_v180_p0d_ci'
    OR current_user<>'postgres'
    OR current_setting('server_version_num')::integer<170000
    OR to_regclass('shop_qa.orders') IS NULL
    OR to_regclass('shop_qa.products') IS NULL
    OR to_regclass('shop_qa.store_memberships') IS NULL
    OR to_regclass('shop_qa.stores') IS NULL
    OR to_regprocedure('shop_qa.assert_count(text,bigint,text)') IS NULL
 THEN RAISE EXCEPTION 'V1725R_DISPOSABLE_PG17_ONLY' USING ERRCODE='42501'; END IF;
 SELECT count(*) INTO n FROM pg_policies
 WHERE schemaname='shop_qa' AND tablename='orders'
   AND policyname='qa_restrict_store_membership' AND permissive='RESTRICTIVE';
 IF n<>1 THEN RAISE EXCEPTION 'V1725R_REQUIRES_P0D_PLUS_V1725N_FIXTURE' USING ERRCODE='42501'; END IF;
 IF to_regclass('shop_qa.tenant_memberships') IS NOT NULL
 THEN RAISE EXCEPTION 'V1725R_FIXTURE_COLLISION' USING ERRCODE='42501'; END IF;
 RAISE NOTICE 'PASS_V1725R_DISPOSABLE_PG17_AND_P0D_N_LINEAGE_GUARD';
END $guard$;

BEGIN;

-- 1. Extend the disposable fixture only: tenant role intersection + Store lifecycle.
CREATE TABLE shop_qa.tenant_memberships (
 tenant_id uuid NOT NULL,
 user_id uuid NOT NULL,
 role text NOT NULL CHECK (role IN ('owner','manager','staff')),
 active boolean NOT NULL DEFAULT true,
 PRIMARY KEY (tenant_id,user_id)
);
ALTER TABLE shop_qa.tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_qa.tenant_memberships FORCE ROW LEVEL SECURITY;
GRANT SELECT ON shop_qa.tenant_memberships TO authenticated;
CREATE POLICY tenant_membership_own_read ON shop_qa.tenant_memberships
 FOR SELECT TO authenticated
 USING (user_id=(SELECT auth.uid()) AND active);

ALTER TABLE shop_qa.stores
 ADD COLUMN status text NOT NULL DEFAULT 'active'
 CHECK (status IN ('active','paused','archived'));

ALTER TABLE shop_qa.orders ADD COLUMN created_by uuid;
UPDATE shop_qa.orders
 SET created_by = CASE
  WHEN store_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' THEN '10000000-0000-4000-8000-000000000001'::uuid
  WHEN store_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' THEN '10000000-0000-4000-8000-000000000002'::uuid
  ELSE '10000000-0000-4000-8000-000000000006'::uuid
 END;
ALTER TABLE shop_qa.orders ALTER COLUMN created_by SET NOT NULL;

INSERT INTO shop_qa.tenant_memberships(tenant_id,user_id,role,active) VALUES
 ('11111111-1111-4111-8111-111111111111','10000000-0000-4000-8000-000000000001','owner',true),
 ('11111111-1111-4111-8111-111111111111','10000000-0000-4000-8000-000000000002','owner',true),
 ('11111111-1111-4111-8111-111111111111','10000000-0000-4000-8000-000000000003','owner',true),
 ('11111111-1111-4111-8111-111111111111','10000000-0000-4000-8000-000000000004','staff',true),
 ('22222222-2222-4222-8222-222222222222','10000000-0000-4000-8000-000000000006','owner',true),
 ('11111111-1111-4111-8111-111111111111','10000000-0000-4000-8000-000000000007','staff',true),
 ('11111111-1111-4111-8111-111111111111','10000000-0000-4000-8000-000000000008','owner',true),
 ('11111111-1111-4111-8111-111111111111','10000000-0000-4000-8000-000000000009','owner',false),
 ('11111111-1111-4111-8111-111111111111','10000000-0000-4000-8000-000000000010','owner',true),
 ('11111111-1111-4111-8111-111111111111','10000000-0000-4000-8000-000000000011','owner',true);

INSERT INTO shop_qa.store_memberships(tenant_id,store_id,user_id,role,active) VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','10000000-0000-4000-8000-000000000007','owner',true),
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','10000000-0000-4000-8000-000000000008','staff',true),
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','10000000-0000-4000-8000-000000000009','owner',true),
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','10000000-0000-4000-8000-000000000010','owner',false);

-- Paused/archived Store fixtures are added only after the V17.25N baseline replay.

-- 2. Least-privilege role intersection. SECURITY INVOKER: no RLS bypass.
CREATE FUNCTION shop_qa.can_access_effective(
 p_tenant uuid,p_store uuid,p_roles text[],p_write boolean DEFAULT false
) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $body$
 SELECT EXISTS (
  SELECT 1
  FROM shop_qa.tenant_memberships tm
  JOIN shop_qa.store_memberships sm
    ON sm.tenant_id=tm.tenant_id AND sm.user_id=tm.user_id
  JOIN shop_qa.stores st
    ON st.tenant_id=sm.tenant_id AND st.store_id=sm.store_id
  WHERE tm.tenant_id=p_tenant AND sm.store_id=p_store
    AND tm.user_id=(SELECT auth.uid())
    AND tm.active AND sm.active AND st.is_active
    AND st.status<>'archived'
    AND (NOT p_write OR st.status='active')
    AND (
      CASE
       WHEN CASE tm.role WHEN 'staff' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END
          <= CASE sm.role WHEN 'staff' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END
       THEN tm.role ELSE sm.role
      END
    ) = ANY(p_roles)
 )
$body$;
REVOKE ALL ON FUNCTION shop_qa.can_access_effective(uuid,uuid,text[],boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION shop_qa.can_access_effective(uuid,uuid,text[],boolean) TO authenticated;

-- 3. Verify V17.25N state before changing it.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.orders',1,'R_N_RESTRICTIVE_OWNER_A_ONE');
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.orders',1,'R_N_RESTRICTIVE_OWNER_B_ONE');
RESET ROLE;

INSERT INTO shop_qa.stores(tenant_id,store_id,is_active,authority_version,status) VALUES
 ('11111111-1111-4111-8111-111111111111','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true,1,'paused'),
 ('11111111-1111-4111-8111-111111111111','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',true,1,'archived');

INSERT INTO shop_qa.store_memberships(tenant_id,store_id,user_id,role,active) VALUES
 ('11111111-1111-4111-8111-111111111111','dddddddd-dddd-4ddd-8ddd-dddddddddddd','10000000-0000-4000-8000-000000000001','owner',true),
 ('11111111-1111-4111-8111-111111111111','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','10000000-0000-4000-8000-000000000001','owner',true);

INSERT INTO shop_qa.products(id,tenant_id,store_id,sku,name,price_vnd,stock_on_hand)
 VALUES
 ('20000000-0000-4000-8000-000000000010','11111111-1111-4111-8111-111111111111','dddddddd-dddd-4ddd-8ddd-dddddddddddd','QA-SKU-PAUSED','Paused fixture',100000,2),
 ('20000000-0000-4000-8000-000000000011','11111111-1111-4111-8111-111111111111','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','QA-SKU-ARCHIVED','Archived fixture',100000,2);
INSERT INTO shop_qa.customers(id,tenant_id,store_id,alias) VALUES
 ('30000000-0000-4000-8000-000000000010','11111111-1111-4111-8111-111111111111','dddddddd-dddd-4ddd-8ddd-dddddddddddd','QA-PAUSED'),
 ('30000000-0000-4000-8000-000000000011','11111111-1111-4111-8111-111111111111','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','QA-ARCHIVED');
INSERT INTO shop_qa.orders(id,tenant_id,store_id,customer_id,status,total_vnd,created_by) VALUES
 ('40000000-0000-4000-8000-000000000020','11111111-1111-4111-8111-111111111111','dddddddd-dddd-4ddd-8ddd-dddddddddddd','30000000-0000-4000-8000-000000000010','pending',100000,'10000000-0000-4000-8000-000000000001'),
 ('40000000-0000-4000-8000-000000000021','11111111-1111-4111-8111-111111111111','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','30000000-0000-4000-8000-000000000011','pending',100000,'10000000-0000-4000-8000-000000000001');

-- 4. Orders RLS truth table: default deny -> legacy -> permissive OR leak -> restrictive AND -> replacement.
DROP POLICY orders_read ON shop_qa.orders;
DROP POLICY qa_restrict_store_membership ON shop_qa.orders;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.orders',0,'R_ORDERS_NO_POLICY_DEFAULT_DENY');
RESET ROLE;

CREATE POLICY orders_legacy_tenant_read ON shop_qa.orders
 AS PERMISSIVE FOR SELECT TO authenticated
 USING (EXISTS (
  SELECT 1 FROM shop_qa.tenant_memberships tm
  WHERE tm.tenant_id=orders.tenant_id AND tm.user_id=(SELECT auth.uid())
    AND tm.active AND tm.role IN ('owner','manager')
 ));

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
SELECT shop_qa.assert_count(
 'SELECT count(*) FROM shop_qa.orders WHERE tenant_id=''11111111-1111-4111-8111-111111111111''',
 4,'R_ORDERS_LEGACY_TENANT_POLICY_SEES_ALL_FOUR');
RESET ROLE;

CREATE POLICY orders_store_read_candidate ON shop_qa.orders
 AS PERMISSIVE FOR SELECT TO authenticated
 USING (shop_qa.can_access_effective(tenant_id,store_id,ARRAY['owner','manager'],false));

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
SELECT shop_qa.assert_count(
 'SELECT count(*) FROM shop_qa.orders WHERE tenant_id=''11111111-1111-4111-8111-111111111111''',
 4,'R_ORDERS_TWO_PERMISSIVE_OR_STILL_LEAKS');
RESET ROLE;

CREATE POLICY orders_store_fence ON shop_qa.orders
 AS RESTRICTIVE FOR SELECT TO authenticated
 USING (shop_qa.can_access_effective(tenant_id,store_id,ARRAY['owner','manager'],false));

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
SELECT shop_qa.assert_count(
 'SELECT count(*) FROM shop_qa.orders WHERE tenant_id=''11111111-1111-4111-8111-111111111111''',
 2,'R_ORDERS_RESTRICTIVE_AND_FENCES_LEGACY');
RESET ROLE;

DROP POLICY orders_legacy_tenant_read ON shop_qa.orders;
DROP POLICY orders_store_fence ON shop_qa.orders;
ALTER POLICY orders_store_read_candidate ON shop_qa.orders RENAME TO orders_read_v2;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
SELECT shop_qa.assert_count(
 'SELECT count(*) FROM shop_qa.orders WHERE tenant_id=''11111111-1111-4111-8111-111111111111''',
 2,'R_ORDERS_REPLACED_OWNER_A_SEES_A_AND_PAUSED');
SELECT shop_qa.assert_count(
 'SELECT count(*) FROM shop_qa.orders WHERE store_id=''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb''',
 0,'R_ORDERS_REPLACED_OWNER_A_DENY_B');
RESET ROLE;

-- 5. Products receive the same policy replacement; old Tenant-only policy must not survive.
DROP POLICY product_read ON shop_qa.products;
CREATE POLICY products_legacy_tenant_read ON shop_qa.products
 AS PERMISSIVE FOR SELECT TO authenticated
 USING (EXISTS (
  SELECT 1 FROM shop_qa.tenant_memberships tm
  WHERE tm.tenant_id=products.tenant_id AND tm.user_id=(SELECT auth.uid())
    AND tm.active
 ));
CREATE POLICY products_store_read_candidate ON shop_qa.products
 AS PERMISSIVE FOR SELECT TO authenticated
 USING (shop_qa.can_access_effective(
  tenant_id,store_id,ARRAY['owner','manager','staff'],false));

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
SELECT shop_qa.assert_count(
 'SELECT count(*) FROM shop_qa.products WHERE tenant_id=''11111111-1111-4111-8111-111111111111''',
 4,'R_PRODUCTS_TWO_PERMISSIVE_OR_STILL_LEAKS');
RESET ROLE;

CREATE POLICY products_store_fence ON shop_qa.products
 AS RESTRICTIVE FOR SELECT TO authenticated
 USING (shop_qa.can_access_effective(
  tenant_id,store_id,ARRAY['owner','manager','staff'],false));

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
SELECT shop_qa.assert_count(
 'SELECT count(*) FROM shop_qa.products WHERE tenant_id=''11111111-1111-4111-8111-111111111111''',
 2,'R_PRODUCTS_RESTRICTIVE_AND_FENCES_LEGACY');
RESET ROLE;

DROP POLICY products_legacy_tenant_read ON shop_qa.products;
DROP POLICY products_store_fence ON shop_qa.products;
ALTER POLICY products_store_read_candidate ON shop_qa.products RENAME TO product_read_v2;

-- 6. Replace every remaining P0D policy with the effective Tenant × Store authority.
DROP POLICY store_active_member_read ON shop_qa.stores;
DROP POLICY membership_own_read ON shop_qa.store_memberships;
DROP POLICY product_insert ON shop_qa.products;
DROP POLICY product_update ON shop_qa.products;
DROP POLICY customer_read ON shop_qa.customers;
DROP POLICY order_items_read ON shop_qa.order_items;
DROP POLICY conversations_read ON shop_qa.conversations;
DROP POLICY messages_read ON shop_qa.messages;
DROP POLICY install_read ON shop_qa.channel_installations;

CREATE POLICY stores_read_v2 ON shop_qa.stores
 FOR SELECT TO authenticated USING (
  is_active AND status<>'archived'
  AND EXISTS (
   SELECT 1 FROM shop_qa.tenant_memberships tm
   JOIN shop_qa.store_memberships sm
    ON sm.tenant_id=tm.tenant_id AND sm.user_id=tm.user_id
   WHERE tm.tenant_id=stores.tenant_id AND sm.store_id=stores.store_id
     AND tm.user_id=(SELECT auth.uid()) AND tm.active AND sm.active
  )
);
CREATE POLICY store_membership_read_v2 ON shop_qa.store_memberships
 FOR SELECT TO authenticated USING (
  user_id=(SELECT auth.uid()) AND active
  AND EXISTS (
   SELECT 1 FROM shop_qa.tenant_memberships tm
   WHERE tm.tenant_id=store_memberships.tenant_id
     AND tm.user_id=(SELECT auth.uid()) AND tm.active
  )
);

CREATE POLICY product_insert_v2 ON shop_qa.products
 FOR INSERT TO authenticated WITH CHECK (
  shop_qa.can_access_effective(tenant_id,store_id,ARRAY['owner','manager'],true)
 );
CREATE POLICY product_update_v2 ON shop_qa.products
 FOR UPDATE TO authenticated
 USING (shop_qa.can_access_effective(tenant_id,store_id,ARRAY['owner','manager'],true))
 WITH CHECK (shop_qa.can_access_effective(tenant_id,store_id,ARRAY['owner','manager'],true));

CREATE POLICY customer_read_v2 ON shop_qa.customers
 FOR SELECT TO authenticated
 USING (shop_qa.can_access_effective(tenant_id,store_id,ARRAY['owner','manager'],false));
CREATE POLICY order_items_read_v2 ON shop_qa.order_items
 FOR SELECT TO authenticated
 USING (shop_qa.can_access_effective(tenant_id,store_id,ARRAY['owner','manager'],false));
CREATE POLICY conversations_read_v2 ON shop_qa.conversations
 FOR SELECT TO authenticated
 USING (shop_qa.can_access_effective(tenant_id,store_id,ARRAY['owner','manager'],false));
CREATE POLICY messages_read_v2 ON shop_qa.messages
 FOR SELECT TO authenticated
 USING (shop_qa.can_access_effective(tenant_id,store_id,ARRAY['owner','manager'],false));
CREATE POLICY install_read_v2 ON shop_qa.channel_installations
 FOR SELECT TO authenticated
 USING (shop_qa.can_access_effective(tenant_id,store_id,ARRAY['owner','manager'],false));

-- Orders write policies are tested with a temporary test-only grant. The grant is revoked below.
CREATE POLICY orders_insert_v2 ON shop_qa.orders
 FOR INSERT TO authenticated WITH CHECK (
  created_by=(SELECT auth.uid())
  AND shop_qa.can_access_effective(
   tenant_id,store_id,ARRAY['owner','manager','staff'],true)
 );
CREATE POLICY orders_update_v2 ON shop_qa.orders
 FOR UPDATE TO authenticated
 USING (shop_qa.can_access_effective(tenant_id,store_id,ARRAY['owner','manager'],true))
 WITH CHECK (shop_qa.can_access_effective(tenant_id,store_id,ARRAY['owner','manager'],true));

-- Test-only DML grants deliberately expose policy behavior, then are revoked.
GRANT INSERT,UPDATE,DELETE ON shop_qa.orders TO authenticated;

-- 7. Role intersection and resource visibility.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.stores',2,'R_OWNER_A_SEES_ACTIVE_AND_PAUSED_STORES');
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.products',2,'R_OWNER_A_PRODUCTS_A_AND_PAUSED');
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.orders',2,'R_OWNER_A_ORDERS_A_AND_PAUSED');
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.customers',2,'R_OWNER_A_CUSTOMERS_A_AND_PAUSED');
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.conversations',1,'R_OWNER_A_CONVERSATION_A');
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.messages',1,'R_OWNER_A_MESSAGES_A');
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.channel_installations',1,'R_OWNER_A_INSTALLATION_A');
SELECT shop_qa.assert_count(
 'SELECT count(*) FROM shop_qa.orders WHERE store_id=''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb''',
 0,'R_OWNER_A_CANNOT_READ_B');
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.products',1,'R_OWNER_B_PRODUCTS_B_ONLY');
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.orders',1,'R_OWNER_B_ORDERS_B_ONLY');
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.products',2,'R_DUAL_OWNER_CAN_READ_EXPLICIT_MEMBER_STORES');
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.orders',2,'R_DUAL_OWNER_CAN_READ_A_AND_B');
SELECT shop_qa.assert_count(
 'SELECT count(*) FROM shop_qa.store_memberships WHERE store_id=''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb''',
 1,'R_DUAL_OWNER_B_MEMBERSHIP_PRESENT');
SELECT shop_qa.assert_count(
 'SELECT count(*) FROM shop_qa.products WHERE store_id=''dddddddd-dddd-4ddd-8ddd-dddddddddddd''',
 0,'R_DUAL_OWNER_NO_IMPLICIT_PAUSED_STORE');
RESET ROLE;

-- Tenant Staff + Store Owner, and Tenant Owner + Store Staff, both resolve to Staff.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000007',false);
SELECT shop_qa.assert_count(
 'SELECT count(*) FROM shop_qa.products WHERE store_id=''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa''',
 1,'R_TENANT_STAFF_STORE_OWNER_EFFECTIVE_STAFF');
SELECT shop_qa.assert_count(
 'SELECT count(*) FROM shop_qa.orders WHERE store_id=''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa''',
 0,'R_TENANT_STAFF_STORE_OWNER_CANNOT_READ_ORDERS');
SELECT shop_qa.assert_count(
 'SELECT CASE WHEN shop_qa.can_access_effective(''11111111-1111-4111-8111-111111111111'',''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'',ARRAY[''manager''],false) THEN 1 ELSE 0 END',
 0,'R_TENANT_STAFF_STORE_OWNER_NOT_MANAGER');
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000008',false);
SELECT shop_qa.assert_count(
 'SELECT count(*) FROM shop_qa.products WHERE store_id=''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa''',
 1,'R_TENANT_OWNER_STORE_STAFF_EFFECTIVE_STAFF');
SELECT shop_qa.assert_count(
 'SELECT count(*) FROM shop_qa.orders WHERE store_id=''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa''',
 0,'R_TENANT_OWNER_STORE_STAFF_CANNOT_READ_ORDERS');
RESET ROLE;

-- Inactive tenant, inactive Store membership, tenant-only owner and unrelated actor fail closed.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000009',false);
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.products',0,'R_INACTIVE_TENANT_MEMBERSHIP_DENIED');
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000010',false);
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.products',0,'R_INACTIVE_STORE_MEMBERSHIP_DENIED');
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000011',false);
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.products',0,'R_TENANT_ONLY_OWNER_NO_STORE_DENIED');
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',false);
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.products',0,'R_UNRELATED_ACTOR_DENIED');
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000006',false);
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.products',1,'R_CROSS_TENANT_OWNER_SEES_C_ONLY');
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.orders',1,'R_CROSS_TENANT_OWNER_ORDERS_C_ONLY');
RESET ROLE;

-- Paused Store is read-only; archived Store is invisible to normal Store APIs.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
SELECT shop_qa.assert_count(
 'SELECT count(*) FROM shop_qa.products WHERE store_id=''dddddddd-dddd-4ddd-8ddd-dddddddddddd''',
 1,'R_PAUSED_STORE_READ_ALLOWED');
SELECT shop_qa.assert_count(
 'SELECT count(*) FROM shop_qa.products WHERE store_id=''eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee''',
 0,'R_ARCHIVED_STORE_READ_DENIED');
SELECT shop_qa.assert_sqlstate(
 'INSERT INTO shop_qa.orders(id,tenant_id,store_id,customer_id,status,total_vnd,created_by) VALUES(''40000000-0000-4000-8000-000000000030'',''11111111-1111-4111-8111-111111111111'',''dddddddd-dddd-4ddd-8ddd-dddddddddddd'',''30000000-0000-4000-8000-000000000010'',''pending'',100000,''10000000-0000-4000-8000-000000000001'')',
 '42501','R_PAUSED_STORE_ORDER_CREATE_DENIED');
SELECT shop_qa.assert_rows(
 'UPDATE shop_qa.orders SET status=''confirmed'' WHERE id=''40000000-0000-4000-8000-000000000020''',
 0,'R_PAUSED_STORE_ORDER_UPDATE_DENIED');
RESET ROLE;

-- 8. Orders CRUD matrix with temporary test-only grants.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
SELECT shop_qa.assert_sqlstate(
 'INSERT INTO shop_qa.orders(id,tenant_id,store_id,customer_id,status,total_vnd,created_by) VALUES(''40000000-0000-4000-8000-000000000030'',''11111111-1111-4111-8111-111111111111'',''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'',''30000000-0000-4000-8000-000000000001'',''pending'',159000,''10000000-0000-4000-8000-000000000001'')',
 '00000','R_OWNER_A_INSERT_OWN_ORDER_ALLOWED');
SELECT shop_qa.assert_sqlstate(
 'INSERT INTO shop_qa.orders(id,tenant_id,store_id,customer_id,status,total_vnd,created_by) VALUES(''40000000-0000-4000-8000-000000000031'',''11111111-1111-4111-8111-111111111111'',''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'',''30000000-0000-4000-8000-000000000002'',''pending'',259000,''10000000-0000-4000-8000-000000000001'')',
 '42501','R_OWNER_A_CANNOT_INSERT_B');
SELECT shop_qa.assert_sqlstate(
 'INSERT INTO shop_qa.orders(id,tenant_id,store_id,customer_id,status,total_vnd,created_by) VALUES(''40000000-0000-4000-8000-000000000032'',''11111111-1111-4111-8111-111111111111'',''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'',''30000000-0000-4000-8000-000000000001'',''pending'',159000,''10000000-0000-4000-8000-000000000002'')',
 '42501','R_OWNER_A_CANNOT_SPOOF_ORDER_CREATOR');
SELECT shop_qa.assert_rows(
 'UPDATE shop_qa.orders SET status=''confirmed'' WHERE id=''40000000-0000-4000-8000-000000000001''',
 1,'R_OWNER_A_UPDATE_OWN_ORDER_ALLOWED');
SELECT shop_qa.assert_rows(
 'UPDATE shop_qa.orders SET status=''cancelled'' WHERE id=''40000000-0000-4000-8000-000000000002''',
 0,'R_OWNER_A_UPDATE_B_DENIED');
SELECT shop_qa.assert_sqlstate(
 'UPDATE shop_qa.orders SET store_id=''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'',customer_id=''30000000-0000-4000-8000-000000000002'' WHERE id=''40000000-0000-4000-8000-000000000030''',
 '42501','R_OWNER_A_WITH_CHECK_BLOCKS_SCOPE_TRANSFER');
SELECT shop_qa.assert_rows(
 'DELETE FROM shop_qa.orders WHERE id=''40000000-0000-4000-8000-000000000001''',
 0,'R_OWNER_A_DELETE_DEFAULT_DENY');
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',false);
SELECT shop_qa.assert_sqlstate(
 'INSERT INTO shop_qa.orders(id,tenant_id,store_id,customer_id,status,total_vnd,created_by) VALUES(''40000000-0000-4000-8000-000000000033'',''11111111-1111-4111-8111-111111111111'',''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'',''30000000-0000-4000-8000-000000000001'',''pending'',159000,''10000000-0000-4000-8000-000000000004'')',
 '00000','R_STAFF_CAN_CREATE_OWN_ORDER');
SELECT shop_qa.assert_count(
 'SELECT count(*) FROM shop_qa.orders WHERE id=''40000000-0000-4000-8000-000000000033''',
 0,'R_STAFF_CANNOT_READ_ALL_ORDERS');
SELECT shop_qa.assert_rows(
 'UPDATE shop_qa.orders SET status=''confirmed'' WHERE id=''40000000-0000-4000-8000-000000000001''',
 0,'R_STAFF_CANNOT_UPDATE_ORDER');
SELECT shop_qa.assert_rows(
 'DELETE FROM shop_qa.orders WHERE id=''40000000-0000-4000-8000-000000000033''',
 0,'R_STAFF_CANNOT_DELETE_ORDER');
RESET ROLE;

CREATE FUNCTION shop_qa.immutable_order_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $body$
BEGIN
 IF (NEW.tenant_id,NEW.store_id,NEW.created_by)
    IS DISTINCT FROM (OLD.tenant_id,OLD.store_id,OLD.created_by)
 THEN RAISE insufficient_privilege; END IF;
 RETURN NEW;
END
$body$;
CREATE TRIGGER orders_no_scope_or_creator_move
 BEFORE UPDATE ON shop_qa.orders
 FOR EACH ROW EXECUTE FUNCTION shop_qa.immutable_order_scope();

-- Dual Store membership permits both rows, but immutable scope prevents reassignment.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
SELECT shop_qa.assert_rows(
 'UPDATE shop_qa.orders SET status=''confirmed'' WHERE id=''40000000-0000-4000-8000-000000000002''',
 1,'R_DUAL_OWNER_EFFECTIVE_MANAGER_CAN_UPDATE_B');
SELECT shop_qa.assert_sqlstate(
 'UPDATE shop_qa.orders SET store_id=''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'',customer_id=''30000000-0000-4000-8000-000000000002'' WHERE id=''40000000-0000-4000-8000-000000000030''',
 '42501','R_DUAL_OWNER_TRIGGER_BLOCKS_ORDER_TRANSFER');
SELECT shop_qa.assert_sqlstate(
 'UPDATE shop_qa.products SET store_id=''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'' WHERE id=''20000000-0000-4000-8000-000000000001''',
 '42501','R_DUAL_OWNER_TRIGGER_BLOCKS_PRODUCT_TRANSFER');
RESET ROLE;

-- 9. Product write policy uses effective role and Store status.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',false);
SELECT shop_qa.assert_sqlstate(
 'INSERT INTO shop_qa.products(id,tenant_id,store_id,sku,name,price_vnd,stock_on_hand) VALUES(''20000000-0000-4000-8000-000000000030'',''11111111-1111-4111-8111-111111111111'',''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'',''QA-STAFF-PRODUCT'',''staff product'',100,1)',
 '42501','R_STAFF_PRODUCT_INSERT_DENIED');
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
SELECT shop_qa.assert_sqlstate(
 'INSERT INTO shop_qa.products(id,tenant_id,store_id,sku,name,price_vnd,stock_on_hand) VALUES(''20000000-0000-4000-8000-000000000031'',''11111111-1111-4111-8111-111111111111'',''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'',''QA-OWNER-PRODUCT'',''owner product'',100,1)',
 '00000','R_OWNER_PRODUCT_INSERT_ALLOWED');
SELECT shop_qa.assert_rows(
 'UPDATE shop_qa.products SET price_vnd=165000 WHERE id=''20000000-0000-4000-8000-000000000001''',
 1,'R_OWNER_PRODUCT_UPDATE_ALLOWED');
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000007',false);
SELECT shop_qa.assert_sqlstate(
 'INSERT INTO shop_qa.orders(id,tenant_id,store_id,customer_id,status,total_vnd,created_by) VALUES(''40000000-0000-4000-8000-000000000034'',''11111111-1111-4111-8111-111111111111'',''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'',''30000000-0000-4000-8000-000000000001'',''pending'',159000,''10000000-0000-4000-8000-000000000007'')',
 '00000','R_TENANT_STAFF_STORE_OWNER_INSERT_IS_STAFF');
SELECT shop_qa.assert_rows(
 'UPDATE shop_qa.orders SET status=''confirmed'' WHERE id=''40000000-0000-4000-8000-000000000001''',
 0,'R_TENANT_STAFF_STORE_OWNER_UPDATE_DENIED');
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000008',false);
SELECT shop_qa.assert_sqlstate(
 'INSERT INTO shop_qa.orders(id,tenant_id,store_id,customer_id,status,total_vnd,created_by) VALUES(''40000000-0000-4000-8000-000000000035'',''11111111-1111-4111-8111-111111111111'',''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'',''30000000-0000-4000-8000-000000000001'',''pending'',159000,''10000000-0000-4000-8000-000000000008'')',
 '00000','R_TENANT_OWNER_STORE_STAFF_INSERT_IS_STAFF');
RESET ROLE;

-- 10. Composite FK integrity, independently from RLS, using synthetic postgres fixture owner.
SELECT shop_qa.assert_sqlstate(
 'INSERT INTO shop_qa.order_items(id,tenant_id,store_id,order_id,product_id,quantity,unit_price_vnd,line_total_vnd) VALUES(''50000000-0000-4000-8000-000000000030'',''11111111-1111-4111-8111-111111111111'',''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'',''40000000-0000-4000-8000-000000000001'',''20000000-0000-4000-8000-000000000002'',1,259000,259000)',
 '23503','R_FK_ORDER_ITEM_CANNOT_USE_PRODUCT_FROM_STORE_B');
SELECT shop_qa.assert_sqlstate(
 'INSERT INTO shop_qa.order_items(id,tenant_id,store_id,order_id,product_id,quantity,unit_price_vnd,line_total_vnd) VALUES(''50000000-0000-4000-8000-000000000031'',''11111111-1111-4111-8111-111111111111'',''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'',''40000000-0000-4000-8000-000000000002'',''20000000-0000-4000-8000-000000000001'',1,159000,159000)',
 '23503','R_FK_ORDER_ITEM_CANNOT_USE_ORDER_FROM_STORE_B');
SELECT shop_qa.assert_sqlstate(
 'INSERT INTO shop_qa.orders(id,tenant_id,store_id,customer_id,status,total_vnd,created_by) VALUES(''40000000-0000-4000-8000-000000000040'',''11111111-1111-4111-8111-111111111111'',''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'',''30000000-0000-4000-8000-000000000002'',''pending'',259000,''10000000-0000-4000-8000-000000000001'')',
 '23503','R_FK_ORDER_CANNOT_USE_CUSTOMER_FROM_STORE_B');
SELECT shop_qa.assert_sqlstate(
 'INSERT INTO shop_qa.messages(id,tenant_id,store_id,conversation_id,body) VALUES(''70000000-0000-4000-8000-000000000030'',''11111111-1111-4111-8111-111111111111'',''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'',''60000000-0000-4000-8000-000000000002'',''cross store message'')',
 '23503','R_FK_MESSAGE_CANNOT_USE_CONVERSATION_FROM_STORE_B');
SELECT shop_qa.assert_sqlstate(
 'INSERT INTO shop_qa.store_memberships(tenant_id,store_id,user_id,role,active) VALUES(''22222222-2222-4222-8222-222222222222'',''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'',''20000000-0000-4000-8000-000000000099'',''staff'',true)',
 '23503','R_FK_STORE_MEMBERSHIP_TENANT_STORE_PAIR_REQUIRED');
SELECT shop_qa.assert_sqlstate(
 'INSERT INTO shop_qa.products(id,tenant_id,store_id,sku,name,price_vnd,stock_on_hand) VALUES(''20000000-0000-4000-8000-000000000040'',''11111111-1111-4111-8111-111111111111'',''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'',''QA-SKU-1'',''duplicate same store sku'',100,1)',
 '23505','R_UNIQUE_SKU_WITHIN_STORE');
SELECT shop_qa.assert_count(
 'SELECT count(*) FROM shop_qa.products WHERE tenant_id=''11111111-1111-4111-8111-111111111111'' AND sku=''QA-SKU-1''',
 2,'R_SAME_SKU_ALLOWED_ACROSS_DIFFERENT_STORES');

-- 11. Revocation is immediate in the DB policy model.
UPDATE shop_qa.store_memberships SET active=false
 WHERE user_id='10000000-0000-4000-8000-000000000002'
   AND store_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
SELECT shop_qa.assert_count('SELECT count(*) FROM shop_qa.orders',0,'R_REVOKED_STORE_MEMBERSHIP_IMMEDIATE_DENY');
RESET ROLE;

-- Revoke the temporary orders DML grant; direct browser order writes remain disabled.
REVOKE INSERT,UPDATE,DELETE ON shop_qa.orders FROM authenticated;

-- 12. Final policy, RLS and least-privilege grant inventory.
DO $final$
DECLARE n integer; old_count integer; permissive_count integer; restrictive_count integer;
BEGIN
 SELECT count(*) INTO n FROM pg_class c
 JOIN pg_namespace s ON s.oid=c.relnamespace
 WHERE s.nspname='shop_qa' AND c.relkind='r'
   AND c.relrowsecurity AND c.relforcerowsecurity;
 IF n<>10 THEN RAISE EXCEPTION 'R_FINAL_FORCE_RLS_EXPECTED_10_GOT_%',n; END IF;

 SELECT count(*) INTO old_count FROM pg_policies
 WHERE schemaname='shop_qa' AND policyname IN (
  'orders_legacy_tenant_read','orders_store_read_candidate','orders_store_fence',
  'products_legacy_tenant_read','products_store_read_candidate','products_store_fence',
  'orders_read','qa_restrict_store_membership','product_read','product_insert','product_update',
  'customer_read','order_items_read','conversations_read','messages_read','install_read',
  'store_active_member_read','membership_own_read'
 );
 IF old_count<>0 THEN RAISE EXCEPTION 'R_FINAL_LEGACY_POLICY_REMAINS_%',old_count; END IF;

 SELECT count(*) FILTER (WHERE permissive='PERMISSIVE'),
        count(*) FILTER (WHERE permissive='RESTRICTIVE')
 INTO permissive_count,restrictive_count
 FROM pg_policies WHERE schemaname='shop_qa' AND tablename='orders';
 IF permissive_count<>3 OR restrictive_count<>0 THEN
  RAISE EXCEPTION 'R_FINAL_ORDERS_POLICY_COUNT_PERMISSIVE_%_RESTRICTIVE_%',
    permissive_count,restrictive_count;
 END IF;

 IF has_table_privilege('anon','shop_qa.orders','SELECT')
    OR has_table_privilege('anon','shop_qa.products','SELECT')
 THEN RAISE EXCEPTION 'R_FINAL_ANON_GRANT_PRESENT'; END IF;

 IF has_table_privilege('authenticated','shop_qa.orders','INSERT')
    OR has_table_privilege('authenticated','shop_qa.orders','UPDATE')
    OR has_table_privilege('authenticated','shop_qa.orders','DELETE')
 THEN RAISE EXCEPTION 'R_FINAL_DIRECT_ORDER_DML_GRANT_PRESENT'; END IF;

 IF NOT has_table_privilege('authenticated','shop_qa.products','SELECT')
    OR NOT has_table_privilege('authenticated','shop_qa.products','INSERT')
    OR NOT has_table_privilege('authenticated','shop_qa.products','UPDATE')
    OR has_table_privilege('authenticated','shop_qa.products','DELETE')
 THEN RAISE EXCEPTION 'R_FINAL_PRODUCT_GRANT_MATRIX_DRIFT'; END IF;

 IF has_table_privilege('authenticated','shop_qa.stores','INSERT')
    OR has_table_privilege('authenticated','shop_qa.store_memberships','INSERT')
    OR has_table_privilege('authenticated','shop_qa.tenant_memberships','INSERT')
 THEN RAISE EXCEPTION 'R_FINAL_AUTHORITY_TABLE_WRITABLE_BY_CLIENT'; END IF;

 RAISE NOTICE 'PASS_V1725R_TEN_FORCE_RLS_TABLES';
 RAISE NOTICE 'PASS_V1725R_LEGACY_POLICIES_REMOVED';
 RAISE NOTICE 'PASS_V1725R_ORDERS_HAVE_ONE_POLICY_PER_ALLOWED_COMMAND_NO_DELETE';
 RAISE NOTICE 'PASS_V1725R_ANON_NO_GRANTS';
 RAISE NOTICE 'PASS_V1725R_ORDER_DML_GRANTS_REVOKED_AFTER_TEST';
 RAISE NOTICE 'PASS_V1725R_PRODUCT_GRANTS_LEAST_PRIVILEGE';
 RAISE NOTICE 'PASS_V1725R_TENANT_STORE_AUTHORITY_TABLES_READ_ONLY';
END
$final$;

-- All R-specific DDL/DML and test data are rolled back. P0D/N fixture remains disposable.
ROLLBACK;
\echo V1725R_DISPOSABLE_SCHEMA_AND_POLICY_TRUTH_TABLE_PASS_ROLLED_BACK
\echo V1725R_SYNTHETIC_AUTH_UID_ONLY_NO_REAL_JWT_NO_HOSTED_MIGRATION_NO_PROVIDER_SEND
