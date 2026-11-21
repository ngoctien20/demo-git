-- Restores the ACL observed live on 2026-11-21: {postgres=X/postgres,anon=X/postgres}
-- Run only together with re-publishing n8n TIEN404_ZALO_V2_SHADOW_STAGING, and only with owner approval.
BEGIN;
GRANT EXECUTE ON FUNCTION public.qa_shop_b_zalo_claim(uuid,text,text,text) TO anon;
COMMIT;
