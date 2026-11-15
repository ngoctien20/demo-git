-- TIEN404 V14.4.3 — REAL STAGING READ-ONLY RPC CATALOG AUDIT.
-- SECURITY: metadata/boolean flags only; NEVER output pg_get_functiondef,
-- decrypted vault secrets, request headers, Auth JWTs or customer content.
-- Project ref must be verified separately: ifxlvrhyjhbzbrkdsida.
WITH audited AS (
 SELECT n.nspname as schema_name,p.proname,
        pg_get_function_identity_arguments(p.oid) as args,
        pg_get_userbyid(p.proowner) as owner_name,p.prosecdef,
        p.proconfig::text as settings,p.proconfig as config_array,p.proacl,
        p.oid,p.proowner,
        lower(pg_get_functiondef(p.oid)) as body
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE (n.nspname='public' AND p.proname IN
         ('save_merchant_product','qa_owner_pairing','qa_shop_b_zalo_claim'))
    OR (n.nspname='tien404_r1_qa' AND p.proname IN
         ('issue_owner_challenge','confirm_owner_pairing_v3_qa','claim_owner_pairing_v3_synthetic'))
), grant_flags AS (
 SELECT a.*,has_function_privilege('anon',a.oid,'EXECUTE') as anon_execute,
       has_function_privilege('authenticated',a.oid,'EXECUTE') as authenticated_execute,
       EXISTS(SELECT 1 FROM aclexplode(coalesce(a.proacl,acldefault('f',a.proowner))) acl
           WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE') as public_execute
 FROM audited a
)
SELECT jsonb_build_object(
 'schema',schema_name,'function',proname,
 'identity_arguments',args,
 'owner',owner_name,'security_definer',prosecdef,
 'setting_search_path',settings,
 'anon_execute',anon_execute,'authenticated_execute',authenticated_execute,
 'public_execute',public_execute,
 'locked_empty_search_path',array_position(config_array,'search_path=""') IS NOT NULL,
 'flags',jsonb_build_object(
   'uses_auth_uid',position('auth.uid()' in body)>0,
   'uses_tenant_membership',position('public.tenant_memberships' in body)>0,
   'uses_store_membership',position('public.store_memberships' in body)>0,
   'has_store_id_reference',position('store_id' in body)>0,
   'writes_products',position('insert into public.products' in body)>0 OR
      position('update public.products' in body)>0,
   'uses_vault_secret',position('vault.decrypted_secrets' in body)>0,
   'reads_request_headers',position('request.headers' in body)>0,
   'reads_qa_bot_registry',position('tien404_r1_qa.shop_bots' in body)>0,
   'has_qa_dry_run_guard',position('dry_run' in body)>0 AND position('synthetic_qa' in body)>0,
   'uses_hmac',position('extensions.hmac' in body)>0,
   'uses_lock',position('for update' in body)>0 OR position('for share' in body)>0,
   'calls_qa_pairing',position('tien404_r1_qa.' in body)>0
 )
) AS rpc_metadata
FROM grant_flags
ORDER BY schema_name,proname,args;
