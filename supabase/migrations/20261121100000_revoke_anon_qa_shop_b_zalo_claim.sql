-- Revoke anonymous EXECUTE on the SECURITY DEFINER RPC public.qa_shop_b_zalo_claim
-- and allow only service_role (server-side key held by n8n) to call it.
--
-- PREREQUISITE (do before applying): n8n workflow TIEN404_ZALO_V2_SHADOW_STAGING,
-- node "Submit pending claim for Shop B", must send a server-side secret key
-- (role service_role) instead of the publishable key. Otherwise the call returns 401/42501.
-- The x-tien404-pairing header gate inside the function is unchanged (defense in depth).
--
-- Rollback: qa/rpc-anon-revoke/rollback.sql

BEGIN;

-- Guard: abort if the function is missing or has drifted from the audited shape.
DO $$
DECLARE
  f regprocedure := to_regprocedure('public.qa_shop_b_zalo_claim(uuid,text,text,text)');
BEGIN
  IF f IS NULL THEN
    RAISE EXCEPTION 'qa_shop_b_zalo_claim(uuid,text,text,text) not found';
  END IF;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = f) THEN
    RAISE EXCEPTION 'qa_shop_b_zalo_claim is no longer SECURITY DEFINER; re-audit before changing grants';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = f AND proconfig @> ARRAY['search_path=""']) THEN
    RAISE EXCEPTION 'qa_shop_b_zalo_claim has no pinned empty search_path; re-audit';
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.qa_shop_b_zalo_claim(uuid,text,text,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.qa_shop_b_zalo_claim(uuid,text,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.qa_shop_b_zalo_claim(uuid,text,text,text) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.qa_shop_b_zalo_claim(uuid,text,text,text) TO service_role;

-- Post-condition: fail the migration if anon/authenticated can still execute.
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.qa_shop_b_zalo_claim(uuid,text,text,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.qa_shop_b_zalo_claim(uuid,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon/authenticated still have EXECUTE after revoke';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.qa_shop_b_zalo_claim(uuid,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role lacks EXECUTE after grant';
  END IF;
END $$;

COMMIT;
