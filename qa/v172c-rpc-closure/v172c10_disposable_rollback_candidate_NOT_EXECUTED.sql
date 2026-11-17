-- V17.2C.10 — REVERSAL CANDIDATE ONLY. NOT EXECUTED.
-- Dedicated disposable project only, after explicit reviewer approval.
-- WARNING: Removes ONLY schema-owned synthetic QA fixtures and membership records.
-- This is NOT a backup restore procedure. Requires independent restore validation.
-- Fail closed when schema is absent or its inventory differs.
BEGIN;
DO $check$
DECLARE actual_count integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='tien404_v172c10_disposable') THEN
  RAISE EXCEPTION 'QA schema missing; rollback rejected';
 END IF;
 SELECT count(*) INTO actual_count FROM pg_tables WHERE schemaname='tien404_v172c10_disposable';
 IF actual_count <> 4 THEN
  RAISE EXCEPTION 'Unexpected table inventory (%). Rollback rejected', actual_count;
 END IF;
 IF EXISTS(
  SELECT 1 FROM pg_depend d
  JOIN pg_class r ON r.oid=d.refobjid
  JOIN pg_namespace n ON n.oid=r.relnamespace
  JOIN pg_class dependent ON dependent.oid=d.objid
  JOIN pg_namespace dn ON dn.oid=dependent.relnamespace
  WHERE n.nspname='tien404_v172c10_disposable'
    AND dn.nspname <> 'tien404_v172c10_disposable'
    AND dependent.relkind IN ('r','p','v','m','f')
 ) THEN
  RAISE EXCEPTION 'External dependent relations exist; rollback rejected';
 END IF;
END $check$;
DROP TABLE tien404_v172c10_disposable.qa_catalog;
DROP TABLE tien404_v172c10_disposable.qa_store_memberships;
DROP TABLE tien404_v172c10_disposable.qa_stores;
DROP TABLE tien404_v172c10_disposable.qa_tenants;
DROP SCHEMA tien404_v172c10_disposable RESTRICT;
COMMIT;
