-- TIEN404 V25 Daily Briefing sender (server side). STATUS: PROPOSED.
-- REQUIRES 10_workspace_settings.sql. Owner approved a briefing sender 2026-11-22 22:35Z.
--
-- How sending works (no service_role anywhere):
--   * n8n (Schedule every 15 min) calls public.briefing_claim_due_v1() through PostgREST with the
--     publishable key AND header x-t404-briefing-key. The key is a random 32-byte secret generated
--     INSIDE the database and kept in Supabase Vault ('t404_briefing_sender_key'); the owner copies it
--     once from the Vault UI into an n8n Header Auth credential. Nobody else ever sees it.
--   * claim returns at most 50 stores whose owner opted in, destination = email, local time
--     (Asia/Ho_Chi_Minh) is within 3 h after send_time, and nothing was claimed for that local date.
--     Each claim inserts one app_private.briefing_deliveries row (UNIQUE store + date) so a store is
--     never emailed twice a day even if n8n retries.
--   * Recipients = confirmed emails of ACTIVE owner/manager members of that Store only.
--   * Metrics are computed here from store-scoped tables (last 24 h); no AI, no guesses: a metric
--     without a source is returned as null and printed "chưa có dữ liệu".
--   * n8n sends the email (Gmail) and calls public.briefing_report_v1(delivery, ok, error).
-- Rollback: 80_briefing_sender_rollback.sql
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $pre$ BEGIN
 IF to_regclass('public.store_briefing_settings') IS NULL THEN RAISE EXCEPTION 'T404_V25_20_PRECHECK_10_MISSING'; END IF;
 IF to_regclass('vault.decrypted_secrets') IS NULL THEN RAISE EXCEPTION 'T404_V25_20_PRECHECK_VAULT_MISSING'; END IF;
 IF to_regprocedure('public.briefing_claim_due_v1()') IS NOT NULL THEN RAISE EXCEPTION 'T404_V25_20_ALREADY_APPLIED'; END IF;
END $pre$;

-- 1. Secret: generated here, stored only in Vault.
DO $key$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name='t404_briefing_sender_key') THEN
  PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'), 't404_briefing_sender_key', 'TIEN404 daily briefing sender (n8n header x-t404-briefing-key)');
 END IF;
END $key$;

CREATE FUNCTION app_private.t404_briefing_caller_ok() RETURNS boolean
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $f$
DECLARE got text; want text;
BEGIN
 got := nullif(current_setting('request.headers', true),'')::json->>'x-t404-briefing-key';
 SELECT s.decrypted_secret INTO want FROM vault.decrypted_secrets s WHERE s.name='t404_briefing_sender_key';
 RETURN got IS NOT NULL AND want IS NOT NULL AND length(got)=64
   AND extensions.digest(got,'sha256') = extensions.digest(want,'sha256');
END $f$;
REVOKE ALL ON FUNCTION app_private.t404_briefing_caller_ok() FROM PUBLIC, anon, authenticated;

-- 2. Delivery ledger (private).
CREATE TABLE app_private.briefing_deliveries(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,
 store_id uuid NOT NULL,
 local_date date NOT NULL,
 status text NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed','sent','failed')),
 recipients int NOT NULL DEFAULT 0,
 error text CHECK (error IS NULL OR length(error) <= 300),
 claimed_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 CONSTRAINT briefing_deliveries_once_a_day UNIQUE (store_id, local_date),
 CONSTRAINT briefing_deliveries_store_fk FOREIGN KEY (tenant_id, store_id) REFERENCES public.stores(tenant_id, id) ON DELETE RESTRICT
);
ALTER TABLE app_private.briefing_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.briefing_deliveries FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.briefing_deliveries FROM PUBLIC, anon, authenticated;

-- 3. Settings now say the sender is live.
ALTER TABLE public.store_briefing_settings DROP CONSTRAINT store_briefing_settings_status_check;
ALTER TABLE public.store_briefing_settings ADD CONSTRAINT store_briefing_settings_status_check CHECK (status IN ('awaiting_sender','active'));
ALTER TABLE public.store_briefing_settings ALTER COLUMN status SET DEFAULT 'active';
UPDATE public.store_briefing_settings SET status='active' WHERE status='awaiting_sender';

-- 4. Claim due briefings (n8n only, via secret header).
CREATE FUNCTION public.briefing_claim_due_v1()
 RETURNS TABLE(delivery_id uuid, store_name text, local_date date, recipients text[], metrics jsonb)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE r record; d uuid; em text[]; m jsonb; since timestamptz := now() - interval '24 hours';
  lnow timestamp := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh');
BEGIN
 IF NOT app_private.t404_briefing_caller_ok() THEN RAISE EXCEPTION 'access_denied' USING ERRCODE='42501'; END IF;
 FOR r IN
  SELECT b.store_id, b.tenant_id, b.metrics AS keys, s.name
  FROM public.store_briefing_settings b JOIN public.stores s ON s.tenant_id=b.tenant_id AND s.id=b.store_id AND s.active
  WHERE b.opt_in AND b.destination='email' AND b.status='active'
    AND lnow >= lnow::date + b.send_time AND lnow < lnow::date + b.send_time + interval '3 hours'
    AND NOT EXISTS (SELECT 1 FROM app_private.briefing_deliveries x WHERE x.store_id=b.store_id AND x.local_date=lnow::date)
  ORDER BY b.send_time LIMIT 50
 LOOP
  SELECT coalesce(array_agg(DISTINCT u.email::text ORDER BY u.email::text),'{}') INTO em
   FROM public.store_memberships sm
   JOIN public.tenant_memberships tm ON tm.tenant_id=sm.tenant_id AND tm.user_id=sm.user_id AND tm.active
   JOIN auth.users u ON u.id=sm.user_id AND u.email IS NOT NULL AND u.email_confirmed_at IS NOT NULL
   WHERE sm.tenant_id=r.tenant_id AND sm.store_id=r.store_id AND sm.active AND sm.role IN ('owner','manager');
  IF cardinality(em)=0 THEN CONTINUE; END IF;
  INSERT INTO app_private.briefing_deliveries(tenant_id,store_id,local_date,recipients)
   VALUES (r.tenant_id,r.store_id,lnow::date,cardinality(em)) ON CONFLICT DO NOTHING RETURNING id INTO d;
  IF d IS NULL THEN CONTINUE; END IF;
  SELECT jsonb_build_object(
    'conv_messenger', (SELECT count(*) FROM public.conversations c WHERE c.store_id=r.store_id AND c.channel='messenger' AND c.created_at>=since),
    'conv_web', (SELECT count(*) FROM public.conversations c WHERE c.store_id=r.store_id AND c.channel='web' AND c.created_at>=since),
    'conv_zalo', (SELECT count(*) FROM public.conversations c WHERE c.store_id=r.store_id AND c.channel IN ('zalo','zalo_bot') AND c.created_at>=since),
    'handoff', (SELECT count(*) FROM public.customers c WHERE c.store_id=r.store_id AND c.stage='needs_human'),
    'orders', (SELECT count(*)::text || ' (' || count(*) FILTER (WHERE o.status='pending') || ' chờ duyệt)' FROM public.orders o WHERE o.store_id=r.store_id AND o.created_at>=since),
    'revenue', (SELECT coalesce(sum(o.total_vnd) FILTER (WHERE o.status IN ('confirmed','paid')),0) FROM public.orders o WHERE o.store_id=r.store_id AND o.created_at>=since),
    'contact_requests', NULL, 'top_questions', NULL, 'incidents', NULL) INTO m;
  -- Only the metrics the owner picked (empty pick = all).
  IF cardinality(r.keys) > 0 THEN
   SELECT coalesce(jsonb_object_agg(k, m->k),'{}') INTO m FROM unnest(r.keys) k WHERE m ? k;
  END IF;
  delivery_id := d; store_name := r.name; local_date := lnow::date; recipients := em; metrics := m;
  RETURN NEXT; d := NULL;
 END LOOP;
END $f$;
REVOKE ALL ON FUNCTION public.briefing_claim_due_v1() FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.briefing_claim_due_v1() TO anon;

CREATE FUNCTION public.briefing_report_v1(p_delivery uuid, p_ok boolean, p_error text DEFAULT NULL)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
BEGIN
 IF NOT app_private.t404_briefing_caller_ok() THEN RAISE EXCEPTION 'access_denied' USING ERRCODE='42501'; END IF;
 UPDATE app_private.briefing_deliveries SET status=CASE WHEN p_ok THEN 'sent' ELSE 'failed' END,
   error=CASE WHEN p_ok THEN NULL ELSE left(coalesce(p_error,'unknown'),300) END, finished_at=now()
  WHERE id=p_delivery AND status='claimed';
 IF NOT FOUND THEN RAISE EXCEPTION 'delivery_not_claimed' USING ERRCODE='22023'; END IF;
END $f$;
REVOKE ALL ON FUNCTION public.briefing_report_v1(uuid,boolean,text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.briefing_report_v1(uuid,boolean,text) TO anon;

-- 5. Owner/manager can see the last deliveries of their own Store (no recipients' addresses).
CREATE FUNCTION public.briefing_recent_deliveries(p_store uuid)
 RETURNS TABLE(local_date date, status text, recipients int, finished_at timestamptz)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $f$
BEGIN
 PERFORM app_private.t404_cfg_manager_tenant(p_store);
 RETURN QUERY SELECT x.local_date, x.status, x.recipients, x.finished_at FROM app_private.briefing_deliveries x
  WHERE x.store_id=p_store ORDER BY x.local_date DESC LIMIT 7;
END $f$;
REVOKE ALL ON FUNCTION public.briefing_recent_deliveries(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.briefing_recent_deliveries(uuid) TO authenticated;

DO $post$ BEGIN
 IF has_function_privilege('authenticated','public.briefing_claim_due_v1()','EXECUTE')
  OR has_function_privilege('anon','public.briefing_recent_deliveries(uuid)','EXECUTE')
  OR has_table_privilege('anon','app_private.briefing_deliveries','SELECT')
  OR has_table_privilege('authenticated','app_private.briefing_deliveries','SELECT') THEN RAISE EXCEPTION 'T404_V25_20_POST_GRANTS'; END IF;
 RAISE NOTICE 'T404_V25_BRIEFING_SENDER_OK';
END $post$;
COMMIT;
