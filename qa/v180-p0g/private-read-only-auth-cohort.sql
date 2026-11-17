-- TIEN404 AI V18.0-P0G — PRIVATE OPERATOR READ-ONLY AUTH COHORT CHECK.
-- Run ONLY against the authorized TIEN404 Supabase staging project,
-- in a private admin session. No personal rows, user IDs, session IDs,
-- email, phone, JWT, refresh token, credentials or secrets are returned.
-- This query measures cohort eligibility only. A stored session record is
-- NOT proof of a valid signed JWT, active session, or Store ownership.
BEGIN TRANSACTION READ ONLY;

WITH verified_memberships AS (
 SELECT m.tenant_id, m.user_id, m.role,
        (u.id IS NOT NULL
          AND u.deleted_at IS NULL
          AND coalesce(u.is_anonymous,false)=false
          AND (u.banned_until IS NULL OR u.banned_until < now())
          AND u.confirmed_at IS NOT NULL) AS eligible_user,
        EXISTS (
         SELECT 1 FROM auth.sessions s
         WHERE s.user_id=m.user_id
           AND (s.not_after IS NULL OR s.not_after>now())
        ) AS has_session_record
 FROM public.tenant_memberships m
 JOIN auth.users u ON u.id=m.user_id
 WHERE m.active
)
SELECT
 count(*) AS active_tenant_memberships,
 count(*) FILTER(WHERE role='owner') AS active_tenant_owners,
 count(*) FILTER(WHERE eligible_user) AS confirmed_non_banned_members,
 count(*) FILTER(WHERE eligible_user AND has_session_record)
   AS members_with_unexpired_session_record,
 (SELECT count(*) FROM (
    SELECT tenant_id FROM verified_memberships
    WHERE role='owner' AND eligible_user AND has_session_record
    GROUP BY tenant_id HAVING count(DISTINCT user_id)>=2
 ) groups_with_two_owners) AS tenants_with_two_owner_session_records,
 (SELECT count(*) FROM (
    SELECT tenant_id FROM verified_memberships
    WHERE eligible_user AND has_session_record
    GROUP BY tenant_id HAVING count(DISTINCT user_id)>=2
 ) groups_with_two_members) AS tenants_with_two_member_session_records
FROM verified_memberships;

SELECT
 (SELECT count(*) FROM tien404_r1_qa.owner_pairing_challenges) AS old_qa_challenges,
 (SELECT count(*) FROM tien404_r1_qa.owner_pairing_challenges
  WHERE expires_at>now() AND used_at IS NULL) AS unexpired_unused_old_qa_challenges,
 (SELECT count(*) FROM tien404_r1_qa.owner_pairing_claims_v3) AS qa_claims,
 (SELECT count(*) FROM tien404_r1_qa.owner_pairing_claims_v3
  WHERE status='confirmed') AS confirmed_qa_claims,
 (SELECT count(*) FROM tien404_v175_qa.channel_identity
  WHERE revoked_at IS NULL) AS qa_nonrevoked_channel_identity,
 (SELECT count(*) FROM tien404_v175_qa.order_ownership
  WHERE ownership_status='verified') AS qa_verified_order_ownership;

SELECT
 (SELECT count(*) FROM information_schema.tables
  WHERE table_schema='public' AND table_name='stores') AS canonical_stores_present,
 (SELECT count(*) FROM information_schema.tables
  WHERE table_schema='public' AND table_name='store_memberships') AS canonical_memberships_present,
 (SELECT count(*) FROM information_schema.columns
  WHERE table_schema='public'
  AND table_name IN ('products','orders','order_items','customers',
                     'conversations','messages','tenant_memberships')
  AND column_name='store_id') AS commerce_store_id_columns,
 (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='save_merchant_product'
    AND pg_get_functiondef(p.oid) ~* 'store_id') AS store_scoped_legacy_product_rpcs;

COMMIT;
-- END: SELECT-only aggregate proof. NEVER mark real JWT as VERIFIED from this.
