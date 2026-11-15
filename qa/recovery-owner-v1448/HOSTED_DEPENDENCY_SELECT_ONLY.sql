-- TIEN404 AI V14.4.8 | HOSTED METADATA/AGGREGATES ONLY
-- STRICT: SELECT only; no raw row UUID, tenant/user/store ID, customer,
-- phone, order total, JWT, vault secret, credential, exported Auth profile.
-- Target project must be checked by operator as tien404-staging.
-- DO NOT paste raw Auth/Orders/Products snapshots into GitHub or a chat.
WITH
 app_auth_fk AS (
  SELECT ns.nspname::text AS schema_name, cl.relname::text AS table_name,
         count(*)::int AS fk_count
  FROM pg_constraint k
  JOIN pg_class cl ON cl.oid=k.conrelid
  JOIN pg_namespace ns ON ns.oid=cl.relnamespace
  JOIN pg_class target ON target.oid=k.confrelid
  JOIN pg_namespace tn ON tn.oid=target.relnamespace
  WHERE k.contype='f' AND tn.nspname='auth' AND target.relname='users'
    AND ns.nspname IN ('public','app_private','factory_private',
       'tien404_dialogue_private','tien404_r1_qa')
  GROUP BY ns.nspname,cl.relname
 ),
 tenant_scope AS (
  SELECT tenant_id FROM public.products
  UNION
  SELECT tenant_id FROM public.orders
 ),
 scoped_counts AS (
  SELECT row_number() OVER(ORDER BY t.tenant_id)::int AS group_ordinal,
    (SELECT count(*) FROM public.products p WHERE p.tenant_id=t.tenant_id)::int AS products,
    (SELECT count(*) FROM public.orders o WHERE o.tenant_id=t.tenant_id)::int AS orders,
    (SELECT count(*) FROM public.tenant_memberships tm
      WHERE tm.tenant_id=t.tenant_id AND tm.active AND tm.role='owner')::int AS active_owners,
    (SELECT count(*) FROM public.tenant_memberships tm JOIN auth.users au ON au.id=tm.user_id
      WHERE tm.tenant_id=t.tenant_id AND tm.active AND tm.role='owner')::int AS auth_matched_owners
  FROM tenant_scope t
 )
SELECT jsonb_build_object(
  'mode','HOSTED_READ_ONLY_AGGREGATE',
  'postgres_major',split_part(current_setting('server_version'),'.',1),
  'auth_users',(SELECT count(*) FROM auth.users),
  'auth_fk_table_count',(SELECT count(*) FROM app_auth_fk),
  'auth_fk_total',(SELECT coalesce(sum(fk_count),0) FROM app_auth_fk),
  'auth_fk_graph',(SELECT coalesce(jsonb_agg(jsonb_build_object(
      'schema',schema_name,'table',table_name,'fkCount',fk_count)
      ORDER BY schema_name,table_name),'[]'::jsonb) FROM app_auth_fk),
  'products',(SELECT count(*) FROM public.products),
  'orders',(SELECT count(*) FROM public.orders),
  'tenant_groups',(SELECT count(*) FROM tenant_scope),
  'anonymous_groups',(SELECT coalesce(jsonb_agg(jsonb_build_object(
      'groupOrdinal',group_ordinal,'products',products,'orders',orders,
      'activeOwners',active_owners,'authMatchedOwners',auth_matched_owners)
      ORDER BY group_ordinal),'[]'::jsonb) FROM scoped_counts),
  'stores_table_exists',to_regclass('public.stores') IS NOT NULL,
  'store_memberships_table_exists',to_regclass('public.store_memberships') IS NOT NULL
) AS v1448_read_only_dependency_evidence;
