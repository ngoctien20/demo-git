
-- TIEN404 V12 R1 - Owner Pairing two-phase QA schema candidate.
-- STAGING ONLY / NO AUTO MIGRATION / NO POSTGREST GRANTS / NO REAL ZALO SENDS.
-- The SQL is extracted from current staging function definitions as a REVIEW REFERENCE.
-- Requires existing private QA schema and owner_authorized_qa + pair_owner_qa.
-- All APIs using real Zalo Chat IDs require independently verified inbound webhook
-- and signed Supabase Auth JWT; this code by itself provides NEITHER transport proof.
-- Historical pair_owner_authorized_v2_qa remains unexposed, but MUST NOT be used
-- in production Bot webhook flow: the real flow requires pending bot claim
-- followed by separate authorized Dashboard confirmation.
BEGIN;
ALTER TABLE tien404_r1_qa.owner_pairing_challenges
  ADD COLUMN IF NOT EXISTS requester_user_id uuid REFERENCES auth.users(id);
REVOKE ALL ON tien404_r1_qa.owner_pairing_challenges FROM public,anon,authenticated,service_role;

CREATE TABLE IF NOT EXISTS tien404_r1_qa.owner_pairing_claims_v3 (
  tenant_key text NOT NULL,
  store_key text NOT NULL,
  bot_key text NOT NULL,
  challenge_id uuid NOT NULL,
  recipient_ref text NOT NULL CHECK (recipient_ref LIKE 'qa-recipient-%'),
  inbound_event_ref text NOT NULL CHECK (inbound_event_ref LIKE 'qa-event-%'),
  status text NOT NULL DEFAULT 'PENDING_OWNER_CONFIRMATION'
    CHECK (status IN ('PENDING_OWNER_CONFIRMATION','CONFIRMED')),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  PRIMARY KEY(tenant_key,store_key,bot_key,challenge_id),
  UNIQUE(tenant_key,store_key,bot_key,inbound_event_ref),
  FOREIGN KEY(tenant_key,store_key,bot_key,challenge_id)
    REFERENCES tien404_r1_qa.owner_pairing_challenges(tenant_key,store_key,bot_key,challenge_id)
);
ALTER TABLE tien404_r1_qa.owner_pairing_claims_v3 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tien404_r1_qa.owner_pairing_claims_v3 FROM public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION tien404_r1_qa.claim_owner_pairing_v3_synthetic(p_tenant text, p_store text, p_bot text, p_challenge uuid, p_code text, p_recipient text, p_inbound_event text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'tien404_r1_qa'
AS $function$
DECLARE v_new uuid; v_expected text;
BEGIN
  -- QA-only private routine. Future inbound caller MUST be a provider-verified
  -- Bot adapter, not direct frontend. No public/authenticated EXECUTE grants.
  IF p_tenant IS NULL OR p_store IS NULL OR p_bot IS NULL OR p_challenge IS NULL
    OR p_code IS NULL OR length(p_code)<8 OR length(p_code)>128
    OR p_recipient IS NULL OR p_recipient NOT LIKE 'qa-recipient-%'
    OR length(p_recipient)>128 OR p_inbound_event IS NULL
    OR p_inbound_event NOT LIKE 'qa-event-%' OR length(p_inbound_event)>128
  THEN RETURN false; END IF;

  SELECT c.code_hash INTO v_expected
    FROM tien404_r1_qa.owner_pairing_challenges c
    JOIN tien404_r1_qa.shop_bots b
      ON b.tenant_key=c.tenant_key AND b.store_key=c.store_key AND b.bot_key=c.bot_key
   WHERE c.tenant_key=p_tenant AND c.store_key=p_store AND c.bot_key=p_bot
     AND c.challenge_id=p_challenge AND c.requester_user_id IS NOT NULL
     AND c.used_at IS NULL AND c.expires_at>now() AND c.failed_attempts<5
     AND b.enabled_mode='dry_run' AND b.identity_status='synthetic_qa'
   FOR UPDATE OF c;
  IF NOT FOUND THEN RETURN false; END IF;

  IF v_expected IS DISTINCT FROM encode(extensions.digest(p_code,'sha256'),'hex') THEN
    UPDATE tien404_r1_qa.owner_pairing_challenges c
      SET failed_attempts=least(5,c.failed_attempts+1)
     WHERE c.tenant_key=p_tenant AND c.store_key=p_store AND c.bot_key=p_bot
       AND c.challenge_id=p_challenge;
    RETURN false;
  END IF;

  INSERT INTO tien404_r1_qa.owner_pairing_claims_v3(
    tenant_key,store_key,bot_key,challenge_id,recipient_ref,inbound_event_ref
  ) VALUES(p_tenant,p_store,p_bot,p_challenge,p_recipient,p_inbound_event)
  ON CONFLICT DO NOTHING RETURNING challenge_id INTO v_new;
  RETURN v_new IS NOT NULL;
END $function$


CREATE OR REPLACE FUNCTION tien404_r1_qa.confirm_owner_pairing_v3_qa(p_tenant text, p_store text, p_bot text, p_challenge uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'tien404_r1_qa', 'auth'
AS $function$
DECLARE v_owner text;v_recipient text;
BEGIN
  IF NOT tien404_r1_qa.owner_authorized_qa(p_tenant,p_store,p_bot)
     OR auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT p.recipient_ref INTO v_recipient
  FROM tien404_r1_qa.owner_pairing_claims_v3 p
  WHERE p.tenant_key=p_tenant AND p.store_key=p_store AND p.bot_key=p_bot
    AND p.challenge_id=p_challenge
    AND p.status='PENDING_OWNER_CONFIRMATION'
    AND p.claimed_at>now()-interval '10 minutes'
  FOR UPDATE;
  IF v_recipient IS NULL THEN RETURN false; END IF;
  UPDATE tien404_r1_qa.owner_pairing_challenges c
    SET used_at=now()
   WHERE c.tenant_key=p_tenant AND c.store_key=p_store AND c.bot_key=p_bot
     AND c.challenge_id=p_challenge
     AND c.requester_user_id=auth.uid()
     AND c.used_at IS NULL AND c.expires_at>now()
  RETURNING c.owner_ref INTO v_owner;
  IF v_owner IS NULL THEN RETURN false; END IF;
  UPDATE tien404_r1_qa.owner_pairing_claims_v3
    SET status='CONFIRMED', confirmed_at=now()
   WHERE tenant_key=p_tenant AND store_key=p_store AND bot_key=p_bot
     AND challenge_id=p_challenge AND status='PENDING_OWNER_CONFIRMATION';
  INSERT INTO tien404_r1_qa.owner_bindings(
    tenant_key,store_key,bot_key,owner_ref,recipient_ref,status,paired_at,expires_at
  ) VALUES(p_tenant,p_store,p_bot,v_owner,v_recipient,'paired',now(),now()+interval '7 days')
  ON CONFLICT (tenant_key,store_key,bot_key) DO UPDATE
    SET owner_ref=excluded.owner_ref,recipient_ref=excluded.recipient_ref,
        status='paired',paired_at=now(),expires_at=excluded.expires_at;
  RETURN true;
END $function$


CREATE OR REPLACE FUNCTION tien404_r1_qa.pair_owner_authorized_v2_qa(p_tenant text, p_store text, p_bot text, p_challenge uuid, p_recipient text, p_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'tien404_r1_qa', 'auth'
AS $function$
DECLARE v_owner_ref text;
BEGIN
  -- auth.uid() relies on signed JWT at the API boundary. In SQL Editor, simulated
  -- claim GUCs prove only the DB predicate, NOT signature verification.
  IF NOT tien404_r1_qa.owner_authorized_qa(p_tenant,p_store,p_bot)
     OR auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  SELECT c.owner_ref INTO v_owner_ref
    FROM tien404_r1_qa.owner_pairing_challenges c
   WHERE c.tenant_key=p_tenant AND c.store_key=p_store AND c.bot_key=p_bot
     AND c.challenge_id=p_challenge
     AND c.requester_user_id=auth.uid()
     AND c.used_at IS NULL AND c.expires_at>now() AND c.failed_attempts<5
   FOR UPDATE;
  IF v_owner_ref IS NULL THEN RETURN false; END IF;
  -- Still relies on trusted webhook binding for p_recipient; never expose this
  -- function directly via user HTTP or n8n without validating sender proof.
  RETURN tien404_r1_qa.pair_owner_qa(
    p_tenant,p_store,p_bot,p_challenge,v_owner_ref,p_recipient,p_code
  );
END;
$function$


REVOKE ALL ON FUNCTION tien404_r1_qa.pair_owner_authorized_v2_qa(text,text,text,uuid,text,text)
 FROM public,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION tien404_r1_qa.claim_owner_pairing_v3_synthetic(text,text,text,uuid,text,text,text)
 FROM public,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION tien404_r1_qa.confirm_owner_pairing_v3_qa(text,text,text,uuid)
 FROM public,anon,authenticated,service_role;
COMMIT;

-- Integration blockers:
-- 1) No live HTTP caller should invoke claim_owner_pairing_v3_synthetic;
--    replace with real provider-signed webhook identity verification.
-- 2) No real user signed-JWT E2E has passed the positive owner authorization path.
-- 3) No owner pairing should occur automatically on token/code possession alone.
-- 4) Legacy one-step QA function is private; protect against accidentally exposing it.
-- 5) Never dispatch to Zalo while ZALO_SEND_ENABLED=false.
