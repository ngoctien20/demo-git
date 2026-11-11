-- TIEN404 V10.1 staging-only emergency disable.
-- Keep existing product and audit rows intact. Auth UI editor must also be
-- disabled in its separately-deployed branch/build. This revokes the RPC
-- entry point without dropping any customer or QA data.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.save_merchant_product(
 uuid,text,text,bigint,boolean,integer,timestamptz
) FROM authenticated,anon,PUBLIC;
COMMIT;
-- Verify after execution:
-- SELECT has_function_privilege('authenticated',
--  'public.save_merchant_product(uuid,text,text,bigint,boolean,integer,timestamptz)',
--  'EXECUTE') AS must_be_false;
-- To re-enable only after renewed approval:
-- GRANT EXECUTE ON FUNCTION public.save_merchant_product(
--  uuid,text,text,bigint,boolean,integer,timestamptz
-- ) TO authenticated;
