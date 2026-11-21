-- Offline fixture mirroring the live catalog shape (2026-11-21). No real secrets.
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto SCHEMA extensions;
CREATE SCHEMA vault;
CREATE TABLE vault.decrypted_secrets(name text primary key, decrypted_secret text);
INSERT INTO vault.decrypted_secrets VALUES ('qa_shop_b_zalo_claim_key', repeat('k',48));
REVOKE ALL ON SCHEMA vault FROM PUBLIC;
CREATE SCHEMA tien404_r1_qa;
CREATE TABLE tien404_r1_qa.calls(args text);
CREATE FUNCTION tien404_r1_qa.claim_owner_pairing_v3_synthetic(t text,s text,b text,c uuid,code text,r text,e text)
RETURNS boolean LANGUAGE sql AS $$ INSERT INTO tien404_r1_qa.calls VALUES (t||'/'||s||'/'||b); SELECT true $$;
REVOKE ALL ON SCHEMA tien404_r1_qa FROM PUBLIC;
GRANT USAGE ON SCHEMA public, extensions TO anon, authenticated, service_role;

-- Exact live definition (pg_get_functiondef, 2026-11-21)
CREATE OR REPLACE FUNCTION public.qa_shop_b_zalo_claim(p_challenge uuid, p_code text, p_sender text, p_event text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  gate text;
  supplied text := current_setting('request.headers',true)::jsonb ->> 'x-tien404-pairing';
BEGIN
  SELECT decrypted_secret INTO gate FROM vault.decrypted_secrets WHERE name='qa_shop_b_zalo_claim_key';
  IF gate IS NULL OR length(gate) < 43 OR supplied IS NULL OR length(supplied)>256 OR
    extensions.digest(supplied,'sha256') <> extensions.digest(gate,'sha256') THEN
    RAISE insufficient_privilege;
  END IF;
  IF p_challenge IS NULL OR p_code IS NULL OR p_code !~ '^[0-9a-f]{32}$'
     OR p_sender IS NULL OR length(p_sender) NOT BETWEEN 1 AND 128
     OR p_event IS NULL OR length(p_event) NOT BETWEEN 1 AND 128 THEN RETURN false; END IF;
  RETURN tien404_r1_qa.claim_owner_pairing_v3_synthetic('qa-tenant-b','qa-store-b','qa-bot-b',
    p_challenge,p_code,
    'qa-recipient-' || encode(extensions.hmac('recipient:'||p_sender,gate,'sha256'),'hex'),
    'qa-event-' || encode(extensions.hmac('event:'||p_event,gate,'sha256'),'hex'));
END $function$;
-- Live ACL: {postgres=X/postgres,anon=X/postgres}
REVOKE EXECUTE ON FUNCTION public.qa_shop_b_zalo_claim(uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qa_shop_b_zalo_claim(uuid,text,text,text) TO anon;
