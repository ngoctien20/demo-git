-- TIEN404 AI — V17.2C.40A LIVE OWNER A/B × CANONICAL STORE MAP GATE
-- SELECT ONLY: PostgreSQL 17 metadata, OWNER membership aggregates, QA provenance counts.
-- Absolutely no JWT, credential, customer/order payload or raw identity identifiers.
-- Passing any QA provenance check is NOT admission to production authorization.
WITH owner_pair_tenants AS (
  SELECT tenant_id
  FROM public.tenant_memberships
  WHERE active AND role='owner'
  GROUP BY tenant_id HAVING count(DISTINCT user_id)>=2
), qa_stores_per_pair AS (
 SELECT m.auth_tenant_id,count(DISTINCT m.store_key) AS stores
 FROM tien404_r1_qa.tenant_identity_map m
 JOIN owner_pair_tenants t ON t.tenant_id=m.auth_tenant_id
 GROUP BY m.auth_tenant_id
), qa_owner_chain AS (
 SELECT b.tenant_key,b.store_key,b.bot_key,
   c.confirmed_at IS NOT NULL AS has_confirmed_claim,
   ch.used_at IS NOT NULL AS has_consumed_challenge,
   EXISTS(SELECT 1 FROM public.tenant_memberships tm
     WHERE tm.tenant_id=m.auth_tenant_id AND tm.user_id=ch.requester_user_id
     AND tm.active AND tm.role='owner') AS requester_is_active_tenant_owner
 FROM tien404_r1_qa.owner_bindings b
 LEFT JOIN tien404_r1_qa.tenant_identity_map m
  USING(tenant_key,store_key,bot_key)
 LEFT JOIN tien404_r1_qa.owner_pairing_claims_v3 c
  ON c.tenant_key=b.tenant_key AND c.store_key=b.store_key
   AND c.bot_key=b.bot_key AND c.challenge_id=b.confirmed_challenge_id
 LEFT JOIN tien404_r1_qa.owner_pairing_challenges ch
  ON ch.tenant_key=b.tenant_key AND ch.store_key=b.store_key
   AND ch.bot_key=b.bot_key AND ch.challenge_id=b.confirmed_challenge_id
), metrics AS (
 SELECT
 (SELECT count(*) FROM owner_pair_tenants) AS owner_pair_tenant_count,
 (SELECT COALESCE(max(stores),0) FROM qa_stores_per_pair) AS max_qa_stores_on_pair_tenant,
 (SELECT count(*) FROM tien404_r1_qa.owner_bindings) AS qa_binding_count,
 (SELECT count(*) FROM qa_owner_chain WHERE has_confirmed_claim AND has_consumed_challenge
  AND requester_is_active_tenant_owner) AS complete_qa_owner_chains,
 (SELECT count(*) FROM tien404_r1_qa.shop_bots) AS qa_bot_count,
 (SELECT count(*) FROM tien404_r1_qa.shop_bots
  WHERE enabled_mode='dry_run' AND identity_status='synthetic_qa') AS qa_dry_run_bot_count,
 (SELECT count(*) FROM tien404_r1_qa.shop_bots b
  JOIN tien404_r1_qa.tenant_identity_map m USING(tenant_key,store_key,bot_key)
  JOIN public.tenants t ON t.id=m.auth_tenant_id) AS qa_bots_mapped_to_real_tenant,
 (to_regclass('public.stores') IS NOT NULL
  AND to_regclass('public.store_memberships') IS NOT NULL) AS canonical_store_schema_exists,
 (SELECT count(*) FROM information_schema.columns
  WHERE table_schema='public' AND table_name IN
  ('orders','order_items','products','customers') AND column_name='store_id') AS commerce_store_id_tables,
 (SELECT count(*) FROM pg_policies
  WHERE schemaname='public' AND tablename IN
  ('orders','order_items','products','customers') AND cmd='SELECT'
  AND permissive='PERMISSIVE' AND qual !~* 'store_id') AS broad_tenant_read_policies,
 (SELECT count(DISTINCT tablename) FROM pg_policies
  WHERE schemaname='public' AND tablename IN
  ('orders','order_items','products','customers') AND cmd='SELECT'
  AND qual ~* 'store_id') AS store_aware_read_tables,
 (SELECT count(*) FROM app_private.channel_secrets) AS db_private_channel_secrets_count,
 (SELECT count(*) FROM information_schema.columns
  WHERE table_schema='app_private' AND table_name='channel_secrets'
  AND column_name='store_id') AS db_channel_store_scopes,
 (SELECT count(*) FROM tien404_v175_qa.channel_identity) AS qa_cross_channel_proofs,
 (SELECT count(*) FROM tien404_v175_qa.auth_customer_binding) AS qa_auth_customer_proofs,
 (SELECT count(*) FROM tien404_v175_qa.order_ownership) AS qa_order_owner_proofs
)
SELECT gate_id,domain,
 CASE WHEN class='MANUAL' THEN 'NOT_TESTED'
 WHEN ready THEN 'VERIFIED_PASS' ELSE 'VERIFIED_BLOCKED' END AS result,
 evidence
FROM metrics m CROSS JOIN LATERAL (VALUES
 ('A01','REAL_AUTH','STRUCTURAL',m.owner_pair_tenant_count>=1,
   'A tenant with two distinct active owner accounts exists, but no Store access verified'),
 ('A02','STORE_AB','STRUCTURAL',m.max_qa_stores_on_pair_tenant>=2,
   'Same owner-pair tenant has at least two distinct QA Store mappings'),
 ('A03','PROVENANCE','STRUCTURAL',m.qa_binding_count>0
    AND m.complete_qa_owner_chains=m.qa_binding_count,
   'Every QA owner binding has confirmed claim, consumed challenge, active Auth tenant owner'),
 ('Q01','QA_BOUNDARY','STRUCTURAL',m.qa_bot_count>0
    AND m.qa_bot_count=m.qa_dry_run_bot_count,
   'All linked QA bots remain dry_run / synthetic_qa'),
 ('Q02','QA_LINKAGE','STRUCTURAL',m.qa_bot_count>0
    AND m.qa_bot_count=m.qa_bots_mapped_to_real_tenant,
   'All QA bots map via QA-only registry to existing Auth tenant IDs'),
 ('S01','CANONICAL','STRUCTURAL',m.canonical_store_schema_exists,
   'Production public.stores and store_memberships exist'),
 ('S02','CANONICAL','STRUCTURAL',m.commerce_store_id_tables=4,
   'Orders, order_items, products and customers all have canonical store_id'),
 ('S03','RLS','STRUCTURAL',m.store_aware_read_tables=4
    AND m.broad_tenant_read_policies=0,
   'All Commerce reads have Store-bound policies and no permissive broad tenant reader'),
 ('C01','CHANNEL','STRUCTURAL',m.db_private_channel_secrets_count>0
   AND m.db_channel_store_scopes>0,
   'Real DB-backed channel installation proof has Store scope'),
 ('C02','CROSS_CHANNEL','STRUCTURAL',m.qa_cross_channel_proofs>0,
   'Protected QA cross-channel identity proof data exists'),
 ('C03','AUTH_CUSTOMER','STRUCTURAL',m.qa_auth_customer_proofs>0,
   'Protected QA Auth-to-customer binding data exists'),
 ('C04','ORDER_OWNER','STRUCTURAL',m.qa_order_owner_proofs>0,
   'Protected QA Store-aware order ownership evidence exists'),
 ('M01','AUTH_SESSION','MANUAL',false,
   'Two separate real signed Auth A/B sessions have not been verified'),
 ('M02','PROVIDER','MANUAL',false,
   'Current signed provider installation receipt not verified under real Store authority'),
 ('M03','APPROVAL','MANUAL',false,
   'Owner consent, independent security review and release recovery approval not recorded')
) gate(gate_id,domain,class,ready,evidence)
ORDER BY gate_id;