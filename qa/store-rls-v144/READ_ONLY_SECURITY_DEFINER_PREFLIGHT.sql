-- TIEN404 V14.4A.1 — RPC SECURITY DEFINER READ-ONLY PREDEPLOY AUDIT
-- This inspects function metadata only; never executes any function, never
-- emits SQL function body, credentials, argument values or customer rows.
-- A source-text keyword match is a REVIEW SIGNAL only, not a proof that a
-- privileged function is vulnerable or safe. No grants or DDL here.
SELECT
 p.proname AS function_name,
 p.prosecdef AS security_definer,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_can_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_can_execute,
 (coalesce(array_to_string(p.proconfig,','),'') ~* 'search_path=') AS search_path_explicitly_set,
 (pg_get_functiondef(p.oid) ~* 'auth[.]uid[[:space:]]*[(]') AS mentions_auth_uid,
 (pg_get_functiondef(p.oid) ~* 'store_id') AS mentions_store_id,
 (pg_get_functiondef(p.oid) ~* 'tenant_id') AS mentions_tenant_id
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prosecdef
 AND p.proname IN ('qa_shop_b_zalo_claim','qa_owner_pairing','save_merchant_product')
ORDER BY p.proname;
-- Owner+independent security review required before new Store-RLS rollout:
--   qa_shop_b_zalo_claim: anon EXECUTE currently observed.
--   qa_owner_pairing / save_merchant_product: authenticated EXECUTE.
-- All three do not mention store_id in their function definition at audit time.
-- Do not alter/grant/revoke without separate approval and impact review.
