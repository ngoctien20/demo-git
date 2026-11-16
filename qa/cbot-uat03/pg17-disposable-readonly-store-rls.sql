-- TIEN404 CBOT-UAT-03: disposable PostgreSQL17 mechanical Store lookup test.
-- Designed for a NEW EPHEMERAL CI database. NEVER run against hosted Supabase.
-- This uses user-controlled app.qa_caller test GUC, NOT actual signed JWT proof.
\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE qa_cbot03_authenticated NOLOGIN;
CREATE ROLE qa_cbot03_anon NOLOGIN;
CREATE SCHEMA qa_cbot03;

CREATE TABLE qa_cbot03.tenants(id text PRIMARY KEY);
CREATE TABLE qa_cbot03.stores (
 id text PRIMARY KEY, tenant_id text NOT NULL REFERENCES qa_cbot03.tenants(id),
 UNIQUE(tenant_id,id)
);
CREATE TABLE qa_cbot03.memberships (
 user_id text NOT NULL, tenant_id text NOT NULL,store_id text NOT NULL,active boolean NOT NULL,
 PRIMARY KEY(user_id,store_id),
 FOREIGN KEY (tenant_id,store_id) REFERENCES qa_cbot03.stores(tenant_id,id)
);
CREATE TABLE qa_cbot03.orders(
 id text PRIMARY KEY,tenant_id text NOT NULL,store_id text NOT NULL,
 total_vnd bigint NOT NULL CHECK(total_vnd>=0),status text NOT NULL,
 FOREIGN KEY(tenant_id,store_id) REFERENCES qa_cbot03.stores(tenant_id,id)
);
INSERT INTO qa_cbot03.tenants VALUES('QA_TENANT_1'),('QA_TENANT_2');
INSERT INTO qa_cbot03.stores VALUES
 ('QA_STORE_A','QA_TENANT_1'),('QA_STORE_B','QA_TENANT_1'),('QA_STORE_C','QA_TENANT_2');
INSERT INTO qa_cbot03.memberships VALUES
 ('qa-owner-a','QA_TENANT_1','QA_STORE_A',true),
 ('qa-owner-b','QA_TENANT_1','QA_STORE_B',true),
 ('qa-owner-c','QA_TENANT_2','QA_STORE_C',true),
 ('qa-revoked','QA_TENANT_1','QA_STORE_A',false);
INSERT INTO qa_cbot03.orders VALUES
 ('QA-A','QA_TENANT_1','QA_STORE_A',318000,'pending'),
 ('QA-B','QA_TENANT_1','QA_STORE_B',184000,'pending'),
 ('QA-C','QA_TENANT_2','QA_STORE_C',190000,'pending');

ALTER TABLE qa_cbot03.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_cbot03.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_cbot03.memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE qa_cbot03.orders FORCE ROW LEVEL SECURITY;
CREATE POLICY membership_self ON qa_cbot03.memberships FOR SELECT
 TO qa_cbot03_authenticated USING (
  user_id=current_setting('app.qa_caller',true) AND active
 );
CREATE POLICY store_order_read ON qa_cbot03.orders FOR SELECT
 TO qa_cbot03_authenticated USING (
  EXISTS (SELECT 1 FROM qa_cbot03.memberships m
   WHERE m.user_id=current_setting('app.qa_caller',true) AND m.active
     AND m.tenant_id=orders.tenant_id AND m.store_id=orders.store_id)
 );
GRANT USAGE ON SCHEMA qa_cbot03 TO qa_cbot03_authenticated;
GRANT SELECT ON qa_cbot03.memberships, qa_cbot03.orders TO qa_cbot03_authenticated;

-- Test actual Postgres RLS mechanics under non-owner invoker role.
SET ROLE qa_cbot03_authenticated;
SELECT set_config('app.qa_caller','qa-owner-a',false);
SELECT (count(*)=1 AND min(id)='QA-A' AND sum(total_vnd)=318000) AS owner_a_only
 FROM qa_cbot03.orders \gset
\if :owner_a_only
\else
  \echo CBOT03_FAIL_OWNER_A_CROSS_STORE
  \quit 11
\endif
SELECT set_config('app.qa_caller','qa-owner-b',false);
SELECT (count(*)=1 AND min(id)='QA-B' AND sum(total_vnd)=184000) AS owner_b_only
 FROM qa_cbot03.orders \gset
\if :owner_b_only
\else
  \echo CBOT03_FAIL_OWNER_B_CROSS_STORE
  \quit 12
\endif
SELECT set_config('app.qa_caller','qa-owner-c',false);
SELECT (count(*)=1 AND min(id)='QA-C') AS owner_c_only
 FROM qa_cbot03.orders \gset
\if :owner_c_only
\else
  \echo CBOT03_FAIL_CROSS_TENANT
  \quit 13
\endif
SELECT set_config('app.qa_caller','qa-revoked',false);
SELECT (count(*)=0) AS revoked_owner_none
 FROM qa_cbot03.orders \gset
\if :revoked_owner_none
\else
  \echo CBOT03_FAIL_REVOKED_OWNER
  \quit 14
\endif
SELECT set_config('app.qa_caller','qa-unknown',false);
SELECT (count(*)=0) AS stranger_none
 FROM qa_cbot03.orders \gset
\if :stranger_none
\else
  \echo CBOT03_FAIL_UNKNOWN_OWNER
  \quit 15
\endif
SELECT (NOT has_table_privilege('qa_cbot03_authenticated','qa_cbot03.orders','UPDATE') AND
        NOT has_table_privilege('qa_cbot03_authenticated','qa_cbot03.orders','INSERT') AND
        NOT has_table_privilege('qa_cbot03_authenticated','qa_cbot03.orders','DELETE') AND
        NOT has_table_privilege('qa_cbot03_anon','qa_cbot03.orders','SELECT')) AS no_write_no_anon
 \gset
\if :no_write_no_anon
\else
  \echo CBOT03_FAIL_UNAUTHORIZED_GRANT
  \quit 16
\endif
RESET ROLE;
SELECT (count(*)=3 AND sum(total_vnd)=692000) AS preserved_totals
 FROM qa_cbot03.orders \gset
\if :preserved_totals
\else
  \echo CBOT03_FAIL_TOTALS
  \quit 17
\endif
ROLLBACK;
SELECT 'CBOT03_DISPOSABLE_PG17_RLS_MECHANICAL_PASS_NOT_HOSTED_JWT' AS status;
