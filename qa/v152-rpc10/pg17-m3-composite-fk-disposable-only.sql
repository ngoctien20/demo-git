-- TIEN404 ADV.6C RPC.10 — exact disposable PostgreSQL 17 M3 FK/SKU candidate.
-- NOT a hosted migration, not production-safe or approved.
-- Must be called only inside externally provided BEGIN / COMMIT or ROLLBACK.
\set ON_ERROR_STOP on
DO $rpc10_guard$
DECLARE _old_unique integer;
BEGIN
 IF current_database()<>'t404_rpc8_ci'
   OR current_user<>'postgres'
   OR current_setting('tien404.rpc8_ephemeral',true)<>'RPC8_DISPOSABLE'
   OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 THEN RAISE EXCEPTION 'RPC10_DISPOSABLE_PG17_ONLY'; END IF;
 IF to_regclass('qa_rpc8.stores') IS NULL
    OR to_regclass('qa_rpc8.store_memberships') IS NULL
 THEN RAISE EXCEPTION 'RPC10_M1_NOT_PRESENT'; END IF;
 IF (SELECT count(*) FROM qa_rpc8.products)<>3
    OR (SELECT count(*) FROM qa_rpc8.orders)<>3
    OR (SELECT count(*) FROM qa_rpc8.customers)<>2
    OR (SELECT count(*) FROM qa_rpc8.products WHERE store_id IS NOT NULL)<>3
    OR (SELECT count(*) FROM qa_rpc8.orders WHERE store_id IS NOT NULL)<>3
    OR (SELECT count(*) FROM qa_rpc8.customers WHERE store_id IS NOT NULL)<>2
 THEN RAISE EXCEPTION 'RPC10_SOURCE_OR_OWNER_MAPPING_DRIFT'; END IF;
 IF (SELECT count(*) FROM pg_policies
    WHERE schemaname='qa_rpc8' AND tablename IN ('products','orders','customers')
       AND policyname IN ('products_store_scoped_read',
        'orders_store_manager_read','customers_store_manager_read'))<>3
 OR EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='qa_rpc8'
    AND policyname IN ('products_member_read','orders_manager_read','customers_manager_read'))
 THEN RAISE EXCEPTION 'RPC10_RLS_M2M4_NOT_ACCEPTED'; END IF;
 SELECT count(*) INTO _old_unique
 FROM pg_constraint
 WHERE conrelid='qa_rpc8.products'::regclass AND contype='u'
   AND conname='products_tenant_id_sku_key'
   AND pg_get_constraintdef(oid)='UNIQUE (tenant_id, sku)';
 IF _old_unique<>1
    OR EXISTS(SELECT 1 FROM pg_constraint
     WHERE conrelid IN ('qa_rpc8.products'::regclass,
        'qa_rpc8.orders'::regclass,'qa_rpc8.customers'::regclass)
       AND conname LIKE 'rpc10_%')
 THEN RAISE EXCEPTION 'RPC10_SCHEMA_ALREADY_CHANGED_REAUDIT'; END IF;
 IF (SELECT count(*) FROM qa_rpc8.orders WHERE customer_id IS NOT NULL)<>2
    OR EXISTS(SELECT 1 FROM qa_rpc8.orders o JOIN qa_rpc8.customers c
      ON o.customer_id=c.id AND o.tenant_id=c.tenant_id
      WHERE o.store_id<>c.store_id)
 THEN RAISE EXCEPTION 'RPC10_CUSTOMER_ORDER_ORIGINAL_CROSS_STORE_LINK'; END IF;
 IF EXISTS(SELECT 1 FROM qa_rpc8.products p LEFT JOIN qa_rpc8.stores s
     ON s.tenant_id=p.tenant_id AND s.id=p.store_id WHERE s.id IS NULL)
 OR EXISTS(SELECT 1 FROM qa_rpc8.orders o LEFT JOIN qa_rpc8.stores s
     ON s.tenant_id=o.tenant_id AND s.id=o.store_id WHERE s.id IS NULL)
 OR EXISTS(SELECT 1 FROM qa_rpc8.customers c LEFT JOIN qa_rpc8.stores s
     ON s.tenant_id=c.tenant_id AND s.id=c.store_id WHERE s.id IS NULL)
 THEN RAISE EXCEPTION 'RPC10_OWNER_STORE_TENANT_MISMATCH'; END IF;
END $rpc10_guard$;

-- In real hosting, lock cost and FK validation time must be approved.
-- These constraints are only exercised in the throwaway qa_rpc8 schema.
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='10s';

-- PostgreSQL enforces new writes on NOT VALID foreign keys. VALIDATE ensures
-- existing rows also pass, before dropping old tenant-only SKU uniqueness.
ALTER TABLE qa_rpc8.products ADD CONSTRAINT rpc10_products_tenant_store_fk
 FOREIGN KEY (tenant_id,store_id)
 REFERENCES qa_rpc8.stores(tenant_id,id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE qa_rpc8.orders ADD CONSTRAINT rpc10_orders_tenant_store_fk
 FOREIGN KEY (tenant_id,store_id)
 REFERENCES qa_rpc8.stores(tenant_id,id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE qa_rpc8.customers ADD CONSTRAINT rpc10_customers_tenant_store_fk
 FOREIGN KEY (tenant_id,store_id)
 REFERENCES qa_rpc8.stores(tenant_id,id) ON DELETE RESTRICT NOT VALID;

-- The new same-Store Customer FK needs a unique referenced tuple.
ALTER TABLE qa_rpc8.customers ADD CONSTRAINT rpc10_customers_tenant_store_id_key
 UNIQUE(tenant_id,store_id,id);
ALTER TABLE qa_rpc8.orders ADD CONSTRAINT rpc10_orders_same_store_customer_fk
 FOREIGN KEY(tenant_id,store_id,customer_id)
 REFERENCES qa_rpc8.customers(tenant_id,store_id,id)
 ON DELETE RESTRICT NOT VALID;

ALTER TABLE qa_rpc8.products VALIDATE CONSTRAINT rpc10_products_tenant_store_fk;
ALTER TABLE qa_rpc8.orders VALIDATE CONSTRAINT rpc10_orders_tenant_store_fk;
ALTER TABLE qa_rpc8.customers VALIDATE CONSTRAINT rpc10_customers_tenant_store_fk;
ALTER TABLE qa_rpc8.orders VALIDATE CONSTRAINT rpc10_orders_same_store_customer_fk;

-- NULL could bypass any composite FK; no NULL Store IDs may remain.
ALTER TABLE qa_rpc8.products ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE qa_rpc8.orders ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE qa_rpc8.customers ALTER COLUMN store_id SET NOT NULL;

-- This phase is after audited M2/M4 transaction, so same SKU in different
-- Stores under one Tenant is now an intended distinct catalog record.
ALTER TABLE qa_rpc8.products ADD CONSTRAINT rpc10_products_tenant_store_sku_key
 UNIQUE(tenant_id,store_id,sku);
ALTER TABLE qa_rpc8.products DROP CONSTRAINT products_tenant_id_sku_key;

DO $rpc10_assert$
BEGIN
 IF (SELECT count(*) FROM pg_constraint
    WHERE conname IN ('rpc10_products_tenant_store_fk',
      'rpc10_orders_tenant_store_fk',
      'rpc10_customers_tenant_store_fk',
      'rpc10_orders_same_store_customer_fk')
      AND convalidated)<>4
 THEN RAISE EXCEPTION 'RPC10_FK_VALIDATION_INCOMPLETE'; END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='qa_rpc8' AND table_name IN ('products','orders','customers')
    AND column_name='store_id' AND is_nullable='YES')
 THEN RAISE EXCEPTION 'RPC10_STORE_ID_NULLABLE'; END IF;
 IF EXISTS(SELECT 1 FROM pg_constraint
    WHERE conname='products_tenant_id_sku_key'
      AND conrelid='qa_rpc8.products'::regclass)
 THEN RAISE EXCEPTION 'RPC10_LEGACY_TENANT_SKU_UNIQUE_STILL_ACTIVE'; END IF;
END $rpc10_assert$;
