-- TIEN404 V21.9 - Config Core source-to-staging PARITY ATTESTATION, SELECT ONLY.
-- Generated golden baseline from db/config-core/10_config_core.sql GitHub blob dea34da9c9324813fcf057428ea009c6ece3ada2.
-- Original source is PROPOSED; this query only attests exact named objects/definitions,
-- not original migration provenance or all permissions. No DDL, JWT, token or customer rows.
-- Never use this audit report as approval for hosted database changes.
WITH expected_cols(table_name,column_name,data_type,not_null) AS (VALUES
 ('action_types','action_type','text',true),
 ('action_types','status','text',true),
 ('action_types','title','text',true),
 ('action_types','registry_version','integer',true),
 ('industry_templates','template_key','text',true),
 ('industry_templates','version','integer',true),
 ('industry_templates','name','text',true),
 ('industry_templates','industry','text',true),
 ('industry_templates','config','jsonb',true),
 ('industry_templates','status','text',true),
 ('assistants','id','uuid',true),
 ('assistants','tenant_id','uuid',true),
 ('assistants','store_id','uuid',true),
 ('assistants','name','text',true),
 ('assistants','template_key','text',false),
 ('assistants','template_version','integer',false),
 ('assistants','status','text',true),
 ('assistants','created_by','uuid',false),
 ('assistants','created_at','timestamp with time zone',true),
 ('assistants','updated_at','timestamp with time zone',true),
 ('assistant_config_versions','id','uuid',true),
 ('assistant_config_versions','tenant_id','uuid',true),
 ('assistant_config_versions','store_id','uuid',true),
 ('assistant_config_versions','assistant_id','uuid',true),
 ('assistant_config_versions','version_no','integer',true),
 ('assistant_config_versions','state','text',true),
 ('assistant_config_versions','config','jsonb',true),
 ('assistant_config_versions','config_sha256','text',true),
 ('assistant_config_versions','source','text',true),
 ('assistant_config_versions','created_by','uuid',false),
 ('assistant_config_versions','created_at','timestamp with time zone',true),
 ('assistant_config_versions','updated_at','timestamp with time zone',true),
 ('assistant_config_versions','published_at','timestamp with time zone',false),
 ('assistant_config_versions','published_by','uuid',false),
 ('channel_connections','id','uuid',true),
 ('channel_connections','tenant_id','uuid',true),
 ('channel_connections','store_id','uuid',true),
 ('channel_connections','assistant_id','uuid',false),
 ('channel_connections','channel','text',true),
 ('channel_connections','external_account_id','text',true),
 ('channel_connections','display_name','text',false),
 ('channel_connections','environment','text',true),
 ('channel_connections','status','text',true),
 ('channel_connections','created_at','timestamp with time zone',true),
 ('channel_connections','updated_at','timestamp with time zone',true)
), cols_actual AS (
 SELECT c.relname::text table_name,a.attname::text column_name,
        format_type(a.atttypid,a.atttypmod)::text data_type,a.attnotnull not_null
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
 WHERE n.nspname='public'
   AND c.relname IN ('action_types','industry_templates','assistants','assistant_config_versions','channel_connections')
), col_diff AS (
 SELECT coalesce(e.table_name,a.table_name) rel,coalesce(e.column_name,a.column_name) name,
 CASE WHEN e.column_name IS NULL THEN 'extra_column'
 WHEN a.column_name IS NULL THEN 'missing_column'
 WHEN e.data_type<>a.data_type THEN 'type_drift'
 WHEN e.not_null<>a.not_null THEN 'nullability_drift'
 ELSE NULL END AS discrepancy
 FROM expected_cols e FULL JOIN cols_actual a
 ON e.table_name=a.table_name AND e.column_name=a.column_name
), expected_bodies(nsp,name,md5_digest) AS (VALUES
 ('app_private','t404_acv_guard','680143a5126d9da66139da60cb350d0a'),
 ('app_private','t404_cfg_lock_assistant','1a7508d94d374318bd4c5ee00c98de4a'),
 ('app_private','t404_cfg_manager_tenant','edb143eb13f712d2f93aef622ae63f58'),
 ('app_private','t404_cfg_sha','c352c5fe4a2373b4cacabf7d83b06646'),
 ('app_private','t404_cfg_validate','b5b318b342140ee26237ec3f66d55a05'),
 ('public','create_assistant','3c4f587b2f458f42250888f855cf7f58'),
 ('public','publish_assistant_config','5c7f446ed8310046faf542f45313d44d'),
 ('public','resolve_channel_assistant','b3f4bdc745a39b4a786425a7e4f5f787'),
 ('public','rollback_assistant_config','3ade7e20a95c58d004a1d884c0c4d8d3'),
 ('public','save_assistant_draft','c439bae849f031eb40594fba8a9c4137')
), fn_diff AS (
 SELECT e.nsp,e.name,CASE WHEN p.oid IS NULL THEN 'function_missing'
 WHEN md5(p.prosrc)<>e.md5_digest THEN 'function_body_drift'
 WHEN p.proname='resolve_channel_assistant' AND
  (has_function_privilege('anon',p.oid,'EXECUTE') OR
   has_function_privilege('authenticated',p.oid,'EXECUTE')) THEN 'resolver_public_grant'
 WHEN n.nspname='public' AND p.proname<>'resolve_channel_assistant' AND
  (NOT has_function_privilege('authenticated',p.oid,'EXECUTE') OR
   has_function_privilege('anon',p.oid,'EXECUTE')) THEN 'rpc_grant_drift'
 WHEN n.nspname='app_private' AND
  (has_function_privilege('anon',p.oid,'EXECUTE') OR
   has_function_privilege('authenticated',p.oid,'EXECUTE')) THEN 'private_exposed'
 WHEN p.proname IN ('create_assistant','save_assistant_draft',
  'publish_assistant_config','rollback_assistant_config','resolve_channel_assistant',
  't404_cfg_manager_tenant','t404_cfg_lock_assistant') AND NOT p.prosecdef THEN 'missing_security_definer'
 WHEN coalesce(array_to_string(p.proconfig,','),'') NOT LIKE '%search_path=%' THEN 'missing_search_path'
 ELSE NULL END discrepancy
 FROM expected_bodies e LEFT JOIN pg_namespace n ON n.nspname=e.nsp
 LEFT JOIN pg_proc p ON p.pronamespace=n.oid AND p.proname=e.name
), expected_objects(rel,name,kind) AS (VALUES
 ('assistants','assistants_scope_key','constraint'),
 ('assistants','assistants_store_fk','constraint'),
 ('assistants','assistants_template_fk','constraint'),
 ('assistant_config_versions','acv_assistant_fk','constraint'),
 ('assistant_config_versions','acv_version_key','constraint'),
 ('assistant_config_versions','acv_published_meta','constraint'),
 ('assistant_config_versions','acv_one_draft','index'),
 ('assistant_config_versions','acv_one_published','index'),
 ('assistant_config_versions','t404_acv_guard','trigger'),
 ('channel_connections','channel_connections_account_key','constraint'),
 ('channel_connections','channel_connections_store_fk','constraint'),
 ('channel_connections','channel_connections_assistant_fk','constraint')
), object_diff AS (
 SELECT e.rel,e.name,e.kind,CASE
 WHEN e.kind='constraint' THEN EXISTS(SELECT 1 FROM pg_constraint c
 WHERE c.conrelid=to_regclass('public.'||e.rel) AND c.conname=e.name)
 WHEN e.kind='index' THEN EXISTS(SELECT 1 FROM pg_index i
 JOIN pg_class ci ON ci.oid=i.indexrelid
 WHERE i.indrelid=to_regclass('public.'||e.rel)
 AND ci.relname=e.name AND i.indisunique)
 ELSE EXISTS(SELECT 1 FROM pg_trigger t
 WHERE t.tgrelid=to_regclass('public.'||e.rel)
 AND t.tgname=e.name AND NOT t.tgisinternal)
 END present FROM expected_objects e
), expected_policies(rel,name) AS (VALUES
 ('action_types','action_types_auth_read'),
 ('industry_templates','industry_templates_auth_read'),
 ('assistants','assistants_store_member_read'),
 ('assistant_config_versions','acv_store_member_read'),
 ('channel_connections','channel_connections_store_member_read')
), policy_diff AS (
 SELECT e.rel,e.name,EXISTS(SELECT 1 FROM pg_policies p
 WHERE p.schemaname='public' AND p.tablename=e.rel AND p.policyname=e.name
 AND p.cmd='SELECT' AND p.roles @> ARRAY['authenticated']::name[]) AS present
 FROM expected_policies e
), table_acl AS (
 SELECT n.rel, c.oid IS NOT NULL AND c.relrowsecurity AND c.relforcerowsecurity AND
   has_table_privilege('authenticated',c.oid,'SELECT') AND
   NOT has_table_privilege('authenticated',c.oid,'INSERT') AND
   NOT has_table_privilege('authenticated',c.oid,'UPDATE') AND
   NOT has_table_privilege('anon',c.oid,'SELECT') AS safe
 FROM unnest(ARRAY['action_types','industry_templates','assistants','assistant_config_versions','channel_connections']) n(rel)
 LEFT JOIN pg_class c ON c.oid=to_regclass('public.'||n.rel)
), migration_state AS (
 SELECT count(*)::int tracked_total,
 count(*) FILTER(WHERE name ~* 'config.core|assistant.config')::int config_core_tracked_names
 FROM supabase_migrations.schema_migrations
)
SELECT 'T404_V219_SOURCE_PARITY_READONLY' AS marker,
 (SELECT count(*)::int FROM expected_cols) AS source_expected_columns,
 (SELECT count(*)::int FROM col_diff WHERE discrepancy IS NULL) AS matched_columns,
 (SELECT count(*)::int FROM col_diff WHERE discrepancy IS NOT NULL) AS column_discrepancies,
 (SELECT count(*)::int FROM expected_bodies) AS source_expected_function_bodies,
 (SELECT count(*)::int FROM fn_diff WHERE discrepancy IS NULL) AS matched_function_bodies_and_grants,
 (SELECT count(*)::int FROM fn_diff WHERE discrepancy IS NOT NULL) AS function_or_grant_discrepancies,
 (SELECT count(*)::int FROM object_diff WHERE present) AS matched_constraints_indexes_triggers,
 (SELECT count(*)::int FROM object_diff WHERE NOT present) AS missing_constraints_indexes_triggers,
 (SELECT count(*)::int FROM policy_diff WHERE present) AS matched_select_policies,
 (SELECT count(*)::int FROM policy_diff WHERE NOT present) AS missing_select_policies,
 (SELECT count(*)::int FROM table_acl WHERE safe) AS safe_rls_acl_tables,
 (SELECT count(*)::int FROM table_acl WHERE NOT coalesce(safe,false)) AS unsafe_rls_acl_tables,
 (SELECT config_core_tracked_names FROM migration_state) AS tracked_config_core_names,
 (SELECT tracked_total FROM migration_state) AS tracked_migrations,
 (SELECT coalesce(jsonb_agg(rel||'.'||name||':'||discrepancy),'[]'::jsonb)
  FROM col_diff WHERE discrepancy IS NOT NULL) AS column_drift_details,
 (SELECT coalesce(jsonb_agg(nsp||'.'||name||':'||discrepancy),'[]'::jsonb)
  FROM fn_diff WHERE discrepancy IS NOT NULL) AS function_drift_details,
 false AS authorization_to_apply_migration,
 false AS authorization_to_enable_meta_reactions;
