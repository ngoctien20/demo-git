-- TIEN404 Config Core v1 — step 20: public read of a channel's PUBLISHED menu for bot adapters.
-- STATUS: PROPOSED (needs owner approval: new anon EXECUTE grant). Requires 10_config_core.sql.
--
-- Why anon: n8n has no Supabase credential except the publishable key, and the owner rule is
-- "never switch to service_role". The function returns ONLY what every customer of that channel
-- already sees (greeting, addressing, profile, button labels, links, contact text, handoff team)
-- for an ACTIVE connection with a PUBLISHED config. It never returns tenant/store/assistant ids,
-- drafts, history, audit data, disabled or experimental items. Unknown/disabled account -> NULL
-- (no way to enumerate tenants). Writes stay owner/manager RPC only.
-- Rollback: 80_channel_menu_read_rollback.sql
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $pre$ BEGIN
 IF to_regprocedure('public.resolve_channel_assistant(text,text)') IS NULL THEN RAISE EXCEPTION 'T404_CC20_PRECHECK_10_MISSING'; END IF;
 IF to_regprocedure('public.get_channel_menu(text,text)') IS NOT NULL THEN RAISE EXCEPTION 'T404_CC20_ALREADY_APPLIED'; END IF;
END $pre$;

CREATE FUNCTION public.get_channel_menu(p_channel text, p_external_account_id text)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT jsonb_build_object(
   'schema_version', v.config->'schema_version',
   'version_no', v.version_no,
   'config_sha256', v.config_sha256,
   'greeting', v.config->'greeting',
   'addressing', coalesce(v.config->'addressing','{}'::jsonb),
   'profile', coalesce(v.config->'profile','{}'::jsonb),
   'menu', coalesce((
     SELECT jsonb_agg(it ORDER BY (it->>'sort_order')::int, it->>'id')
     FROM jsonb_array_elements(v.config->'menu') it
     JOIN public.action_types a ON a.action_type = it->>'action_type' AND a.status = 'released'
     WHERE it->'enabled' = 'true'::jsonb), '[]'::jsonb))
 FROM public.channel_connections c
 JOIN public.stores s ON s.tenant_id=c.tenant_id AND s.id=c.store_id AND s.active
 JOIN public.assistants a ON a.tenant_id=c.tenant_id AND a.store_id=c.store_id AND a.id=c.assistant_id AND a.status='active'
 JOIN public.assistant_config_versions v ON v.assistant_id=a.id AND v.state='published'
 WHERE c.channel=p_channel AND c.external_account_id=p_external_account_id AND c.status='active'
   AND p_channel IN ('messenger','web','zalo_bot','zalo_oa','telegram')
   AND char_length(p_external_account_id) <= 128 $f$;
REVOKE ALL ON FUNCTION public.get_channel_menu(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_channel_menu(text,text) TO anon, authenticated, service_role;

SELECT 'T404_CC20_CHANNEL_MENU_READ_OK' AS marker;
COMMIT;
