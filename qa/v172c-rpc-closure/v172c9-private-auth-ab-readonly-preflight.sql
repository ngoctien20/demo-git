-- TIEN404 V17.2C.9: READ-ONLY QA admission evidence.
-- No identities, phone numbers, JWTs, session tokens or store keys returned.
-- auth.sessions records are NOT proof of currently valid or owned JWTs.
-- No real consent can be inferred from owner membership.
WITH owner_groups AS (
 SELECT m.tenant_id,
   count(DISTINCT m.user_id) AS active_auth_owners,
   count(DISTINCT m.user_id) FILTER (WHERE s.user_id IS NOT NULL) AS owner_auth_users_with_session_records
 FROM public.tenant_memberships m
 JOIN auth.users u ON u.id=m.user_id
 LEFT JOIN (SELECT DISTINCT user_id FROM auth.sessions) s ON s.user_id=m.user_id
 WHERE m.active AND m.role='owner'
 GROUP BY m.tenant_id
), qa_store_groups AS (
 SELECT auth_tenant_id, count(DISTINCT store_key) AS qa_store_keys
 FROM tien404_r1_qa.tenant_identity_map GROUP BY auth_tenant_id
), metrics AS (
 SELECT
  (SELECT count(*) FROM auth.users)::int AS auth_users,
  (SELECT count(*) FROM auth.sessions)::int AS session_rows_historical_not_current_jwt_proof,
  (SELECT count(*) FROM owner_groups WHERE active_auth_owners>=2)::int AS tenants_with_two_active_owners,
  (SELECT count(*) FROM owner_groups WHERE owner_auth_users_with_session_records>=2)::int AS tenants_with_two_owner_session_records,
  (SELECT count(*) FROM qa_store_groups WHERE qa_store_keys>=2)::int AS tenants_with_two_qa_store_keys,
  (SELECT count(*) FROM owner_groups o JOIN qa_store_groups q ON q.auth_tenant_id=o.tenant_id WHERE o.active_auth_owners>=2 AND q.qa_store_keys>=2)::int AS tenants_with_owner_store_overlap,
  (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('stores','store_memberships','channel_installations'))::int AS canonical_store_tables,
  (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND column_name='store_id' AND table_name IN ('products','orders','customers','order_items','conversations','messages'))::int AS commerce_store_columns,
  (SELECT count(*) FROM public.products)::int AS product_rows_protected,
  (SELECT count(*) FROM public.orders)::int AS order_rows_protected
)
SELECT *,
 CASE WHEN tenants_with_two_owner_session_records = 0 OR tenants_with_two_qa_store_keys=0 OR canonical_store_tables=0 OR commerce_store_columns=0
 THEN 'NO_GO_STRUCTURAL_OR_IDENTITY_PRECONDITIONS'
 ELSE 'MANUAL_PRIVATE_CONSENT_AND_RECOVERY_REVIEW_REQUIRED'
 END AS automatic_preflight_result
FROM metrics;
