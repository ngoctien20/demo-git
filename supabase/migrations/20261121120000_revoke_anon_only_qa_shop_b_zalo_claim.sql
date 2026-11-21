-- Option A (owner choice 2026-11-21): close anonymous EXECUTE on the SECURITY DEFINER QA RPC
-- public.qa_shop_b_zalo_claim WITHOUT granting it to any other API role (no service_role).
--
-- PREREQUISITE (owner-approved, done first): unpublish n8n workflow
-- TIEN404_ZALO_V2_SHADOW_STAGING (OgDZNSAvKEvhnAvn), the only known literal caller.
-- The QA Shop B pairing flow ("GHÉP") stops working after this migration. That is intended.
-- Function body and its x-tien404-pairing Vault header gate stay unchanged.
--
-- Rollback: qa/rpc-anon-revoke-option-a/rollback.sql

BEGIN;

-- Guard: abort if the function is missing or has drifted from the audited shape/ACL.
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
  IF has_function_privilege('service_role', f, 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role unexpectedly has EXECUTE; ACL drifted from audited value, re-audit';
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.qa_shop_b_zalo_claim(uuid,text,text,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.qa_shop_b_zalo_claim(uuid,text,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.qa_shop_b_zalo_claim(uuid,text,text,text) FROM authenticated;

-- Post-condition: no PostgREST API role may execute it.
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.qa_shop_b_zalo_claim(uuid,text,text,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.qa_shop_b_zalo_claim(uuid,text,text,text)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.qa_shop_b_zalo_claim(uuid,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'an API role can still EXECUTE qa_shop_b_zalo_claim after revoke';
  END IF;
END $$;

COMMIT;
