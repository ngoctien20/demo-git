-- TIEN404 H11R.11: SYNTHETIC OWNER EVIDENCE / DISPOSABLE PostgreSQL17 only.
-- No Supabase hosted changes, no real owners, no exports or PII.
\set ON_ERROR_STOP on
\ir ../h11r10/pg17-store-migration-compatibility.sql
BEGIN;
CREATE SCHEMA qa_h11r11;
CREATE TABLE qa_h11r11.expected_rows(
  entity text NOT NULL CHECK(entity IN ('PRODUCT','ORDER')),
  row_digest text NOT NULL CHECK(row_digest ~ '^[a-f0-9]{64}$'),
  tenant_id uuid NOT NULL REFERENCES qa_p0.tenants(id),
  PRIMARY KEY(entity,row_digest)
);
CREATE TABLE qa_h11r11.claims (
  entity text NOT NULL,
  row_digest text NOT NULL,
  tenant_id uuid NOT NULL,
  store_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  owner_proof_digest text NOT NULL CHECK(owner_proof_digest ~ '^[a-f0-9]{64}$'),
  reviewer_proof_digest text NOT NULL CHECK(reviewer_proof_digest ~ '^[a-f0-9]{64}$'),
  channel_proof_digest text NOT NULL CHECK(channel_proof_digest ~ '^[a-f0-9]{64}$'),
  inspected boolean NOT NULL DEFAULT false,
  PRIMARY KEY(entity,row_digest),
  FOREIGN KEY(entity,row_digest) REFERENCES qa_h11r11.expected_rows(entity,row_digest),
  FOREIGN KEY(tenant_id,store_id,owner_id) REFERENCES qa_p0.store_memberships(tenant_id,store_id,user_id),
  FOREIGN KEY(tenant_id,store_id) REFERENCES qa_p0.stores(tenant_id,id)
);
INSERT INTO qa_h11r11.expected_rows VALUES
 ('PRODUCT',repeat('1',64),'00000000-0000-0000-0000-000000000001'),
 ('PRODUCT',repeat('2',64),'00000000-0000-0000-0000-000000000001'),
 ('ORDER',repeat('3',64),'00000000-0000-0000-0000-000000000001'),
 ('ORDER',repeat('4',64),'00000000-0000-0000-0000-000000000001');
-- Four legacy rows need four independent proofs, test only THREE at first.
INSERT INTO qa_h11r11.claims VALUES
 ('PRODUCT',repeat('1',64),'00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
  repeat('a',64),repeat('b',64),repeat('c',64),true),
 ('PRODUCT',repeat('2',64),'00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002',
  repeat('d',64),repeat('e',64),repeat('f',64),true),
 ('ORDER',repeat('3',64),'00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
  repeat('1',64),repeat('2',64),repeat('3',64),true);
DO $qa$ BEGIN
 IF (SELECT count(*) FROM qa_h11r11.expected_rows e
 LEFT JOIN qa_h11r11.claims c ON c.entity=e.entity AND c.row_digest=e.row_digest
 WHERE c.row_digest IS NULL)<>1
 THEN RAISE EXCEPTION 'H11R11_MISSING_LEGACY_PROOF_NOT_CAUGHT'; END IF;
 RAISE NOTICE 'H11R11_PASS_FOUR_ROW_SCOPE_MISSING_ONE_BLOCKS';
END $qa$;
-- Wrong tenant + Store pairing must fail the composite FK.
DO $qa$ DECLARE rejected boolean:=false; BEGIN
 BEGIN
  INSERT INTO qa_h11r11.claims VALUES
  ('ORDER',repeat('4',64),'00000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000003',
   repeat('a',64),repeat('b',64),repeat('c',64),true);
 EXCEPTION WHEN foreign_key_violation THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'H11R11_WRONG_TENANT_STORE_ACCEPTED'; END IF;
 RAISE NOTICE 'H11R11_PASS_WRONG_TENANT_CLAIM_REJECTED';
END $qa$;
-- Malformed or duplicate row claims fail closed.
DO $qa$ DECLARE rejected boolean:=false; BEGIN
 BEGIN
  INSERT INTO qa_h11r11.claims VALUES
  ('PRODUCT',repeat('1',64),'00000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002',
   repeat('a',64),repeat('b',64),repeat('c',64),true);
 EXCEPTION WHEN unique_violation THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'H11R11_DUPLICATED_OWNERSHIP_NOT_REJECTED'; END IF;
 RAISE NOTICE 'H11R11_PASS_DUPLICATED_ROW_CLAIM_REJECTED';
END $qa$;
INSERT INTO qa_h11r11.claims VALUES
 ('ORDER',repeat('4',64),'00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002',
  repeat('4',64),repeat('5',64),repeat('6',64),true);
-- Synthetic coverage complete, only within this transaction.
DO $qa$ BEGIN
 IF (SELECT count(*) FROM qa_h11r11.claims)<>4 OR EXISTS(
 SELECT 1 FROM qa_h11r11.expected_rows e
 LEFT JOIN qa_h11r11.claims c ON c.entity=e.entity AND c.row_digest=e.row_digest
 LEFT JOIN qa_p0.store_memberships sm ON sm.tenant_id=c.tenant_id AND
  sm.store_id=c.store_id AND sm.user_id=c.owner_id
 LEFT JOIN qa_p0.tenant_memberships tm ON tm.tenant_id=c.tenant_id AND tm.user_id=c.owner_id
 LEFT JOIN qa_p0.stores s ON s.tenant_id=c.tenant_id AND s.id=c.store_id
 WHERE c.row_digest IS NULL OR c.tenant_id<>e.tenant_id OR
  c.inspected IS DISTINCT FROM true OR sm.active IS DISTINCT FROM true OR
  sm.role NOT IN ('owner','manager') OR tm.active IS DISTINCT FROM true OR
  s.status IS DISTINCT FROM 'active'
 ) THEN RAISE EXCEPTION 'H11R11_SYNTHETIC_OWNER_PROOFS_INVALID'; END IF;
 RAISE NOTICE 'H11R11_PASS_SYNTHETIC_OWNER_COVERAGE_WITH_ACTIVE_ROLE_GUARDS';
END $qa$;
-- Revoked owner cannot continue to pass even with retained written proof.
UPDATE qa_p0.store_memberships SET active=false
 WHERE tenant_id='00000000-0000-0000-0000-000000000001'
 AND store_id='10000000-0000-0000-0000-000000000002';
DO $qa$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM qa_h11r11.claims c
 JOIN qa_p0.store_memberships sm ON sm.tenant_id=c.tenant_id AND
  sm.store_id=c.store_id AND sm.user_id=c.owner_id
 WHERE sm.active=false)
 THEN RAISE EXCEPTION 'H11R11_REVOKED_OWNER_NOT_DETECTED'; END IF;
 RAISE NOTICE 'H11R11_PASS_REVOKED_OWNER_INVALIDATES_CLAIM';
END $qa$;
-- Transaction rollback leaves existing QA source unchanged.
ROLLBACK;
DO $qa$ BEGIN
 IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='qa_h11r11')
 THEN RAISE EXCEPTION 'H11R11_ROLLBACK_NOT_CLEAN'; END IF;
END $qa$;
SELECT 'H11R11_SYNTHETIC_OWNER_ACCEPTANCE_PASS_NOT_REAL_MERCHANT_EVIDENCE' AS result;
