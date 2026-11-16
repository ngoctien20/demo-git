-- TIEN404 ADV.6C-RPC.2: EPHEMERAL PostgreSQL 17 CI FIXTURE ONLY.
-- THIS IS NOT A SUPABASE MIGRATION. NEVER APPLY TO HOSTED OR PRODUCTION.
-- The Node test refuses non-loopback PG and any DB name except t404_rpc2_ci.
-- Roles are synthetic and created only inside the GitHub Actions disposable PG.
-- This models a two-stage owner pairing: signed provider CLAIM -> owner CONFIRM.
-- It does NOT verify real Zalo signatures, real JWT, subscription, or policies.

CREATE SCHEMA t404_rpc2_ci;
REVOKE ALL ON SCHEMA t404_rpc2_ci FROM PUBLIC;
GRANT USAGE ON SCHEMA t404_rpc2_ci TO t404_pairing_writer_ci, t404_pairing_claim_ci, t404_pairing_confirm_ci;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE t404_rpc2_ci.shop_bots (
 tenant_key text NOT NULL,
 store_key text NOT NULL,
 bot_key text NOT NULL,
 active boolean NOT NULL,
 PRIMARY KEY (tenant_key,store_key,bot_key)
);
CREATE TABLE t404_rpc2_ci.owner_memberships (
 tenant_key text NOT NULL,
 store_key text NOT NULL,
 owner_hash text NOT NULL,
 active boolean NOT NULL,
 PRIMARY KEY (tenant_key,store_key,owner_hash)
);
CREATE TABLE t404_rpc2_ci.challenges (
 challenge_id uuid PRIMARY KEY,
 tenant_key text NOT NULL,
 store_key text NOT NULL,
 bot_key text NOT NULL,
 owner_hash text NOT NULL,
 recipient_hash text NOT NULL,
 code_hash bytea NOT NULL,
 expires_at timestamptz NOT NULL,
 failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts BETWEEN 0 AND 5),
 used_at timestamptz
);
CREATE TABLE t404_rpc2_ci.claims (
 challenge_id uuid PRIMARY KEY REFERENCES t404_rpc2_ci.challenges(challenge_id),
 tenant_key text NOT NULL,
 store_key text NOT NULL,
 bot_key text NOT NULL,
 recipient_hash text NOT NULL,
 event_hash text NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed')),
 claimed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 confirmed_at timestamptz
);
CREATE TABLE t404_rpc2_ci.bindings (
 tenant_key text NOT NULL,
 store_key text NOT NULL,
 bot_key text NOT NULL,
 owner_hash text NOT NULL,
 recipient_hash text NOT NULL,
 confirmed_challenge_id uuid NOT NULL,
 status text NOT NULL CHECK(status='active'),
 paired_at timestamptz NOT NULL,
 PRIMARY KEY(tenant_key,store_key,bot_key)
);
-- Defense in depth: a non-bypass writer role and forced RLS.
ALTER TABLE t404_rpc2_ci.shop_bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE t404_rpc2_ci.shop_bots FORCE ROW LEVEL SECURITY;
ALTER TABLE t404_rpc2_ci.owner_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE t404_rpc2_ci.owner_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE t404_rpc2_ci.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE t404_rpc2_ci.challenges FORCE ROW LEVEL SECURITY;
ALTER TABLE t404_rpc2_ci.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE t404_rpc2_ci.claims FORCE ROW LEVEL SECURITY;
ALTER TABLE t404_rpc2_ci.bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE t404_rpc2_ci.bindings FORCE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA t404_rpc2_ci TO t404_pairing_writer_ci;
CREATE POLICY qa_writer ON t404_rpc2_ci.shop_bots FOR ALL TO t404_pairing_writer_ci USING(true) WITH CHECK(true);
CREATE POLICY qa_writer ON t404_rpc2_ci.owner_memberships FOR ALL TO t404_pairing_writer_ci USING(true) WITH CHECK(true);
CREATE POLICY qa_writer ON t404_rpc2_ci.challenges FOR ALL TO t404_pairing_writer_ci USING(true) WITH CHECK(true);
CREATE POLICY qa_writer ON t404_rpc2_ci.claims FOR ALL TO t404_pairing_writer_ci USING(true) WITH CHECK(true);
CREATE POLICY qa_writer ON t404_rpc2_ci.bindings FOR ALL TO t404_pairing_writer_ci USING(true) WITH CHECK(true);

-- Authorized private backend CLAIM. External gateway MUST already verify the
-- provider signature, channel binding, consent and challenge request. Here we
-- enforce current challenge/owner membership, event uniqueness and row lock.
CREATE FUNCTION t404_rpc2_ci.claim_owner_pairing_ci (
 p_tenant text, p_store text, p_bot text, p_challenge uuid,
 p_owner_recipient_hash text, p_event_hash text, p_code text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog
AS $fn$
DECLARE v_code bytea; v_accepted uuid;
BEGIN
 IF p_tenant IS NULL OR p_store IS NULL OR p_bot IS NULL OR
    p_challenge IS NULL OR p_owner_recipient_hash !~ '^[a-f0-9]{64}$' OR
    p_event_hash !~ '^[a-f0-9]{64}$' OR
    p_code IS NULL OR length(p_code) < 8 OR length(p_code) > 128
 THEN RETURN false; END IF;
 SELECT c.code_hash INTO v_code
 FROM t404_rpc2_ci.challenges c
 JOIN t404_rpc2_ci.shop_bots b
   ON b.tenant_key=c.tenant_key AND b.store_key=c.store_key
  AND b.bot_key=c.bot_key AND b.active=true
 JOIN t404_rpc2_ci.owner_memberships m
   ON m.tenant_key=c.tenant_key AND m.store_key=c.store_key
  AND m.owner_hash=c.owner_hash AND m.active=true
 WHERE c.challenge_id=p_challenge AND c.tenant_key=p_tenant
   AND c.store_key=p_store AND c.bot_key=p_bot
   AND c.recipient_hash=p_owner_recipient_hash
   AND c.used_at IS NULL AND c.expires_at>clock_timestamp()
   AND c.failed_attempts<5
 FOR UPDATE OF c;
 IF NOT FOUND THEN RETURN false; END IF;
 IF v_code IS DISTINCT FROM public.digest(p_code,'sha256') THEN
   UPDATE t404_rpc2_ci.challenges
      SET failed_attempts=least(5,failed_attempts+1)
    WHERE challenge_id=p_challenge;
   RETURN false;
 END IF;
 INSERT INTO t404_rpc2_ci.claims(
   challenge_id,tenant_key,store_key,bot_key,recipient_hash,event_hash
 ) VALUES(p_challenge,p_tenant,p_store,p_bot,p_owner_recipient_hash,p_event_hash)
 ON CONFLICT DO NOTHING RETURNING challenge_id INTO v_accepted;
 RETURN v_accepted IS NOT NULL;
END
$fn$;
ALTER FUNCTION t404_rpc2_ci.claim_owner_pairing_ci(text,text,text,uuid,text,text,text)
OWNER TO t404_pairing_writer_ci;
REVOKE ALL ON FUNCTION t404_rpc2_ci.claim_owner_pairing_ci(text,text,text,uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION t404_rpc2_ci.claim_owner_pairing_ci(text,text,text,uuid,text,text,text)
TO t404_pairing_claim_ci;

-- Separate merchant/owner-confirmation phase. This must be executed only by
-- backend after independent REAL JWT + current Owner membership verification.
-- The owner_hash input here is synthetically trusted in PG CI; not a hosted
-- JWT verifier. Challenge+claim+binding change occur in ONE PG transaction.
CREATE FUNCTION t404_rpc2_ci.confirm_owner_pairing_ci(
 p_tenant text,p_store text,p_bot text,p_challenge uuid,p_verified_owner_hash text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog
AS $fn$
DECLARE v_recipient text;
BEGIN
 IF p_verified_owner_hash !~ '^[a-f0-9]{64}$' THEN RETURN false; END IF;
 SELECT p.recipient_hash INTO v_recipient
 FROM t404_rpc2_ci.claims p
 JOIN t404_rpc2_ci.challenges c ON c.challenge_id=p.challenge_id
 JOIN t404_rpc2_ci.owner_memberships m
   ON m.tenant_key=c.tenant_key AND m.store_key=c.store_key
  AND m.owner_hash=c.owner_hash AND m.active=true
 WHERE c.challenge_id=p_challenge AND p.tenant_key=p_tenant
   AND p.store_key=p_store AND p.bot_key=p_bot
   AND c.tenant_key=p_tenant AND c.store_key=p_store AND c.bot_key=p_bot
   AND c.owner_hash=p_verified_owner_hash AND c.used_at IS NULL
   AND c.expires_at>clock_timestamp() AND p.status='pending'
   AND p.claimed_at>clock_timestamp()-interval '10 minutes'
 FOR UPDATE OF p,c;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE t404_rpc2_ci.challenges SET used_at=clock_timestamp()
  WHERE challenge_id=p_challenge AND used_at IS NULL;
 UPDATE t404_rpc2_ci.claims SET status='confirmed',confirmed_at=clock_timestamp()
  WHERE challenge_id=p_challenge AND status='pending';
 INSERT INTO t404_rpc2_ci.bindings(
   tenant_key,store_key,bot_key,owner_hash,recipient_hash,
   confirmed_challenge_id,status,paired_at
 ) VALUES(
   p_tenant,p_store,p_bot,p_verified_owner_hash,v_recipient,
   p_challenge,'active',clock_timestamp()
 )
 ON CONFLICT(tenant_key,store_key,bot_key) DO UPDATE
 SET owner_hash=excluded.owner_hash,
     recipient_hash=excluded.recipient_hash,
     confirmed_challenge_id=excluded.confirmed_challenge_id,
     status='active',paired_at=clock_timestamp();
 RETURN true;
END
$fn$;
ALTER FUNCTION t404_rpc2_ci.confirm_owner_pairing_ci(text,text,text,uuid,text)
OWNER TO t404_pairing_writer_ci;
REVOKE ALL ON FUNCTION t404_rpc2_ci.confirm_owner_pairing_ci(text,text,text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION t404_rpc2_ci.confirm_owner_pairing_ci(text,text,text,uuid,text)
TO t404_pairing_confirm_ci;
