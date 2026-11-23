-- TIEN404 B-P1-05 rollback — removes the Order Ownership Gateway (functions + its 3 private tables).
-- Grants and challenges are short-lived (<= 30 min) security state; dropping them only forces customers
-- to request a new code. Orders, customers and audit_events are untouched. STATUS: DRAFT.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
DROP FUNCTION IF EXISTS public.order_ownership_revoke(uuid);
DROP FUNCTION IF EXISTS public.order_ownership_check(uuid,uuid,text);
DROP FUNCTION IF EXISTS public.order_ownership_verify_otp(uuid,text,text,text);
DROP FUNCTION IF EXISTS public.order_ownership_request_otp(uuid,uuid,text,text);
DROP FUNCTION IF EXISTS app_private.t404_og_requester(text);
DROP FUNCTION IF EXISTS app_private.t404_og_claim_nonce(text,text);
DROP FUNCTION IF EXISTS app_private.t404_og_pepper();
DROP FUNCTION IF EXISTS app_private.t404_og_sha(text);
DROP TABLE IF EXISTS app_private.order_access_grants;
DROP TABLE IF EXISTS app_private.order_ownership_challenges;
DROP TABLE IF EXISTS app_private.order_gateway_nonces;
DO $p$ BEGIN
 IF to_regclass('app_private.order_ownership_challenges') IS NOT NULL OR to_regprocedure('public.order_ownership_check(uuid,uuid,text)') IS NOT NULL THEN
  RAISE EXCEPTION 'T404_OG_ROLLBACK_INCOMPLETE'; END IF;
 RAISE NOTICE 'T404_OG_ROLLBACK_OK';
END $p$;
COMMIT;
