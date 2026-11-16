-- TIEN404 ADV.6C-RPC.8 — M1 EXPAND-ONLY (EXACT DISPOSABLE CI DATABASE).
-- THIS IS NOT A SUPABASE MIGRATION. NO PUBLIC SCHEMA. NO REAL MERCHANT DATA.
-- Invoke with psql -v ON_ERROR_STOP=1 INSIDE a caller-controlled transaction.
\set ON_ERROR_STOP on
DO $rpc8_preflight$
DECLARE n_products integer; n_orders integer; n_customers integer;
BEGIN
 IF current_database() <> 't404_rpc8_ci'
    OR current_user <> 'postgres'
    OR current_setting('tien404.rpc8_ephemeral',true) <> 'RPC8_DISPOSABLE'
    OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 THEN RAISE EXCEPTION 'RPC8_EXPAND_CANDIDATE_REFUSES_HOSTED_DATABASE'; END IF;
 IF to_regclass('qa_rpc8.stores') IS NOT NULL
    OR to_regclass('qa_rpc8.store_memberships') IS NOT NULL
 THEN RAISE EXCEPTION 'RPC8_PREEXISTING_STORE_SCHEMA_REAUDIT_REQUIRED'; END IF;
 IF (SELECT count(*) FROM information_schema.columns
       WHERE table_schema='qa_rpc8'
         AND table_name IN('products','orders','customers')
         AND column_name='store_id') <> 0
 THEN RAISE EXCEPTION 'RPC8_LEGACY_STORE_COLUMN_DRIFT'; END IF;
 SELECT count(*) INTO n_products FROM qa_rpc8.products;
 SELECT count(*) INTO n_orders FROM qa_rpc8.orders;
 SELECT count(*) INTO n_customers FROM qa_rpc8.customers;
 IF n_products<>2 OR n_orders<>2 OR n_customers<>0
 THEN RAISE EXCEPTION 'RPC8_LEGACY_ROW_COUNTS_DRIFT'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='qa_rpc8'
       AND (tablename,policyname) IN (
        ('products','products_member_read'),
        ('orders','orders_manager_read'),
        ('customers','customers_manager_read'))) <> 3
 THEN RAISE EXCEPTION 'RPC8_LEGACY_RLS_POLICIES_CHANGED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint
     WHERE conrelid='qa_rpc8.products'::regclass
       AND contype='u' AND pg_get_constraintdef(oid) LIKE 'UNIQUE (tenant_id, sku)%')
 THEN RAISE EXCEPTION 'RPC8_LEGACY_SKU_UNIQUE_MISSING'; END IF;
END $rpc8_preflight$;

-- No backfill; no tenant-wide policy replacement; preserve legacy writers.
CREATE TABLE qa_rpc8.stores (
 id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES qa_rpc8.tenants(id) ON DELETE RESTRICT,
 code text NOT NULL CHECK (length(btrim(code)) BETWEEN 2 AND 80),
 active boolean NOT NULL DEFAULT true,
 UNIQUE(tenant_id,id),
 UNIQUE(tenant_id,code)
);
CREATE TABLE qa_rpc8.store_memberships (
 tenant_id uuid NOT NULL,
 store_id uuid NOT NULL,
 user_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN ('owner','manager','staff')),
 active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(tenant_id,store_id,user_id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES qa_rpc8.stores(tenant_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,user_id)
   REFERENCES qa_rpc8.tenant_memberships(tenant_id,user_id) ON DELETE RESTRICT
);
ALTER TABLE qa_rpc8.products ADD COLUMN store_id uuid NULL;
ALTER TABLE qa_rpc8.orders ADD COLUMN store_id uuid NULL;
ALTER TABLE qa_rpc8.customers ADD COLUMN store_id uuid NULL;

ALTER TABLE qa_rpc8.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_rpc8.stores FORCE ROW LEVEL SECURITY;
ALTER TABLE qa_rpc8.store_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_rpc8.store_memberships FORCE ROW LEVEL SECURITY;
REVOKE ALL ON qa_rpc8.stores,qa_rpc8.store_memberships FROM PUBLIC;
-- Read-only customer side; no INSERT/UPDATE grant or service_role shortcut.
GRANT SELECT ON qa_rpc8.stores,qa_rpc8.store_memberships TO qa_rpc8_user;
CREATE POLICY store_membership_self_read ON qa_rpc8.store_memberships
 FOR SELECT TO qa_rpc8_user
 USING(user_id=qa_rpc8.actor_id() AND active AND EXISTS (
  SELECT 1 FROM qa_rpc8.tenant_memberships tm
  WHERE tm.tenant_id=store_memberships.tenant_id
    AND tm.user_id=store_memberships.user_id
    AND tm.active
 ));
CREATE POLICY store_member_read ON qa_rpc8.stores
 FOR SELECT TO qa_rpc8_user
 USING(active AND EXISTS (
  SELECT 1 FROM qa_rpc8.store_memberships sm
  WHERE sm.tenant_id=stores.tenant_id AND sm.store_id=stores.id
    AND sm.user_id=qa_rpc8.actor_id() AND sm.active
 ));
-- M1 intentionally leaves old tenant-only Products/Orders/Customers
-- PERMISSIVE policies unchanged. No Store-level Commerce RLS certification
-- is possible until separate M2/M3/M4 approvals and tenant-wide policy swap.
