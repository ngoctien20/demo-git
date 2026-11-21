-- Restores the ACL observed live on 2026-11-21: {postgres=X/postgres,anon=X/postgres}
BEGIN;
GRANT  EXECUTE ON FUNCTION public.qa_shop_b_zalo_claim(uuid,text,text,text) TO anon;
REVOKE EXECUTE ON FUNCTION public.qa_shop_b_zalo_claim(uuid,text,text,text) FROM service_role;
COMMIT;
