-- TIEN404 V17.2C.40 — LIVE READ-ONLY Store Authority Release Gate.
-- SELECT ONLY. No JWT spoofing, no auth.users PII, no customer/order rows.
-- Tested directly via connected Supabase metadata-only SQL on 2026-11-18.
-- Re-run against the *actual* target before any approval; this cannot
-- substitute for signed owner sessions, real Store provenance or independent QA.
WITH actual AS (
 SELECT
 (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema='public'
   AND table_name IN ('orders','order_items','products','customers')
   AND column_name='store_id') AS commerce_store_column_count,
 (to_regclass('public.stores') IS NOT NULL AND
  to_regclass('public.store_memberships') IS NOT NULL) AS canonical_store_tables,
 (SELECT COUNT(*) FROM (
  SELECT tenant_id
  FROM public.tenant_memberships WHERE active AND role='owner'
  GROUP BY tenant_id HAVING COUNT(DISTINCT user_id)>=2
 ) pairs) AS tenants_with_owner_pair,
 (SELECT COUNT(DISTINCT user_id) FROM public.tenant_memberships
  WHERE active AND role='owner') AS distinct_active_owners,
 (SELECT COUNT(*) FROM pg_policies
  WHERE schemaname='public' AND tablename IN
     ('orders','order_items','products','customers')
   AND cmd='SELECT' AND permissive='PERMISSIVE'
   AND qual !~* 'store_id') AS unsafe_broad_read_policies,
 (SELECT COUNT(DISTINCT tablename) FROM pg_policies
  WHERE schemaname='public' AND tablename IN
     ('orders','order_items','products','customers')
   AND cmd='SELECT' AND qual ~* 'store_id') AS store_aware_read_tables,
 (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema='app_private' AND table_name='channel_secrets'
   AND column_name='store_id') AS channel_store_column_count,
 (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema='app_private' AND table_name='order_idempotency'
   AND column_name='store_id') AS order_idempotency_store_column_count,
 (SELECT COUNT(*) FROM pg_constraint con
  JOIN pg_class c ON c.oid=con.conrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname='products'
   AND con.contype='u'
   AND pg_get_constraintdef(con.oid) LIKE 'UNIQUE (tenant_id, store_id, sku)%'
 ) AS store_scoped_sku_unique_count,
 (SELECT COUNT(*) FROM pg_constraint con
  JOIN pg_class c ON c.oid=con.conrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname='orders'
   AND con.contype='c' AND con.conname='orders_status_check'
   AND pg_get_constraintdef(con.oid) LIKE '%reserved%'
   AND pg_get_constraintdef(con.oid) LIKE '%expired%'
 ) AS reservation_status_compat_count,
 has_table_privilege('authenticated','public.orders','SELECT') AS auth_can_read_orders,
 NOT has_table_privilege('authenticated','public.orders','INSERT')
 AND NOT has_table_privilege('authenticated','public.orders','UPDATE')
 AND NOT has_table_privilege('authenticated','public.orders','DELETE')
 AS direct_authenticated_order_write_denied,
 NOT has_table_privilege('anon','public.orders','SELECT') AS anon_order_read_denied,
 (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prosecdef AND p.prokind='f'
  AND has_function_privilege('anon',p.oid,'EXECUTE')
 ) AS anon_callable_public_security_definer_count
)
SELECT
 v.gate_id,v.priority,
 CASE WHEN v.kind='MANUAL' THEN 'NOT_TESTED'
 WHEN v.good THEN 'VERIFIED_PASS' ELSE 'VERIFIED_BLOCKED' END AS state,
 v.evidence
FROM actual a
CROSS JOIN LATERAL (VALUES
 ('A01','P1','STRUCTURAL',a.tenants_with_owner_pair>=1,
 'Same-tenant distinct active owner candidates exist; no session verified'),
 ('A02','P1','MANUAL',false,'Actual separate signed A/B JWT sessions and consent not supplied'),
 ('S01','P1','STRUCTURAL',a.canonical_store_tables,'Canonical stores/store_memberships tables both exist'),
 ('S02','P1','STRUCTURAL',a.commerce_store_column_count=4,'Orders, Items, Products, Customers each have store_id'),
 ('S03','P1','STRUCTURAL',a.store_aware_read_tables=4 AND a.unsafe_broad_read_policies=0,
 'All Commerce read RLS use Store and no broad permissive tenant policy remains'),
 ('S04','P1','STRUCTURAL',a.channel_store_column_count>0,'Trusted private channel installation binds exact Store'),
 ('S05','P1','STRUCTURAL',a.order_idempotency_store_column_count>0,
 'Order idempotency supports Store-qualified event scope'),
 ('S06','P1','STRUCTURAL',a.store_scoped_sku_unique_count>0,'Store-specific SKU uniqueness exists'),
 ('O01','P1','STRUCTURAL',a.reservation_status_compat_count>0,
 'Live Orders status supports candidate reserved and expired'),
 ('O02','P1','STRUCTURAL',a.direct_authenticated_order_write_denied,
 'Client authenticated direct Orders INSERT/UPDATE/DELETE denied'),
 ('O03','P1','STRUCTURAL',a.anon_order_read_denied,
 'Anonymous direct Orders SELECT denied'),
 ('W01','P1','MANUAL',false,
 'Published n8n Google Sheets writers not migrated to trusted Store-aware adapter'),
 ('W02','P1','MANUAL',false,
 'Privileged transactional order writer not independently audited with current actor'),
 ('C01','P1','MANUAL',false,
 'Real provider-signed identity and Messenger-to-Zalo consent not verified'),
 ('B01','P1','MANUAL',false,
 'Backup/restore, rollback, cost approval and independent security review missing'),
 ('SEC01','P1','STRUCTURAL',a.anon_callable_public_security_definer_count=0,
 'No anon-executable public SECURITY DEFINER function remains without review')
) AS v(gate_id,priority,kind,good,evidence)
ORDER BY v.gate_id;