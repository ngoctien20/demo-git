-- TIEN404 V21.5 - HOSTED READ-ONLY PRE-FLIGHT. No mutation, no credentials or identifiers returned.
-- Safe for the connected staging database. It CANNOT certify Meta OAuth or customer consent.
WITH
catalog AS (
  SELECT
    to_regclass('public.channel_connections') IS NOT NULL AS channel_registry,
    to_regclass('public.assistants') IS NOT NULL AS assistants,
    to_regclass('public.store_memberships') IS NOT NULL AS store_memberships,
    to_regclass('public.tenant_memberships') IS NOT NULL AS tenant_memberships,
    to_regclass('app_private.reaction_page_industries') IS NOT NULL AS verified_page_industries,
    to_regclass('public.page_reaction_drafts') IS NOT NULL AS reaction_drafts,
    to_regprocedure('public.save_page_reaction_draft(uuid,jsonb,text)') IS NOT NULL AS draft_save_rpc,
    to_regprocedure('public.list_verified_reaction_pages(uuid)') IS NOT NULL AS verified_page_list_rpc
),
privs AS (
 SELECT
  (SELECT c.relrowsecurity AND c.relforcerowsecurity
    FROM pg_class c WHERE c.oid=to_regclass('public.channel_connections')) AS rls_enabled_forced,
  has_table_privilege('authenticated','public.channel_connections','SELECT') AS authenticated_select,
  NOT has_table_privilege('authenticated','public.channel_connections','UPDATE') AS authenticated_no_direct_update,
  NOT has_table_privilege('authenticated','public.channel_connections','INSERT') AS authenticated_no_direct_insert,
  NOT has_table_privilege('anon','public.channel_connections','SELECT') AS anon_select_denied,
  EXISTS(SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='channel_connections'
    AND cmd='SELECT' AND policyname='channel_connections_store_member_read') AS scoped_read_policy_present
),
channel_count AS (
 SELECT
  count(*) FILTER (WHERE c.channel='messenger') AS messenger_connections,
  count(*) FILTER (WHERE c.channel='messenger' AND c.status='active'
    AND c.environment='demo' AND s.active AND a.status='active') AS active_demo_chain
 FROM public.channel_connections c
 LEFT JOIN public.stores s ON s.id=c.store_id AND s.tenant_id=c.tenant_id
 LEFT JOIN public.assistants a ON a.id=c.assistant_id AND a.tenant_id=c.tenant_id AND a.store_id=c.store_id
)
SELECT 'T404_V215_READONLY_PREFLIGHT_OK' AS check_marker,
 current_setting('server_version') AS database_version,
 catalog.*,
 privs.*,
 channel_count.*,
 'NO_META_INSTALLATION_ATTESTATION' AS provider_proof_status
FROM catalog CROSS JOIN privs CROSS JOIN channel_count;