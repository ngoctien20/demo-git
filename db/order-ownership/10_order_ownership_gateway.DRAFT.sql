-- TIEN404 B-P1-05 — Trusted Order Ownership Gateway. STATUS: DRAFT / PROPOSED. NOT APPLIED ANYWHERE.
-- Do NOT apply to hosted without explicit owner approval (migration + grants). Contract: CONTRACT.md.
--
-- Rule: knowing an order id/code is NEVER proof of ownership. A requester (a channel identity the
-- trusted backend has already verified, e.g. a Meta-signed PSID) may see or change an order only with
-- an access grant, and a grant is issued only after a 6-digit one-time code, delivered to the contact
-- on file for the order's customer, is typed back by the SAME requester.
--   * code: 6 digits from the CSPRNG behind gen_random_uuid(); stored only as sha256(pepper|challenge|code)
--   * TTL: challenge 5 min (hard max 10), grant 30 min; one grant per challenge
--   * attempts: 5 wrong codes lock the challenge; requester must match the one who asked
--   * rate limits: 3 challenges / order / hour, 5 challenges / requester / hour
--   * replay: every call carries a nonce (provider event id / request id), single use for 24 h
--   * anti-enumeration: unknown, foreign or contact-less orders get the SAME "accepted" answer shape
--   * only service_role may EXECUTE (backend / n8n after webhook signature check); anon/authenticated never
-- Requires: V20 Store Authority (orders.store_id, customers.store_id), app_private.audit_events,
-- and a Vault secret named t404_order_gateway_pepper (>= 32 chars) for the code pepper.
-- Rollback: 90_order_ownership_gateway_rollback.DRAFT.sql
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $pre$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='store_id')
    OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='customers' AND column_name='store_id') THEN
  RAISE EXCEPTION 'T404_OG_PRECHECK_V20_STORE_SCOPE_MISSING'; END IF;
 IF to_regclass('app_private.audit_events') IS NULL THEN RAISE EXCEPTION 'T404_OG_PRECHECK_AUDIT_MISSING'; END IF;
 IF to_regclass('app_private.order_ownership_challenges') IS NOT NULL THEN RAISE EXCEPTION 'T404_OG_ALREADY_APPLIED'; END IF;
END $pre$;

CREATE TABLE app_private.order_ownership_challenges(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,
 store_id uuid NOT NULL,
 order_id uuid NOT NULL,
 customer_id uuid NOT NULL,
 requester_digest text NOT NULL CHECK (requester_digest ~ '^[0-9a-f]{64}$'),
 code_digest text NOT NULL CHECK (code_digest ~ '^[0-9a-f]{64}$'),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','consumed','locked','revoked')),
 failed_attempts int NOT NULL DEFAULT 0 CHECK (failed_attempts BETWEEN 0 AND 5),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 CONSTRAINT og_challenge_ttl CHECK (expires_at > created_at AND expires_at <= created_at + interval '10 minutes'),
 CONSTRAINT og_challenge_consumed CHECK (status <> 'consumed' OR consumed_at IS NOT NULL),
 CONSTRAINT og_challenge_order_fk FOREIGN KEY (tenant_id, order_id) REFERENCES public.orders(tenant_id, id) ON DELETE CASCADE,
 CONSTRAINT og_challenge_customer_fk FOREIGN KEY (tenant_id, customer_id) REFERENCES public.customers(tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX og_challenges_order_idx ON app_private.order_ownership_challenges(order_id, created_at DESC);
CREATE INDEX og_challenges_requester_idx ON app_private.order_ownership_challenges(requester_digest, created_at DESC);

CREATE TABLE app_private.order_access_grants(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,
 store_id uuid NOT NULL,
 order_id uuid NOT NULL,
 customer_id uuid NOT NULL,
 requester_digest text NOT NULL CHECK (requester_digest ~ '^[0-9a-f]{64}$'),
 challenge_id uuid NOT NULL UNIQUE REFERENCES app_private.order_ownership_challenges(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 CONSTRAINT og_grant_ttl CHECK (expires_at > created_at AND expires_at <= created_at + interval '30 minutes'),
 CONSTRAINT og_grant_order_fk FOREIGN KEY (tenant_id, order_id) REFERENCES public.orders(tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX og_grants_order_idx ON app_private.order_access_grants(order_id, requester_digest);

CREATE TABLE app_private.order_gateway_nonces(
 nonce_digest text PRIMARY KEY CHECK (nonce_digest ~ '^[0-9a-f]{64}$'),
 purpose text NOT NULL CHECK (purpose IN ('request_otp','verify_otp')),
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX og_nonces_expiry_idx ON app_private.order_gateway_nonces(expires_at);

DO $rls$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['order_ownership_challenges','order_access_grants','order_gateway_nonces'] LOOP
  EXECUTE format('ALTER TABLE app_private.%I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('ALTER TABLE app_private.%I FORCE ROW LEVEL SECURITY', t);
  EXECUTE format('REVOKE ALL ON app_private.%I FROM PUBLIC, anon, authenticated, service_role', t);
 END LOOP;
END $rls$;

-- helpers (not callable by any API role) ---------------------------------------------------
CREATE FUNCTION app_private.t404_og_sha(v text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $f$
 SELECT encode(sha256(convert_to(v,'UTF8')),'hex') $f$;

CREATE FUNCTION app_private.t404_og_pepper() RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $f$
DECLARE p text;
BEGIN
 IF to_regclass('vault.decrypted_secrets') IS NULL THEN RAISE EXCEPTION 'pepper_missing' USING ERRCODE='55000'; END IF;
 EXECUTE 'SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name=$1' INTO p USING 't404_order_gateway_pepper';
 IF p IS NULL OR length(p) < 32 THEN RAISE EXCEPTION 'pepper_missing' USING ERRCODE='55000'; END IF;
 RETURN p;
END $f$;

-- Single-use nonce: raises replay_detected if seen in the last 24 h.
CREATE FUNCTION app_private.t404_og_claim_nonce(p_nonce text, p_purpose text) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
BEGIN
 IF p_nonce IS NULL OR length(p_nonce) NOT BETWEEN 16 AND 200 THEN RAISE EXCEPTION 'invalid_nonce' USING ERRCODE='22023'; END IF;
 DELETE FROM app_private.order_gateway_nonces WHERE expires_at < now();
 INSERT INTO app_private.order_gateway_nonces(nonce_digest,purpose,expires_at)
  VALUES (app_private.t404_og_sha(p_purpose||':'||p_nonce), p_purpose, now() + interval '24 hours');
EXCEPTION WHEN unique_violation THEN
 RAISE EXCEPTION 'replay_detected' USING ERRCODE='P0001';
END $f$;

CREATE FUNCTION app_private.t404_og_requester(p_requester text) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $f$
BEGIN
 -- '<channel>:<installation>:<provider user id>' as VERIFIED by the backend (never typed by the customer).
 IF p_requester IS NULL OR p_requester !~ '^(messenger|zalo_oa|zalo_bot|web|telegram):[A-Za-z0-9_.-]{1,128}:[A-Za-z0-9_.-]{1,255}$' THEN
  RAISE EXCEPTION 'invalid_requester' USING ERRCODE='22023'; END IF;
 RETURN app_private.t404_og_sha('requester:'||p_requester);
END $f$;

-- 1) Request a code. Uniform answer whether or not the order exists / belongs to this store / has a
--    contact, so the chat cannot be used to enumerate order ids. code is NULL when nothing was issued.
CREATE FUNCTION public.order_ownership_request_otp(p_store uuid, p_order uuid, p_requester text, p_nonce text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE rd text := app_private.t404_og_requester(p_requester); o record; cid uuid; code text; exp timestamptz;
BEGIN
 PERFORM app_private.t404_og_claim_nonce(p_nonce,'request_otp');
 IF (SELECT count(*) FROM app_private.order_ownership_challenges c
      WHERE c.requester_digest=rd AND c.created_at > now() - interval '1 hour') >= 5 THEN
  RAISE EXCEPTION 'rate_limited' USING ERRCODE='P0001'; END IF;
 SELECT od.tenant_id, od.store_id, od.id, od.customer_id, cu.phone INTO o
  FROM public.orders od
  JOIN public.stores s ON s.tenant_id=od.tenant_id AND s.id=od.store_id AND s.active
  JOIN public.customers cu ON cu.tenant_id=od.tenant_id AND cu.id=od.customer_id AND cu.store_id=od.store_id
  WHERE od.id=p_order AND od.store_id=p_store;
 IF o.id IS NULL OR o.phone IS NULL OR o.phone !~ '^0[35789][0-9]{8}$' THEN
  INSERT INTO app_private.audit_events(tenant_id,event_type,metadata)
   VALUES (NULL,'order_otp_request_noop',jsonb_build_object('store_id',p_store,'requester',left(rd,12)));
  RETURN jsonb_build_object('status','accepted','challenge_id',gen_random_uuid(),'code',NULL,'expires_at',now()+interval '5 minutes','deliver_to',NULL);
 END IF;
 IF (SELECT count(*) FROM app_private.order_ownership_challenges c
      WHERE c.order_id=o.id AND c.created_at > now() - interval '1 hour') >= 3 THEN
  RAISE EXCEPTION 'rate_limited' USING ERRCODE='P0001'; END IF;
 -- new code supersedes any pending one for the same order+requester
 UPDATE app_private.order_ownership_challenges SET status='revoked'
  WHERE order_id=o.id AND requester_digest=rd AND status='pending';
 cid := gen_random_uuid();
 code := lpad((('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint % 1000000)::text, 6, '0');
 exp := now() + interval '5 minutes';
 INSERT INTO app_private.order_ownership_challenges(id,tenant_id,store_id,order_id,customer_id,requester_digest,code_digest,expires_at)
  VALUES (cid,o.tenant_id,o.store_id,o.id,o.customer_id,rd,
          app_private.t404_og_sha(app_private.t404_og_pepper()||':'||cid::text||':'||code),exp);
 INSERT INTO app_private.audit_events(tenant_id,event_type,metadata)
  VALUES (o.tenant_id,'order_otp_issued',jsonb_build_object('store_id',o.store_id,'order_id',o.id,'challenge_id',cid,'requester',left(rd,12)));
 -- The backend sends `code` ONLY to deliver_to.phone (SMS/ZNS), never back into the requesting chat.
 RETURN jsonb_build_object('status','accepted','challenge_id',cid,'code',code,'expires_at',exp,
   'deliver_to',jsonb_build_object('customer_id',o.customer_id,'phone',o.phone));
END $f$;

-- 2) Verify a code typed by the requester. Returns a grant on success.
CREATE FUNCTION public.order_ownership_verify_otp(p_challenge uuid, p_code text, p_requester text, p_nonce text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE rd text := app_private.t404_og_requester(p_requester); c app_private.order_ownership_challenges; gid uuid; gexp timestamptz;
BEGIN
 PERFORM app_private.t404_og_claim_nonce(p_nonce,'verify_otp');
 SELECT * INTO c FROM app_private.order_ownership_challenges WHERE id=p_challenge FOR UPDATE;
 -- unknown / foreign requester / not pending / expired all look the same to the caller
 IF c.id IS NULL OR c.requester_digest<>rd THEN RAISE EXCEPTION 'challenge_invalid' USING ERRCODE='42501'; END IF;
 IF c.status='consumed' THEN RAISE EXCEPTION 'challenge_used' USING ERRCODE='42501'; END IF;
 IF c.status<>'pending' OR c.expires_at <= now() THEN RAISE EXCEPTION 'challenge_invalid' USING ERRCODE='42501'; END IF;
 IF p_code IS NULL OR p_code !~ '^[0-9]{6}$'
    OR app_private.t404_og_sha(app_private.t404_og_pepper()||':'||c.id::text||':'||p_code) <> c.code_digest THEN
  UPDATE app_private.order_ownership_challenges
     SET failed_attempts=failed_attempts+1, status=CASE WHEN failed_attempts+1>=5 THEN 'locked' ELSE status END
   WHERE id=c.id;
  INSERT INTO app_private.audit_events(tenant_id,event_type,metadata)
   VALUES (c.tenant_id,'order_otp_failed',jsonb_build_object('challenge_id',c.id,'attempt',c.failed_attempts+1));
  -- RETURN (not RAISE) so the attempt counter commits; caller treats ok=false as a denial.
  RETURN jsonb_build_object('ok',false,'reason',CASE WHEN c.failed_attempts+1>=5 THEN 'locked' ELSE 'wrong_code' END,
                            'attempts_left',greatest(0,4-c.failed_attempts));
 END IF;
 UPDATE app_private.order_ownership_challenges SET status='consumed', consumed_at=now() WHERE id=c.id;
 gexp := now() + interval '30 minutes';
 INSERT INTO app_private.order_access_grants(tenant_id,store_id,order_id,customer_id,requester_digest,challenge_id,expires_at)
  VALUES (c.tenant_id,c.store_id,c.order_id,c.customer_id,rd,c.id,gexp) RETURNING id INTO gid;
 INSERT INTO app_private.audit_events(tenant_id,event_type,metadata)
  VALUES (c.tenant_id,'order_otp_verified',jsonb_build_object('challenge_id',c.id,'order_id',c.order_id,'grant_id',gid));
 RETURN jsonb_build_object('ok',true,'grant_id',gid,'order_id',c.order_id,'expires_at',gexp);
END $f$;

-- 3) Gate every order read/update on a live grant for THIS order and THIS requester.
CREATE FUNCTION public.order_ownership_check(p_grant uuid, p_order uuid, p_requester text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$
 SELECT EXISTS (SELECT 1 FROM app_private.order_access_grants g
  WHERE g.id=p_grant AND g.order_id=p_order AND g.requester_digest=app_private.t404_og_requester(p_requester)
    AND g.revoked_at IS NULL AND g.expires_at > now()) $f$;

CREATE FUNCTION public.order_ownership_revoke(p_grant uuid) RETURNS boolean
 LANGUAGE sql SECURITY DEFINER SET search_path='' AS $f$
 WITH u AS (UPDATE app_private.order_access_grants SET revoked_at=now() WHERE id=p_grant AND revoked_at IS NULL RETURNING 1)
 SELECT EXISTS (SELECT 1 FROM u) $f$;

DO $g$ DECLARE f text; BEGIN
 FOREACH f IN ARRAY ARRAY['app_private.t404_og_sha(text)','app_private.t404_og_pepper()','app_private.t404_og_claim_nonce(text,text)',
   'app_private.t404_og_requester(text)'] LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f);
 END LOOP;
 FOREACH f IN ARRAY ARRAY['public.order_ownership_request_otp(uuid,uuid,text,text)','public.order_ownership_verify_otp(uuid,text,text,text)',
   'public.order_ownership_check(uuid,uuid,text)','public.order_ownership_revoke(uuid)'] LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  IF has_function_privilege('anon',f,'EXECUTE') OR has_function_privilege('authenticated',f,'EXECUTE') THEN
   RAISE EXCEPTION 'T404_OG_POST_API_ROLE_CAN_EXECUTE %', f; END IF;
 END LOOP;
 RAISE NOTICE 'T404_OG_DRAFT_OK';
END $g$;
COMMIT;
