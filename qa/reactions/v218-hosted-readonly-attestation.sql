-- TIEN404 V21.8 — Supabase hosted READ-ONLY staging readiness attestation.
-- Does not touch customer records, tenant identifiers, tokens, auth.users or storage.
-- Do NOT use this SELECT as an authorization to apply SQL or enable reactions.
-- Expected run: staging only; record report flags/hash, never passwords or IDs.
WITH
tracked AS (
  SELECT
    count(*)::int AS tracked_migrations,
    count(*) FILTER (WHERE name ~* '(config_core|config.core|assistant.config)')::int AS tracked_config_core,
    count(*) FILTER (WHERE name ~* '(reaction|meta_page_install)')::int AS tracked_reactions,
    count(*) FILTER (WHERE name ~* 'v20_store')::int AS tracked_v20
  FROM supabase_migrations.schema_migrations
),
objects AS (
  SELECT
    to_regclass('public.channel_connections') IS NOT NULL AS has_channel_registry,
    to_regclass('public.store_memberships') IS NOT NULL AS has_store_memberships,
    to_regclass('public.tenant_memberships') IS NOT NULL AS has_tenant_memberships,
    to_regclass('public.assistants') IS NOT NULL AS has_assistants,
    to_regclass('public.assistant_config_versions') IS NOT NULL AS has_assistant_config_versions,
    to_regclass('app_private.reaction_meta_apps') IS NOT NULL AS has_reaction_meta_apps,
    to_regclass('app_private.reaction_page_industries') IS NOT NULL AS has_reaction_page_install_proof,
    to_regclass('app_private.reaction_meta_nonce_claims') IS NOT NULL AS has_reaction_nonce_ledger,
    to_regclass('public.page_reaction_drafts') IS NOT NULL AS has_reaction_drafts,
    to_regprocedure('public.save_page_reaction_draft(uuid,jsonb,text)') IS NOT NULL AS has_save_reaction_draft_rpc,
    to_regprocedure('public.list_verified_reaction_pages(uuid)') IS NOT NULL AS has_list_verified_pages_rpc
),
rls AS (
  SELECT
    coalesce((SELECT relrowsecurity AND relforcerowsecurity
      FROM pg_class WHERE oid=to_regclass('public.channel_connections')), false) AS channels_force_rls,
    has_table_privilege('authenticated','public.channel_connections','SELECT') AS channels_auth_read,
    NOT has_table_privilege('authenticated','public.channel_connections','INSERT') AS channels_auth_no_insert,
    NOT has_table_privilege('authenticated','public.channel_connections','UPDATE') AS channels_auth_no_update,
    NOT has_table_privilege('anon','public.channel_connections','SELECT') AS channels_anon_no_read,
    EXISTS(SELECT 1 FROM pg_policies
       WHERE schemaname='public' AND tablename='channel_connections'
         AND cmd='SELECT' AND policyname='channel_connections_store_member_read')
      AS channel_member_policy
),
shape AS (
 SELECT md5(coalesce(string_agg(
   n.nspname||'.'||c.relname||'.'||a.attnum||'.'||a.attname||':'||
   format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull::text,
   E'\n' ORDER BY n.nspname,c.relname,a.attnum),'none')) AS config_catalog_shape_md5
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
 WHERE n.nspname='public'
   AND c.relname IN ('channel_connections','store_memberships','tenant_memberships',
        'stores','assistants','assistant_config_versions')
),
counts AS (
 SELECT count(*)::int AS messenger_demo_active_connections
 FROM public.channel_connections
 WHERE channel='messenger' AND environment='demo' AND status='active'
)
SELECT
 'T404_V218_READONLY_HOSTED_PREFLIGHT' AS marker,
 current_setting('server_version') AS pg_version,
 tracked.*,objects.*,rls.*,shape.*,counts.*,
 'UNVERIFIED_NO_REAL_META_OAUTH_PROOF'::text AS meta_oauth_status,
 'UNVERIFIED_NO_REAL_TWO_JWT_UAT'::text AS real_owner_ab_jwt_status,
 'RESTORE_OF_THIS_REACTION_SNAPSHOT_NOT_ATTESTED'::text AS restore_status,
 false AS migration_admission_authorized,
 false AS meta_reaction_send_authorized
FROM tracked CROSS JOIN objects CROSS JOIN rls CROSS JOIN shape CROSS JOIN counts;
