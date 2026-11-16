-- TIEN404 CBOT-UAT-04 — PRIVATE RPC REPLACEMENT DISPOSABLE PG17 QA ONLY.
-- Must run only against newly created ephemeral CI PostgreSQL17.
-- Not a hosted migration, not a real JWT or a live signature / gateway proof.
\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE qa_uat04_private_runtime NOLOGIN;
CREATE ROLE qa_uat04_anon NOLOGIN;
CREATE SCHEMA qa_uat04;

CREATE TABLE qa_uat04.stores (
 tenant_id text NOT NULL, store_id text NOT NULL,
 PRIMARY KEY(tenant_id,store_id)
);
CREATE TABLE qa_uat04.memberships (
 actor_id text NOT NULL,tenant_id text NOT NULL,store_id text NOT NULL,
 active boolean NOT NULL,PRIMARY KEY(actor_id,tenant_id,store_id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES qa_uat04.stores(tenant_id,store_id)
);
CREATE TABLE qa_uat04.orders(
 order_id text PRIMARY KEY,tenant_id text NOT NULL,store_id text NOT NULL,
 total_vnd bigint NOT NULL CHECK(total_vnd>0),status text NOT NULL,
 FOREIGN KEY(tenant_id,store_id) REFERENCES qa_uat04.stores(tenant_id,store_id)
);
INSERT INTO qa_uat04.stores VALUES
 ('QA_T1','QA_STORE_A'),('QA_T1','QA_STORE_B'),('QA_T2','QA_STORE_C');
INSERT INTO qa_uat04.memberships VALUES
 ('qa-owner-a','QA_T1','QA_STORE_A',true),
 ('qa-owner-b','QA_T1','QA_STORE_B',true),
 ('qa-owner-c','QA_T2','QA_STORE_C',true),
 ('qa-revoked','QA_T1','QA_STORE_A',false);
INSERT INTO qa_uat04.orders VALUES
 ('QA-A','QA_T1','QA_STORE_A',318000,'pending'),
 ('QA-B','QA_T1','QA_STORE_B',184000,'pending'),
 ('QA-C','QA_T2','QA_STORE_C',190000,'pending');
ALTER TABLE qa_uat04.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_uat04.orders FORCE ROW LEVEL SECURITY;
ALTER TABLE qa_uat04.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_uat04.memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY qa_self_membership ON qa_uat04.memberships FOR SELECT
 TO qa_uat04_private_runtime USING (
  active AND actor_id=current_setting('app.test_actor',true)
 );
CREATE POLICY qa_store_read ON qa_uat04.orders FOR SELECT
 TO qa_uat04_private_runtime USING (
  EXISTS (
   SELECT 1 FROM qa_uat04.memberships m
   WHERE m.active AND m.actor_id=current_setting('app.test_actor',true)
     AND m.tenant_id=orders.tenant_id AND m.store_id=orders.store_id
  )
 );
CREATE FUNCTION qa_uat04.lookup_order_readonly(p_order_id text)
 RETURNS TABLE(order_id text,total_vnd bigint,status text)
 LANGUAGE sql SECURITY INVOKER SET search_path=''
 AS $func$
 SELECT o.order_id,o.total_vnd,o.status
 FROM qa_uat04.orders o WHERE o.order_id=p_order_id
 $func$;
-- PUBLIC gets function EXECUTE implicitly by PG default. Revoke both so
-- only the private gateway runtime role can invoke this function.
REVOKE ALL ON FUNCTION qa_uat04.lookup_order_readonly(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION qa_uat04.lookup_order_readonly(text) FROM qa_uat04_anon;
GRANT USAGE ON SCHEMA qa_uat04 TO qa_uat04_private_runtime;
GRANT SELECT ON qa_uat04.orders,qa_uat04.memberships TO qa_uat04_private_runtime;
GRANT EXECUTE ON FUNCTION qa_uat04.lookup_order_readonly(text) TO qa_uat04_private_runtime;

-- Disposable legacy function remains callable so candidate shadow test does
-- not require an unsafe 'immediate REVOKE' action. This is NOT a real caller cutover.
CREATE FUNCTION qa_uat04.legacy_claim_simulated(p text) RETURNS text
 LANGUAGE sql SECURITY INVOKER SET search_path='' AS $func$ SELECT p $func$;
GRANT USAGE ON SCHEMA qa_uat04 TO qa_uat04_anon;
GRANT EXECUTE ON FUNCTION qa_uat04.legacy_claim_simulated(text) TO qa_uat04_anon;

SELECT (
 NOT has_function_privilege('qa_uat04_anon','qa_uat04.lookup_order_readonly(text)','EXECUTE')
 AND has_function_privilege('qa_uat04_private_runtime','qa_uat04.lookup_order_readonly(text)','EXECUTE')
 AND has_function_privilege('qa_uat04_anon','qa_uat04.legacy_claim_simulated(text)','EXECUTE')
 AND NOT has_table_privilege('qa_uat04_anon','qa_uat04.orders','SELECT')
 AND NOT has_table_privilege('qa_uat04_private_runtime','qa_uat04.orders','UPDATE')
 AND NOT has_table_privilege('qa_uat04_private_runtime','qa_uat04.orders','INSERT')
 AND NOT has_table_privilege('qa_uat04_private_runtime','qa_uat04.orders','DELETE')
) AS private_invoker_no_public_access \gset
\if :private_invoker_no_public_access
\else
 \echo CBOT04_FAIL_RPCS_GRANTS
 \quit 11
\endif
SELECT (
 p.prosecdef=false AND p.proconfig @> ARRAY['search_path=']::text[]
) AS invoker_and_search_path_pinned
 FROM pg_proc p
 WHERE p.oid='qa_uat04.lookup_order_readonly(text)'::regprocedure \gset
\if :invoker_and_search_path_pinned
\else
 \echo CBOT04_FAIL_INVOKER_SEARCHPATH
 \quit 12
\endif

SET ROLE qa_uat04_private_runtime;
SELECT set_config('app.test_actor','qa-owner-a',false);
SELECT (count(*)=1 AND min(order_id)='QA-A' AND sum(total_vnd)=318000) AS owner_a_only
 FROM qa_uat04.lookup_order_readonly('QA-A') \gset
\if :owner_a_only
\else
 \echo CBOT04_FAIL_OWNER_A
 \quit 13
\endif
SELECT (count(*)=0) AS owner_a_cannot_view_b
 FROM qa_uat04.lookup_order_readonly('QA-B') \gset
\if :owner_a_cannot_view_b
\else
 \echo CBOT04_FAIL_CROSS_STORE
 \quit 14
\endif
SELECT set_config('app.test_actor','qa-owner-b',false);
SELECT (count(*)=1 AND min(order_id)='QA-B') AS owner_b_only
 FROM qa_uat04.lookup_order_readonly('QA-B') \gset
\if :owner_b_only
\else
 \echo CBOT04_FAIL_OWNER_B
 \quit 15
\endif
SELECT (count(*)=0) AS owner_b_cannot_view_a
 FROM qa_uat04.lookup_order_readonly('QA-A') \gset
\if :owner_b_cannot_view_a
\else
 \echo CBOT04_FAIL_OWNER_B_CROSS_STORE
 \quit 16
\endif
SELECT set_config('app.test_actor','qa-owner-c',false);
SELECT (count(*)=1) AS owner_c_only FROM qa_uat04.lookup_order_readonly('QA-C') \gset
\if :owner_c_only
\else
 \echo CBOT04_FAIL_CROSS_TENANT
 \quit 17
\endif
SELECT set_config('app.test_actor','qa-revoked',false);
SELECT (count(*)=0) AS revoked_none FROM qa_uat04.lookup_order_readonly('QA-A') \gset
\if :revoked_none
\else
 \echo CBOT04_FAIL_REVOKED
 \quit 18
\endif
RESET ROLE;
SELECT (count(*)=3 AND sum(total_vnd)=692000) AS unchanged_qa_orders FROM qa_uat04.orders \gset
\if :unchanged_qa_orders
\else
 \echo CBOT04_FAIL_ORDER_TOTALS
 \quit 19
\endif
ROLLBACK;
SELECT 'CBOT04_PRIVATE_RPC_DISPOSABLE_PG17_PASS_NOT_HOSTED' AS result;
