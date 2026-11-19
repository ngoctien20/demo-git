-- TIEN404 V19.8.4 - disposable PostgreSQL 17 fixture only, NOT a hosted migration.
-- Must run after qa/channel-v1983/ephemeral-postgres-schema.sql in the temporary CI database.
-- SECURITY INVOKER: no service_role, no secret credentials, no customer data.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA qa1984;
GRANT USAGE ON SCHEMA qa1984 TO qa_authenticated;

CREATE TABLE qa1984.catalog_snapshots (
 tenant_id uuid NOT NULL,
 store_id uuid NOT NULL,
 sku text NOT NULL,
 price_vnd bigint,
 stock_on_hand integer,
 verified_at timestamptz,
 source_kind text NOT NULL,
 source_revision text NOT NULL,
 PRIMARY KEY(tenant_id,store_id,sku),
 FOREIGN KEY(tenant_id,store_id,sku)
   REFERENCES qa1983.products(tenant_id,store_id,sku)
);
INSERT INTO qa1984.catalog_snapshots
(tenant_id,store_id,sku,price_vnd,stock_on_hand,verified_at,source_kind,source_revision)
VALUES
('00000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'F01',159000,5,statement_timestamp()-interval '45 seconds','QA_CATALOG_VERIFIED','V1984_A_001'),
('00000000-0000-0000-0000-000000000001','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
 'F01',189000,9,statement_timestamp()-interval '45 seconds','QA_CATALOG_VERIFIED','V1984_B_001');

ALTER TABLE qa1984.catalog_snapshots ENABLE ROW LEVEL SECURITY;
-- Direct SELECT has same fail-closed price/stock/freshness checks as the reader RPC.
-- A broad OR policy must never be added.
CREATE POLICY catalog_verified_store_only ON qa1984.catalog_snapshots
FOR SELECT TO qa_authenticated
USING (
 qa1983.can_read_store(tenant_id,store_id)
 AND sku ~ '^[A-Z][A-Z0-9-]{1,20}$'
 AND price_vnd > 0 AND price_vnd <= 9000000000000000
 AND stock_on_hand >= 0
 AND verified_at IS NOT NULL
 AND verified_at <= statement_timestamp()
 AND verified_at > statement_timestamp()-interval '300 seconds'
 AND source_kind='QA_CATALOG_VERIFIED'
 AND source_revision ~ '^V1984_[A-Z]_[0-9]{3}$'
 AND EXISTS(
  SELECT 1 FROM qa1983.products p
  WHERE p.tenant_id=catalog_snapshots.tenant_id
  AND p.store_id=catalog_snapshots.store_id
  AND p.sku=catalog_snapshots.sku
  AND p.price_vnd=catalog_snapshots.price_vnd
  AND p.stock=catalog_snapshots.stock_on_hand
 )
);
GRANT SELECT ON qa1984.catalog_snapshots TO qa_authenticated;

CREATE FUNCTION qa1984.read_catalog(p_tenant uuid,p_store uuid,p_sku text)
RETURNS TABLE (
 sku text,
 price_vnd bigint,
 stock_on_hand integer,
 verified_at timestamptz,
 currency text,
 source_revision text
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path=pg_catalog
AS $$
 SELECT s.sku,s.price_vnd,s.stock_on_hand,s.verified_at,'VND'::text,s.source_revision
 FROM qa1984.catalog_snapshots s
 WHERE s.tenant_id=p_tenant AND s.store_id=p_store AND s.sku=p_sku
 AND p_sku ~ '^[A-Z][A-Z0-9-]{1,20}$'
 ORDER BY s.verified_at DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION qa1984.read_catalog(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qa1984.read_catalog(uuid,uuid,text) TO qa_authenticated;
COMMIT;
