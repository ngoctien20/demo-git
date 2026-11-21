-- TIEN404 V23 web — contact-form leads. STATUS: PROPOSED (not applied anywhere).
-- Adds app_private.web_leads (no anon/authenticated access) and one SECURITY DEFINER RPC
-- public.submit_lead(...) that anon may EXECUTE. The RPC validates input, normalises VN phones,
-- and rate-limits: max 5 leads per phone/email per 24h and 300 leads per hour globally.
-- Nobody can READ leads through the API; staff read them with service access (Supabase dashboard).
-- Rollback: 90_leads_rollback.sql
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $pre$ BEGIN
 IF to_regclass('app_private.web_leads') IS NOT NULL THEN RAISE EXCEPTION 'T404_V23_LEADS_ALREADY_APPLIED'; END IF;
END $pre$;

CREATE TABLE app_private.web_leads(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
 shop text CHECK (shop IS NULL OR length(shop) <= 150),
 phone text CHECK (phone IS NULL OR phone ~ '^0[35789][0-9]{8}$'),
 email text CHECK (email IS NULL OR (length(email) <= 200 AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
 industry text CHECK (industry IS NULL OR length(industry) <= 60),
 plan text CHECK (plan IS NULL OR plan IN ('dung-thu','cua-hang','chuoi')),
 message text NOT NULL CHECK (length(btrim(message)) BETWEEN 5 AND 2000),
 source text CHECK (source IS NULL OR length(source) <= 60),
 status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','won','lost','spam')),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (phone IS NOT NULL OR email IS NOT NULL)
);
CREATE INDEX web_leads_created_idx ON app_private.web_leads(created_at DESC);
CREATE INDEX web_leads_phone_idx ON app_private.web_leads(phone, created_at) WHERE phone IS NOT NULL;
CREATE INDEX web_leads_email_idx ON app_private.web_leads(lower(email), created_at) WHERE email IS NOT NULL;
ALTER TABLE app_private.web_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.web_leads FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.web_leads FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.submit_lead(p_name text, p_shop text, p_phone text, p_email text,
  p_industry text, p_plan text, p_message text, p_source text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE ph text; em text;
BEGIN
 ph := nullif(regexp_replace(coalesce(p_phone,''), '[[:space:].()-]', '', 'g'), '');
 IF ph LIKE '+84%' THEN ph := '0' || substr(ph, 4); ELSIF ph ~ '^84[0-9]{9}$' THEN ph := '0' || substr(ph, 3); END IF;
 em := nullif(lower(btrim(coalesce(p_email,''))), '');
 IF (ph IS NOT NULL AND (SELECT count(*) FROM app_private.web_leads l
       WHERE l.phone = ph AND l.created_at > now() - interval '24 hours') >= 5)
    OR (em IS NOT NULL AND (SELECT count(*) FROM app_private.web_leads l
       WHERE lower(l.email) = em AND l.created_at > now() - interval '24 hours') >= 5)
    OR (SELECT count(*) FROM app_private.web_leads l WHERE l.created_at > now() - interval '1 hour') >= 300 THEN
  RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'P0001';
 END IF;
 BEGIN
  INSERT INTO app_private.web_leads(name,shop,phone,email,industry,plan,message,source)
  VALUES (btrim(p_name), nullif(btrim(p_shop),''), ph, em, nullif(btrim(p_industry),''),
          nullif(p_plan,''), btrim(p_message), left(p_source, 60));
 EXCEPTION WHEN check_violation OR not_null_violation THEN
  RAISE EXCEPTION 'invalid_lead' USING ERRCODE = '22023';
 END;
 RETURN true;
END $f$;
REVOKE ALL ON FUNCTION public.submit_lead(text,text,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_lead(text,text,text,text,text,text,text,text) TO anon, authenticated;

DO $post$ BEGIN
 IF has_table_privilege('anon','app_private.web_leads','SELECT') OR has_table_privilege('authenticated','app_private.web_leads','SELECT') THEN
  RAISE EXCEPTION 'T404_V23_LEADS_READABLE'; END IF;
 RAISE NOTICE 'T404_V23_LEADS_OK';
END $post$;
COMMIT;
