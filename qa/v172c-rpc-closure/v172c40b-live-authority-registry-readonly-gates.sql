-- V17.2C.40B — REAL REGISTRY / ALIAS MIGRATION ADMISSION READ-ONLY
-- SELECT-only, count/metadata only. Never queries secrets, JWTs or customer rows.
-- No approval or mapping is created here. Source registry remains NOT APPROVED.
WITH pair_tenants AS (
  SELECT tenant_id
  FROM public.tenant_memberships
  WHERE active AND role='owner'
  GROUP BY tenant_id HAVING count(DISTINCT user_id)>=2
), qa_store_counts AS (
 SELECT tenant_id,count(DISTINCT store_key) AS store_count
 FROM (
  SELECT m.auth_tenant_id AS tenant_id,m.store_key
  FROM tien404_r1_qa.tenant_identity_map m
 ) v GROUP BY tenant_id
), binding_chain AS (
 SELECT b.tenant_key,b.store_key,b.bot_key,
    (b.confirmed_challenge_id IS NOT NULL
     AND c.confirmed_at IS NOT NULL
     AND ch.used_at IS NOT NULL
     AND EXISTS (
      SELECT 1 FROM public.tenant_memberships m
      WHERE m.tenant_id=im.auth_tenant_id AND m.user_id=ch.requester_user_id
      AND m.active AND m.role='owner'
     )) AS verified_chain
 FROM tien404_r1_qa.owner_bindings b
 LEFT JOIN tien404_r1_qa.tenant_identity_map im
 ON im.tenant_key=b.tenant_key AND im.store_key=b.store_key
 AND im.bot_key=b.bot_key
 LEFT JOIN tien404_r1_qa.owner_pairing_claims_v3 c
 ON c.tenant_key=b.tenant_key AND c.store_key=b.store_key
 AND c.bot_key=b.bot_key AND c.challenge_id=b.confirmed_challenge_id
 LEFT JOIN tien404_r1_qa.owner_pairing_challenges ch
 ON ch.tenant_key=b.tenant_key AND ch.store_key=b.store_key
 AND ch.bot_key=b.bot_key AND ch.challenge_id=b.confirmed_challenge_id
), metrics AS (
 SELECT
 (SELECT count(*) FROM pair_tenants) AS paired_tenants,
 (SELECT coalesce(max(s.store_count),0) FROM qa_store_counts s
 JOIN pair_tenants p ON p.tenant_id=s.tenant_id) AS max_stores_in_owner_pair_tenant,
 (SELECT count(*) FROM tien404_r1_qa.shop_bots) AS qa_bots,
 (SELECT count(*) FROM tien404_r1_qa.shop_bots
 WHERE enabled_mode='dry_run' AND identity_status='synthetic_qa') AS dryrun_bots,
 (SELECT count(*) FROM tien404_r1_qa.shop_bots b
 JOIN tien404_r1_qa.tenant_identity_map im USING(tenant_key,store_key,bot_key)
 JOIN public.tenants t ON t.id=im.auth_tenant_id) AS bots_referenced_to_real_tenant,
 (SELECT count(*) FROM binding_chain) AS qa_bindings,
 (SELECT count(*) FROM binding_chain WHERE verified_chain) AS complete_qa_binding_chains,
 (to_regclass('public.stores') IS NOT NULL
  AND to_regclass('public.store_memberships') IS NOT NULL) AS canonical_store_tables,
 (SELECT count(*) FROM information_schema.columns
 WHERE table_schema='public' AND table_name IN
 ('orders','order_items','products','customers') AND column_name='store_id')
 AS store_columns,
 (SELECT count(DISTINCT tablename) FROM pg_policies
 WHERE schemaname='public' AND tablename IN
 ('orders','order_items','products','customers')
 AND cmd='SELECT' AND qual ~* 'store_id') AS store_rls_tables,
 (SELECT count(*) FROM pg_policies
 WHERE schemaname='public' AND tablename IN
 ('orders','order_items','products','customers')
 AND cmd='SELECT' AND permissive='PERMISSIVE'
 AND qual !~* 'store_id') AS broad_tenant_rls_policies,
 (SELECT count(*) FROM app_private.channel_secrets) AS real_channel_rows,
 (SELECT count(*) FROM information_schema.columns
 WHERE table_schema='app_private' AND table_name='channel_secrets'
 AND column_name='store_id') AS real_channel_store_columns,
 (SELECT count(*) FROM information_schema.columns
 WHERE table_schema='app_private' AND table_name='order_idempotency'
 AND column_name='store_id') AS idem_store_columns,
 (SELECT count(*) FROM pg_constraint co
 JOIN pg_class cl ON cl.oid=co.conrelid
 JOIN pg_namespace ns ON ns.oid=cl.relnamespace
 WHERE ns.nspname='public' AND cl.relname='products'
 AND co.contype='u' AND pg_get_constraintdef(co.oid)
 LIKE 'UNIQUE (tenant_id, store_id, sku)%') AS store_sku_unique_constraints
)
SELECT gate_id,domain,
 CASE WHEN gate_type='MANUAL' THEN 'NOT_TESTED'
 WHEN evidence_ok THEN 'VERIFIED_PASS'
 ELSE 'VERIFIED_BLOCKED' END AS state,
 detail
FROM metrics x CROSS JOIN LATERAL (VALUES
 ('OA-01','OWNER_PAIR','STRUCTURAL',x.paired_tenants>=1,
  'Same-tenant two distinct active owner candidates exist'),
 ('OA-02','STORE_AB','STRUCTURAL',x.max_stores_in_owner_pair_tenant>=2,
  'Two QA store aliases under the same paired owner tenant'),
 ('OA-03','OWNER_PROOF','STRUCTURAL',x.qa_bindings>0
  AND x.qa_bindings=x.complete_qa_binding_chains,
  'Every QA binding has a confirmed/consumed challenge from active tenant owner'),
 ('QA-01','QA_ONLY','STRUCTURAL',x.qa_bots>0 AND x.qa_bots=x.dryrun_bots,
  'All QA bots are dry_run synthetic_qa'),
 ('QA-02','QA_TENANT_REFERENCE','STRUCTURAL',x.qa_bots>0
  AND x.qa_bots=x.bots_referenced_to_real_tenant,
  'Every QA bot uses a QA foreign-key mapping to a real tenant'),
 ('ST-01','STORE_SCHEMA','STRUCTURAL',x.canonical_store_tables,
  'Canonical stores and store_memberships exist in public'),
 ('ST-02','COMMERCE_SCOPE','STRUCTURAL',x.store_columns=4,
  'Orders, order_items, products and customers have store_id'),
 ('RL-01','RLS','STRUCTURAL',x.store_rls_tables=4
  AND x.broad_tenant_rls_policies=0,
  'Store-specific RLS and removal of broad tenant reader'),
 ('CH-01','CHANNEL_AUTHORITY','STRUCTURAL',x.real_channel_rows>0
  AND x.real_channel_store_columns>0,
  'Protected channel registry binds actual store'),
 ('ID-01','IDEMPOTENCY','STRUCTURAL',x.idem_store_columns>0,
  'Store-scoped idempotency of protected Order writer'),
 ('SK-01','SKU','STRUCTURAL',x.store_sku_unique_constraints>0,
  'SKU uniqueness scoped by canonical tenant and store'),
 ('AP-01','OWNER_APPROVAL','MANUAL',false,
  'Two specific Store boundaries and owner approvals signed in protected server'),
 ('AL-01','ALIAS_PROVENANCE','MANUAL',false,
  'n8n alias crosswalk independently verified and conflict-free'),
 ('AU-01','REAL_AUTH_AB','MANUAL',false,
  'Two independent real signed sessions with approved Store memberships'),
 ('BK-01','BACKUP_RELEASE','MANUAL',false,
  'Backup/restore, no-write migration rehearsal and security reviewer approvals')
) g(gate_id,domain,gate_type,evidence_ok,detail)
ORDER BY gate_id;