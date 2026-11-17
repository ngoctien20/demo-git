-- V17.2C.12 — READ-ONLY PostgreSQL deployed-schema acceptance audit.
-- Safe to run when the candidate schema does not exist: result must be NO_GO.
-- For an AUTHORIZED DISPOSABLE PROJECT only when schema is installed.
-- Does not execute any RPC, inspect Auth identities, read customer data, create or update objects.
WITH refs AS (
 SELECT
  to_regclass('tien404_v172c10_disposable.qa_tenants') AS tenants,
  to_regclass('tien404_v172c10_disposable.qa_stores') AS stores,
  to_regclass('tien404_v172c10_disposable.qa_store_memberships') AS membership,
  to_regclass('tien404_v172c10_disposable.qa_catalog') AS catalog
), metadata AS (
 SELECT
  (SELECT count(*)::integer FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='tien404_v172c10_disposable'
      AND c.relkind IN ('r','p') AND c.relname IN ('qa_tenants','qa_stores','qa_store_memberships','qa_catalog')
      AND c.relrowsecurity) AS rls_enabled_tables,
  (SELECT count(*)::integer FROM pg_policies WHERE schemaname='tien404_v172c10_disposable'
    AND tablename IN ('qa_store_memberships','qa_catalog') AND cmd='SELECT'
    AND 'authenticated'=ANY(roles)) AS authenticated_select_policies,
  (SELECT count(*)::integer FROM pg_indexes WHERE schemaname='tien404_v172c10_disposable'
    AND tablename='qa_store_memberships' AND indexname='qa_store_memberships_user_active_idx'
    AND indexdef ILIKE '%(user_id, active, tenant_id, store_id)%') AS membership_user_indexes,
  (SELECT count(*)::integer FROM pg_constraint k
    JOIN pg_class child ON child.oid=k.conrelid JOIN pg_namespace n ON n.oid=child.relnamespace
    WHERE n.nspname='tien404_v172c10_disposable' AND k.contype='f'
      AND child.relname IN ('qa_store_memberships','qa_catalog')
      AND (SELECT array_agg(a.attname ORDER BY u.ord)
           FROM unnest(k.conkey) WITH ORDINALITY u(attnum,ord)
           JOIN pg_attribute a ON a.attrelid=child.oid AND a.attnum=u.attnum)
        = ARRAY['tenant_id','store_id']::name[]) AS composite_store_fk_count
)
SELECT
  (refs.tenants IS NOT NULL AND refs.stores IS NOT NULL AND refs.membership IS NOT NULL AND refs.catalog IS NOT NULL)
    AS all_qa_tables_present,
  metadata.rls_enabled_tables,
  metadata.authenticated_select_policies,
  metadata.membership_user_indexes,
  metadata.composite_store_fk_count,
  -- Only query grants when a relation exists, otherwise fail closed to FALSE.
  CASE WHEN refs.catalog IS NOT NULL
    THEN has_table_privilege('anon', refs.catalog, 'SELECT') ELSE false END AS anon_catalog_select,
  CASE WHEN refs.catalog IS NOT NULL
    THEN has_table_privilege('authenticated', refs.catalog, 'SELECT') ELSE false END AS auth_catalog_select,
  CASE WHEN refs.catalog IS NOT NULL
    THEN has_table_privilege('authenticated', refs.catalog, 'INSERT, UPDATE, DELETE') ELSE false END
    AS auth_catalog_write_any,
  CASE WHEN refs.catalog IS NOT NULL AND refs.membership IS NOT NULL
     AND refs.stores IS NOT NULL AND refs.tenants IS NOT NULL
     AND metadata.rls_enabled_tables=4
     AND metadata.authenticated_select_policies=2
     AND metadata.membership_user_indexes=1
     AND metadata.composite_store_fk_count=2
     AND NOT has_table_privilege('anon', refs.catalog, 'SELECT')
     AND has_table_privilege('authenticated', refs.catalog, 'SELECT')
     AND NOT has_table_privilege('authenticated', refs.catalog, 'INSERT, UPDATE, DELETE')
   THEN 'METADATA_REVIEW_REQUIRED_NOT_JWT_GO'
   ELSE 'NO_GO_SCHEMA_OR_GRANT_INVARIANT' END AS audit_decision
FROM refs CROSS JOIN metadata;
