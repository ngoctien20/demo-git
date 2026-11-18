\set ON_ERROR_STOP on
-- V19.0-B7-S1: isolated PostgreSQL 17 GitHub Actions service only.
-- Synthetic fixtures. NO Supabase/Auth connections, production migrations,
-- actual owner sessions, real customer data, or existing writer changes.
CREATE SCHEMA b7s;
CREATE ROLE b7s_a NOLOGIN NOBYPASSRLS;
CREATE ROLE b7s_b NOLOGIN NOBYPASSRLS;
CREATE ROLE b7s_dual NOLOGIN NOBYPASSRLS;
CREATE ROLE b7s_tenant_owner NOLOGIN NOBYPASSRLS;
CREATE ROLE b7s_revoked NOLOGIN NOBYPASSRLS;
CREATE ROLE b7s_staff NOLOGIN NOBYPASSRLS;
CREATE ROLE b7s_outside NOLOGIN NOBYPASSRLS;

CREATE TABLE b7s.tenants(id text PRIMARY KEY);
CREATE TABLE b7s.stores(
 tenant_id text NOT NULL REFERENCES b7s.tenants(id) ON DELETE RESTRICT,
 id text NOT NULL,
 status text NOT NULL CHECK(status IN ('active','suspended')),
 PRIMARY KEY(tenant_id,id)
);
CREATE TABLE b7s.memberships(
 actor text NOT NULL,tenant_id text NOT NULL,store_id text NOT NULL,
 status text NOT NULL CHECK(status IN ('active','suspended','revoked')),
 expires_at timestamptz NOT NULL,
 PRIMARY KEY(actor,tenant_id,store_id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES b7s.stores(tenant_id,id)
);

-- Six simplified exact-key-structure fixtures, NOT copies of live data.
CREATE TABLE b7s.products(
 tenant_id text NOT NULL REFERENCES b7s.tenants(id),
 store_id text,id text NOT NULL,sku text NOT NULL,
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,store_id,id),
 UNIQUE(tenant_id,sku), -- preserve legacy Tenant-wide SKU rule until D-02 approved
 FOREIGN KEY(tenant_id,store_id) REFERENCES b7s.stores(tenant_id,id)
);
CREATE TABLE b7s.customers(
 tenant_id text NOT NULL REFERENCES b7s.tenants(id),
 store_id text,id text NOT NULL,
 PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,store_id,id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES b7s.stores(tenant_id,id)
);
CREATE TABLE b7s.orders(
 tenant_id text NOT NULL REFERENCES b7s.tenants(id),
 store_id text,id text NOT NULL,customer_id text,
 PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,store_id,id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES b7s.stores(tenant_id,id),
 FOREIGN KEY(tenant_id,store_id,customer_id)
  REFERENCES b7s.customers(tenant_id,store_id,id)
);
CREATE TABLE b7s.order_items(
 tenant_id text NOT NULL REFERENCES b7s.tenants(id),
 store_id text,id text NOT NULL,order_id text NOT NULL,product_id text NOT NULL,
 PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,store_id,id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES b7s.stores(tenant_id,id),
 FOREIGN KEY(tenant_id,store_id,order_id)
  REFERENCES b7s.orders(tenant_id,store_id,id),
 FOREIGN KEY(tenant_id,store_id,product_id)
  REFERENCES b7s.products(tenant_id,store_id,id)
);
CREATE TABLE b7s.conversations(
 tenant_id text NOT NULL REFERENCES b7s.tenants(id),
 store_id text,id text NOT NULL,
 PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,store_id,id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES b7s.stores(tenant_id,id)
);
CREATE TABLE b7s.messages(
 tenant_id text NOT NULL REFERENCES b7s.tenants(id),
 store_id text,id text NOT NULL,conversation_id text NOT NULL,
 PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,store_id,id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES b7s.stores(tenant_id,id),
 FOREIGN KEY(tenant_id,store_id,conversation_id)
  REFERENCES b7s.conversations(tenant_id,store_id,id)
);

INSERT INTO b7s.tenants VALUES ('qa-tenant-1'),('qa-tenant-2');
INSERT INTO b7s.stores VALUES
 ('qa-tenant-1','qa-store-a','active'),
 ('qa-tenant-1','qa-store-b','active'),
 ('qa-tenant-1','qa-store-disabled','suspended'),
 ('qa-tenant-2','qa-store-c','active');
INSERT INTO b7s.memberships VALUES
 ('b7s_a','qa-tenant-1','qa-store-a','active',now()+interval '1 day'),
 ('b7s_a','qa-tenant-1','qa-store-disabled','active',now()+interval '1 day'),
 ('b7s_b','qa-tenant-1','qa-store-b','active',now()+interval '1 day'),
 ('b7s_dual','qa-tenant-1','qa-store-a','active',now()+interval '1 day'),
 ('b7s_dual','qa-tenant-1','qa-store-b','active',now()+interval '1 day'),
 ('b7s_staff','qa-tenant-1','qa-store-a','active',now()+interval '1 day'),
 ('b7s_revoked','qa-tenant-1','qa-store-a','revoked',now()+interval '1 day'),
 ('b7s_outside','qa-tenant-2','qa-store-c','active',now()+interval '1 day');

INSERT INTO b7s.products VALUES
 ('qa-tenant-1','qa-store-a','product-a','SKU-A'),
 ('qa-tenant-1','qa-store-b','product-b','SKU-B'),
 ('qa-tenant-1','qa-store-disabled','product-disabled','SKU-D'),
 ('qa-tenant-1',NULL,'product-legacy','SKU-L'),
 ('qa-tenant-2','qa-store-c','product-c','SKU-C');
INSERT INTO b7s.customers VALUES
 ('qa-tenant-1','qa-store-a','customer-a'),
 ('qa-tenant-1','qa-store-b','customer-b'),
 ('qa-tenant-2','qa-store-c','customer-c');
INSERT INTO b7s.orders VALUES
 ('qa-tenant-1','qa-store-a','order-a','customer-a'),
 ('qa-tenant-1','qa-store-b','order-b','customer-b'),
 ('qa-tenant-1',NULL,'order-legacy',NULL),
 ('qa-tenant-2','qa-store-c','order-c','customer-c');
INSERT INTO b7s.order_items VALUES
 ('qa-tenant-1','qa-store-a','item-a','order-a','product-a'),
 ('qa-tenant-1','qa-store-b','item-b','order-b','product-b'),
 ('qa-tenant-2','qa-store-c','item-c','order-c','product-c');
INSERT INTO b7s.conversations VALUES
 ('qa-tenant-1','qa-store-a','conversation-a'),
 ('qa-tenant-1','qa-store-b','conversation-b'),
 ('qa-tenant-2','qa-store-c','conversation-c');
INSERT INTO b7s.messages VALUES
 ('qa-tenant-1','qa-store-a','message-a','conversation-a'),
 ('qa-tenant-1','qa-store-b','message-b','conversation-b'),
 ('qa-tenant-2','qa-store-c','message-c','conversation-c');

-- NOT VALID permits preexisting NULL legacy rows but rejects NEW NULL writes.
DO $$
DECLARE tbl text;
BEGIN
 FOREACH tbl IN ARRAY ARRAY['products','customers','orders','order_items','conversations','messages']
 LOOP
  EXECUTE format('ALTER TABLE b7s.%I ADD CONSTRAINT %I CHECK(store_id IS NOT NULL) NOT VALID',
   tbl,'b7s_'||tbl||'_new_store_required');
 END LOOP;
END $$;

-- Scope-immutable ordinary updates: even dual-store members cannot reassign rows.
CREATE FUNCTION b7s.reject_scope_reassignment() RETURNS trigger
 LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR
    NEW.store_id IS DISTINCT FROM OLD.store_id THEN
  RAISE EXCEPTION 'scope_reassignment_denied' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
DO $$
DECLARE tbl text;
BEGIN
 FOREACH tbl IN ARRAY ARRAY['products','customers','orders','order_items','conversations','messages']
 LOOP
  EXECUTE format('CREATE TRIGGER scope_guard BEFORE UPDATE ON b7s.%I FOR EACH ROW EXECUTE FUNCTION b7s.reject_scope_reassignment()',tbl);
  EXECUTE format('ALTER TABLE b7s.%I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('ALTER TABLE b7s.%I FORCE ROW LEVEL SECURITY',tbl);
  -- A deliberately broad legacy PERMISSIVE read policy cannot beat restrictive RLS.
  EXECUTE format('CREATE POLICY broad_legacy_read ON b7s.%I AS PERMISSIVE FOR SELECT TO PUBLIC USING(true)',tbl);
  EXECUTE format($sql$
    CREATE POLICY mandatory_store_boundary ON b7s.%1$I
    AS RESTRICTIVE FOR SELECT TO PUBLIC USING (
      store_id IS NOT NULL AND EXISTS(
        SELECT 1 FROM b7s.memberships m
        JOIN b7s.stores s ON s.tenant_id=m.tenant_id AND s.id=m.store_id
        WHERE m.actor=current_user AND m.tenant_id=%1$I.tenant_id
        AND m.store_id=%1$I.store_id AND m.status='active'
        AND m.expires_at>now() AND s.status='active'
      )
    )$sql$,tbl);
 END LOOP;
END $$;

GRANT USAGE ON SCHEMA b7s TO
 b7s_a,b7s_b,b7s_dual,b7s_tenant_owner,b7s_revoked,b7s_staff,b7s_outside;
GRANT SELECT ON ALL TABLES IN SCHEMA b7s TO
 b7s_a,b7s_b,b7s_dual,b7s_tenant_owner,b7s_revoked,b7s_staff,b7s_outside;

-- Privilege grants intentionally remain READ ONLY for synthetic roles.
SET ROLE b7s_a;
SELECT 1/(CASE WHEN (SELECT count(*) FROM b7s.products)=1 AND
 (SELECT count(*) FROM b7s.orders)=1 AND
 (SELECT count(*) FROM b7s.order_items)=1 AND
 (SELECT count(*) FROM b7s.customers)=1 AND
 (SELECT count(*) FROM b7s.conversations)=1 AND
 (SELECT count(*) FROM b7s.messages)=1
 THEN 1 ELSE 0 END) AS qa_A_only_all_6;
SELECT 1/(CASE WHEN (SELECT id FROM b7s.products)='product-a'
 AND NOT has_table_privilege(current_user,'b7s.products','UPDATE') THEN 1 ELSE 0 END)
 AS qa_A_correct_no_direct_writer;
RESET ROLE;

SET ROLE b7s_b;
SELECT 1/(CASE WHEN (SELECT count(*) FROM b7s.products)=1 AND
 (SELECT count(*) FROM b7s.orders)=1 AND
 (SELECT id FROM b7s.products)='product-b'
 THEN 1 ELSE 0 END) AS qa_B_only;
RESET ROLE;

SET ROLE b7s_dual;
SELECT 1/(CASE WHEN (SELECT count(*) FROM b7s.products)=2 AND
 (SELECT count(*) FROM b7s.orders)=2
 THEN 1 ELSE 0 END) AS qa_dual_explicit_membership;
RESET ROLE;

SET ROLE b7s_tenant_owner;
SELECT 1/(CASE WHEN (SELECT count(*) FROM b7s.products)=0 AND
 (SELECT count(*) FROM b7s.orders)=0
 THEN 1 ELSE 0 END) AS qa_tenant_admin_no_implicit_store_access;
RESET ROLE;

SET ROLE b7s_revoked;
SELECT 1/(CASE WHEN (SELECT count(*) FROM b7s.products)=0 THEN 1 ELSE 0 END)
 AS qa_revocation_denied;
RESET ROLE;

SET ROLE b7s_staff;
SELECT 1/(CASE WHEN (SELECT count(*) FROM b7s.products)=1
 AND NOT has_table_privilege(current_user,'b7s.products','UPDATE')
 AND NOT has_table_privilege(current_user,'b7s.orders','DELETE')
 THEN 1 ELSE 0 END) AS qa_staff_read_only;
RESET ROLE;

SET ROLE b7s_outside;
SELECT 1/(CASE WHEN (SELECT count(*) FROM b7s.products)=1 AND
 (SELECT id FROM b7s.products)='product-c'
 THEN 1 ELSE 0 END) AS qa_other_tenant_only_c;
RESET ROLE;

-- Even privileged attempts cannot cross Store FK, SKU uniqueness, CHECK or trigger.
DO $$
BEGIN
 BEGIN
  INSERT INTO b7s.order_items VALUES
   ('qa-tenant-1','qa-store-a','item-wrong-order','order-b','product-a');
  RAISE EXCEPTION 'cross_store_order_fk_not_rejected';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
 BEGIN
  INSERT INTO b7s.order_items VALUES
   ('qa-tenant-1','qa-store-a','item-wrong-product','order-a','product-b');
  RAISE EXCEPTION 'cross_store_product_fk_not_rejected';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
 BEGIN
  INSERT INTO b7s.orders VALUES
   ('qa-tenant-1','qa-store-a','order-wrong-customer','customer-b');
  RAISE EXCEPTION 'cross_store_customer_fk_not_rejected';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
 BEGIN
  INSERT INTO b7s.messages VALUES
   ('qa-tenant-1','qa-store-a','message-wrong-conv','conversation-b');
  RAISE EXCEPTION 'cross_store_conversation_fk_not_rejected';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
 BEGIN
  -- Legacy Tenant-wide SKU uniqueness must stay until decision D-02.
  INSERT INTO b7s.products VALUES
   ('qa-tenant-1','qa-store-b','product-new','SKU-A');
  RAISE EXCEPTION 'legacy_tenant_sku_unique_not_preserved';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 BEGIN
  -- Existing tenant-only RPC would insert a NULL Store ID; NOT VALID check
  -- rejects it for new rows, so the RPC cannot be deployed unchanged.
  INSERT INTO b7s.products(tenant_id,id,sku)
   VALUES('qa-tenant-1','new-no-store','SKU-NEW');
  RAISE EXCEPTION 'legacy_tenant_writer_not_blocked';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 BEGIN
  UPDATE b7s.products SET store_id='qa-store-b'
   WHERE tenant_id='qa-tenant-1' AND id='product-a';
  RAISE EXCEPTION 'scope_trigger_not_enforced';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;

-- Existing NULL legacy rows remain, but cannot be seen by Store actors.
SELECT 1/(CASE WHEN
 (SELECT count(*) FROM b7s.orders WHERE store_id IS NULL)=1 AND
 (SELECT count(*) FROM b7s.products WHERE store_id IS NULL)=1 AND
 (SELECT count(*) FROM pg_constraint WHERE connamespace='b7s'::regnamespace
  AND conname LIKE 'b7s_%_new_store_required' AND convalidated=false)=6
 AND (SELECT count(*) FROM pg_policies WHERE schemaname='b7s'
  AND policyname='mandatory_store_boundary' AND permissive='RESTRICTIVE')=6
 THEN 1 ELSE 0 END) AS qa_six_store_boundaries_and_legacy_quarantine;
SELECT 'B7_S1_PG17_DISPOSABLE_COMPAT_REHEARSAL_PASS' AS checkpoint;
