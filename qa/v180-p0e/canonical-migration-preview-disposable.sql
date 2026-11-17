\set ON_ERROR_STOP on
-- V18.0-P0E: EXACTLY disposable PostgreSQL 17 migration PREVIEW.
-- Never execute in Supabase staging, production or any existing database.
-- Synthetic fixtures/proofs only, no real user or merchant data.
DO $guard$
BEGIN
 IF current_database() <> 't404_v180_p0e_ci'
    OR current_user <> 'postgres'
    OR current_setting('server_version_num')::int < 170000
    OR to_regnamespace('p0e_preview') IS NOT NULL
 THEN RAISE EXCEPTION 'P0E_DISPOSABLE_PG17_ONLY' USING ERRCODE='42501'; END IF;
END $guard$;

BEGIN;
CREATE SCHEMA p0e_preview;
CREATE TABLE p0e_preview.stores(
  tenant_id uuid NOT NULL, store_id uuid NOT NULL,
  is_active boolean NOT NULL, authority_version integer NOT NULL CHECK(authority_version>0),
  PRIMARY KEY(tenant_id,store_id)
);
CREATE TABLE p0e_preview.legacy_products(
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL, sku text NOT NULL,
  price_vnd bigint NOT NULL, UNIQUE(tenant_id,sku)
);
CREATE TABLE p0e_preview.legacy_orders(
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL, product_id uuid NOT NULL,
  FOREIGN KEY (product_id) REFERENCES p0e_preview.legacy_products(id)
);
-- Proof rows are FAKES; real ownership authority must arrive from trusted external intake.
CREATE TABLE p0e_preview.synthetic_owner_proofs(
  proof_id text NOT NULL, tenant_id uuid NOT NULL, store_id uuid NOT NULL,
  verified boolean NOT NULL, expires_at timestamptz NOT NULL,
  PRIMARY KEY(proof_id), UNIQUE(proof_id,tenant_id,store_id),
  FOREIGN KEY(tenant_id,store_id) REFERENCES p0e_preview.stores(tenant_id,store_id)
);
CREATE TABLE p0e_preview.trusted_candidates(
  resource_type text NOT NULL CHECK(resource_type IN ('product','order')),
  resource_id uuid NOT NULL, tenant_id uuid NOT NULL, store_id uuid NOT NULL,
  proof_id text NOT NULL,
  PRIMARY KEY(resource_type,resource_id,proof_id),
  FOREIGN KEY(proof_id,tenant_id,store_id)
  REFERENCES p0e_preview.synthetic_owner_proofs(proof_id,tenant_id,store_id)
);
INSERT INTO p0e_preview.stores VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true,1),
 ('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true,1),
 ('22222222-2222-4222-8222-222222222222','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true,1);
INSERT INTO p0e_preview.legacy_products VALUES
 ('20000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','QA-SKU-1',159000),
 ('20000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','QA-SKU-2',259000),
 ('20000000-0000-4000-8000-000000000003','11111111-1111-4111-8111-111111111111','QA-SKU-3',359000),
 ('20000000-0000-4000-8000-000000000004','11111111-1111-4111-8111-111111111111','QA-SKU-4',459000),
 ('20000000-0000-4000-8000-000000000005','11111111-1111-4111-8111-111111111111','QA-SKU-5',559000),
 ('20000000-0000-4000-8000-000000000006','22222222-2222-4222-8222-222222222222','QA-SKU-6',659000);
INSERT INTO p0e_preview.legacy_orders VALUES
 ('40000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','20000000-0000-4000-8000-000000000001'),
 ('40000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','20000000-0000-4000-8000-000000000002'),
 ('40000000-0000-4000-8000-000000000003','11111111-1111-4111-8111-111111111111','20000000-0000-4000-8000-000000000003'),
 ('40000000-0000-4000-8000-000000000004','11111111-1111-4111-8111-111111111111','20000000-0000-4000-8000-000000000004'),
 ('40000000-0000-4000-8000-000000000005','11111111-1111-4111-8111-111111111111','20000000-0000-4000-8000-000000000001');
INSERT INTO p0e_preview.synthetic_owner_proofs VALUES
 ('fake-verified-A','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true,now()+interval '1 day'),
 ('fake-verified-B','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true,now()+interval '1 day'),
 ('fake-verified-C','22222222-2222-4222-8222-222222222222','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true,now()+interval '1 day'),
 ('fake-expired-A','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true,now()-interval '1 day');
INSERT INTO p0e_preview.trusted_candidates VALUES
 ('product','20000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','fake-verified-A'),
 ('product','20000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','fake-verified-B'),
 ('product','20000000-0000-4000-8000-000000000004','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','fake-verified-A'),
 ('product','20000000-0000-4000-8000-000000000004','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','fake-verified-B'),
 ('product','20000000-0000-4000-8000-000000000005','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','fake-expired-A'),
 ('product','20000000-0000-4000-8000-000000000006','22222222-2222-4222-8222-222222222222','cccccccc-cccc-4ccc-8ccc-cccccccccccc','fake-verified-C'),
 ('order','40000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','fake-verified-A'),
 ('order','40000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','fake-verified-B'),
 ('order','40000000-0000-4000-8000-000000000004','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','fake-verified-A'),
 ('order','40000000-0000-4000-8000-000000000005','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','fake-verified-B');

-- Reject any synthetic evidence that mismatches its tenant-store composite FK.
DO $negative$
DECLARE err text := '';
BEGIN
 BEGIN
  INSERT INTO p0e_preview.trusted_candidates VALUES(
   'product','20000000-0000-4000-8000-000000000003',
   '22222222-2222-4222-8222-222222222222',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','fake-verified-A');
 EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS err=RETURNED_SQLSTATE;
 END;
 IF err<>'23503' THEN RAISE EXCEPTION 'FAIL_CROSS_TENANT_PROOF_EXPECTED_23503_GOT_%',err; END IF;
 RAISE NOTICE 'PASS_CROSS_TENANT_PROOF_REJECTED';
END $negative$;

-- Preview-only expansion of legacy tables; these are synthetic tables.
ALTER TABLE p0e_preview.legacy_products ADD COLUMN store_id uuid;
ALTER TABLE p0e_preview.legacy_orders ADD COLUMN store_id uuid;
CREATE VIEW p0e_preview.product_evidence AS
SELECT p.id,p.tenant_id,
 count(c.proof_id) AS candidate_count,
 count(c.proof_id) FILTER (WHERE proof.verified AND proof.expires_at>now()
  AND st.is_active AND p.tenant_id=c.tenant_id) AS valid_count,
 (array_agg(c.store_id) FILTER (WHERE proof.verified AND proof.expires_at>now()
  AND st.is_active AND p.tenant_id=c.tenant_id))[1] AS proposed_store_id
FROM p0e_preview.legacy_products p
LEFT JOIN p0e_preview.trusted_candidates c
 ON c.resource_type='product' AND c.resource_id=p.id AND c.tenant_id=p.tenant_id
LEFT JOIN p0e_preview.synthetic_owner_proofs proof
 ON proof.proof_id=c.proof_id AND proof.tenant_id=c.tenant_id AND proof.store_id=c.store_id
LEFT JOIN p0e_preview.stores st
 ON st.tenant_id=c.tenant_id AND st.store_id=c.store_id
GROUP BY p.id,p.tenant_id;
CREATE VIEW p0e_preview.product_classification AS
SELECT id,tenant_id,proposed_store_id,
 CASE WHEN valid_count=1 THEN 'ASSIGNABLE'
      WHEN valid_count>1 THEN 'AMBIGUOUS'
      WHEN candidate_count=0 THEN 'UNMAPPED'
      ELSE 'INVALID_OR_EXPIRED' END AS status
FROM p0e_preview.product_evidence;

-- Assign only uniquely verified synthetic evidence; never infer a default Store.
UPDATE p0e_preview.legacy_products p SET store_id=c.proposed_store_id
 FROM p0e_preview.product_classification c
 WHERE p.id=c.id AND p.tenant_id=c.tenant_id AND c.status='ASSIGNABLE';

-- Orders require their *own* verified Store evidence AND product Store match.
CREATE VIEW p0e_preview.order_evidence AS
SELECT o.id,o.tenant_id,o.product_id,
 count(c.proof_id) AS candidate_count,
 count(c.proof_id) FILTER (WHERE proof.verified AND proof.expires_at>now()
 AND st.is_active AND o.tenant_id=c.tenant_id) AS valid_count,
 (array_agg(c.store_id) FILTER (WHERE proof.verified AND proof.expires_at>now()
 AND st.is_active AND o.tenant_id=c.tenant_id))[1] AS proposed_store_id
FROM p0e_preview.legacy_orders o
LEFT JOIN p0e_preview.trusted_candidates c
 ON c.resource_type='order' AND c.resource_id=o.id AND c.tenant_id=o.tenant_id
LEFT JOIN p0e_preview.synthetic_owner_proofs proof
 ON proof.proof_id=c.proof_id AND proof.tenant_id=c.tenant_id AND proof.store_id=c.store_id
LEFT JOIN p0e_preview.stores st
 ON st.tenant_id=c.tenant_id AND st.store_id=c.store_id
GROUP BY o.id,o.tenant_id,o.product_id;
CREATE VIEW p0e_preview.order_classification AS
SELECT e.id,e.tenant_id,e.proposed_store_id,
 CASE WHEN e.valid_count>1 THEN 'AMBIGUOUS'
 WHEN e.valid_count=0 AND e.candidate_count=0 THEN 'UNMAPPED'
 WHEN e.valid_count<>1 THEN 'INVALID_OR_EXPIRED'
 WHEN p.store_id IS NULL THEN 'PRODUCT_SCOPE_UNRESOLVED'
 WHEN p.store_id<>e.proposed_store_id THEN 'CROSS_STORE_PRODUCT_MISMATCH'
 ELSE 'ASSIGNABLE' END AS status
FROM p0e_preview.order_evidence e
JOIN p0e_preview.legacy_products p ON p.id=e.product_id AND p.tenant_id=e.tenant_id;
UPDATE p0e_preview.legacy_orders o SET store_id=c.proposed_store_id
 FROM p0e_preview.order_classification c
 WHERE o.id=c.id AND o.tenant_id=c.tenant_id AND c.status='ASSIGNABLE';

-- Exact assertions: 6 products, 3 assigned (A/B/C), 3 quarantined;
-- 5 orders, 2 assigned, 3 quarantined including an explicit A/B mismatch.
DO $result$
DECLARE assigned_p int; remaining_p int; assigned_o int; remaining_o int;
BEGIN
 SELECT count(*) FILTER(WHERE store_id IS NOT NULL),
        count(*) FILTER(WHERE store_id IS NULL)
 INTO assigned_p,remaining_p FROM p0e_preview.legacy_products;
 SELECT count(*) FILTER(WHERE store_id IS NOT NULL),
        count(*) FILTER(WHERE store_id IS NULL)
 INTO assigned_o,remaining_o FROM p0e_preview.legacy_orders;
 IF ARRAY[assigned_p,remaining_p,assigned_o,remaining_o]<>ARRAY[3,3,2,3]
 THEN RAISE EXCEPTION 'P0E_PREVIEW_COUNT_REGRESSION_%',ARRAY[assigned_p,remaining_p,assigned_o,remaining_o]; END IF;
 IF (SELECT count(*) FROM p0e_preview.product_classification WHERE status='AMBIGUOUS')<>1
 OR (SELECT count(*) FROM p0e_preview.product_classification WHERE status='INVALID_OR_EXPIRED')<>1
 OR (SELECT count(*) FROM p0e_preview.product_classification WHERE status='UNMAPPED')<>1
 OR (SELECT count(*) FROM p0e_preview.order_classification WHERE status='CROSS_STORE_PRODUCT_MISMATCH')<>1
 THEN RAISE EXCEPTION 'P0E_QUARANTINE_CLASSIFICATION_REGRESSION'; END IF;
 RAISE NOTICE 'PASS_P0E_ASSIGN_ONLY_UNIQUE_VERIFIED_OWNER_SCOPE_3_OF_6_PRODUCTS';
 RAISE NOTICE 'PASS_P0E_ORDER_REQUIRES_EXACT_OWN_SCOPE_AND_PRODUCT_MATCH_2_OF_5_ORDERS';
 RAISE NOTICE 'PASS_P0E_UNMAPPED_AMBIGUOUS_EXPIRED_AND_MISMATCH_QUARANTINED';
END $result$;

DO $finalization$
DECLARE err text:='';
BEGIN
 BEGIN
  ALTER TABLE p0e_preview.legacy_products ALTER COLUMN store_id SET NOT NULL;
 EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS err=RETURNED_SQLSTATE;
 END;
 IF err<>'23502' THEN RAISE EXCEPTION 'FAIL_UNPROVEN_PRODUCT_NOT_NULL_ENFORCEMENT_%',err; END IF;
 RAISE NOTICE 'PASS_P0E_FINAL_NOT_NULL_MUST_BLOCK_UNPROVEN_PRODUCT_ROWS';
END $finalization$;

-- This is the only intended outcome: the entire preview is rolled back.
ROLLBACK;
DO $postrollback$
BEGIN
 IF to_regnamespace('p0e_preview') IS NOT NULL
 THEN RAISE EXCEPTION 'P0E_PREVIEW_LEAKED_SCHEMA_AFTER_ROLLBACK'; END IF;
 RAISE NOTICE 'PASS_P0E_PREVIEW_COMPLETE_ROLLBACK_NO_PERSISTENT_SCHEMA';
 RAISE NOTICE 'P0E_M0_BACKUP_PROOF_DEFERRED_DISPOSABLE_ONLY';
END $postrollback$;
