-- V17.2C.40G — SYNTHETIC EPHEMERAL POSTGRES ONLY.
-- NEVER run on Supabase staging/production. No real Auth, owner, Store or JWT.
-- Demonstrates atomic challenge+consent persistence and revocation ordering.
BEGIN;
CREATE SCHEMA tien404_v172c40g_qa;
REVOKE ALL ON SCHEMA tien404_v172c40g_qa FROM PUBLIC, anon, authenticated;

CREATE TABLE tien404_v172c40g_qa.owner_sessions (
  session_ref text PRIMARY KEY,
  actor_ref text NOT NULL,
  tenant_ref text NOT NULL,
  store_ref text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > '-infinity'::timestamptz)
);

CREATE TABLE tien404_v172c40g_qa.owner_memberships (
  actor_ref text NOT NULL,
  tenant_ref text NOT NULL,
  store_ref text NOT NULL,
  member_role text NOT NULL CHECK (member_role IN ('owner','manager')),
  active boolean NOT NULL DEFAULT true,
  revoked_at timestamptz,
  PRIMARY KEY (actor_ref,tenant_ref,store_ref)
);

CREATE TABLE tien404_v172c40g_qa.owner_challenges (
  challenge_digest text PRIMARY KEY CHECK (challenge_digest ~ '^[a-f0-9]{64}$'),
  session_ref text NOT NULL REFERENCES tien404_v172c40g_qa.owner_sessions(session_ref),
  actor_ref text NOT NULL,
  tenant_ref text NOT NULL,
  store_ref text NOT NULL,
  decision_ref text NOT NULL,
  decision_version integer NOT NULL CHECK (decision_version > 0),
  operation text NOT NULL CHECK (operation='OWNER_DECISION_CONSENT'),
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'issued' CHECK (state IN ('issued','consumed','revoked')),
  consumed_at timestamptz,
  CHECK (expires_at > issued_at AND expires_at <= issued_at + interval '10 minutes'),
  CHECK ((state='consumed' AND consumed_at IS NOT NULL)
      OR (state IN ('issued','revoked') AND consumed_at IS NULL))
);

CREATE TABLE tien404_v172c40g_qa.owner_consent_events (
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  challenge_digest text NOT NULL UNIQUE REFERENCES tien404_v172c40g_qa.owner_challenges(challenge_digest),
  idempotency_key text NOT NULL UNIQUE,
  session_ref text NOT NULL,
  actor_ref text NOT NULL,
  tenant_ref text NOT NULL,
  store_ref text NOT NULL,
  decision_ref text NOT NULL,
  decision_version integer NOT NULL,
  consent_action text NOT NULL CHECK (consent_action IN ('ACCEPT','DECLINE')),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE tien404_v172c40g_qa.owner_revocation_events (
  revocation_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  target_type text NOT NULL CHECK (target_type IN ('MEMBERSHIP','CONSENT_EVENT')),
  target_ref text NOT NULL,
  actor_ref text NOT NULL,
  reason_code text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(target_type,target_ref)
);

CREATE FUNCTION tien404_v172c40g_qa.deny_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path=''
AS $fn$
BEGIN
  RAISE EXCEPTION 'DENY_APPEND_ONLY_EVENT_MUTATION';
END
$fn$;

CREATE TRIGGER owner_consent_events_append_only
BEFORE UPDATE OR DELETE ON tien404_v172c40g_qa.owner_consent_events
FOR EACH ROW EXECUTE FUNCTION tien404_v172c40g_qa.deny_append_only_mutation();

CREATE TRIGGER owner_revocation_events_append_only
BEFORE UPDATE OR DELETE ON tien404_v172c40g_qa.owner_revocation_events
FOR EACH ROW EXECUTE FUNCTION tien404_v172c40g_qa.deny_append_only_mutation();

CREATE FUNCTION tien404_v172c40g_qa.consume_owner_consent(
  p_challenge_digest text,
  p_session_ref text,
  p_idempotency_key text,
  p_consent_action text
) RETURNS TABLE(status text, event_id bigint)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path=''
AS $fn$
DECLARE
  v_session tien404_v172c40g_qa.owner_sessions%ROWTYPE;
  v_challenge tien404_v172c40g_qa.owner_challenges%ROWTYPE;
  v_membership tien404_v172c40g_qa.owner_memberships%ROWTYPE;
  v_existing tien404_v172c40g_qa.owner_consent_events%ROWTYPE;
  v_event_id bigint;
BEGIN
  IF p_challenge_digest IS NULL OR p_session_ref IS NULL
     OR p_idempotency_key IS NULL OR length(p_idempotency_key)<16
     OR p_consent_action NOT IN ('ACCEPT','DECLINE')
  THEN RAISE EXCEPTION 'DENY_INVALID_CONSENT_REQUEST'; END IF;

  -- Serialize duplicate idempotency keys. A retry with identical payload
  -- returns the original redacted event result; a changed payload is denied.
  PERFORM pg_advisory_xact_lock(pg_catalog.hashtextextended(p_idempotency_key,0));
  SELECT * INTO v_existing
  FROM tien404_v172c40g_qa.owner_consent_events
  WHERE idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF v_existing.challenge_digest=p_challenge_digest
       AND v_existing.session_ref=p_session_ref
       AND v_existing.consent_action=p_consent_action
    THEN
      RETURN QUERY SELECT 'IDEMPOTENT_REPLAY_NO_NEW_EVENT'::text,v_existing.event_id;
      RETURN;
    END IF;
    RAISE EXCEPTION 'DENY_IDEMPOTENCY_CONFLICT';
  END IF;

  -- Fixed lock order: session -> challenge -> membership.
  SELECT * INTO v_session
  FROM tien404_v172c40g_qa.owner_sessions
  WHERE session_ref=p_session_ref
  FOR UPDATE;
  IF NOT FOUND OR v_session.active IS NOT TRUE
     OR v_session.revoked_at IS NOT NULL
     OR v_session.expires_at<=clock_timestamp()
  THEN RAISE EXCEPTION 'DENY_SESSION_INACTIVE_OR_REVOKED'; END IF;

  SELECT * INTO v_challenge
  FROM tien404_v172c40g_qa.owner_challenges
  WHERE challenge_digest=p_challenge_digest
  FOR UPDATE;
  IF NOT FOUND OR v_challenge.state<>'issued'
     OR v_challenge.expires_at<=clock_timestamp()
     OR v_challenge.issued_at>clock_timestamp()
     OR v_challenge.session_ref<>v_session.session_ref
     OR v_challenge.actor_ref<>v_session.actor_ref
     OR v_challenge.tenant_ref<>v_session.tenant_ref
     OR v_challenge.store_ref<>v_session.store_ref
     OR v_challenge.operation<>'OWNER_DECISION_CONSENT'
  THEN RAISE EXCEPTION 'DENY_CHALLENGE_INVALID_REPLAY_OR_SCOPE'; END IF;

  SELECT * INTO v_membership
  FROM tien404_v172c40g_qa.owner_memberships
  WHERE actor_ref=v_challenge.actor_ref
    AND tenant_ref=v_challenge.tenant_ref
    AND store_ref=v_challenge.store_ref
  FOR UPDATE;
  IF NOT FOUND OR v_membership.active IS NOT TRUE
     OR v_membership.revoked_at IS NOT NULL
     OR v_membership.member_role<>'owner'
  THEN RAISE EXCEPTION 'DENY_OWNER_MEMBERSHIP_REVOKED_OR_INVALID'; END IF;

  UPDATE tien404_v172c40g_qa.owner_challenges
  SET state='consumed',consumed_at=clock_timestamp()
  WHERE challenge_digest=p_challenge_digest AND state='issued';
  IF NOT FOUND THEN RAISE EXCEPTION 'DENY_CHALLENGE_REPLAY'; END IF;

  INSERT INTO tien404_v172c40g_qa.owner_consent_events
    (challenge_digest,idempotency_key,session_ref,actor_ref,tenant_ref,store_ref,
     decision_ref,decision_version,consent_action)
  VALUES
    (v_challenge.challenge_digest,p_idempotency_key,v_session.session_ref,
     v_session.actor_ref,v_session.tenant_ref,v_session.store_ref,
     v_challenge.decision_ref,v_challenge.decision_version,p_consent_action)
  RETURNING owner_consent_events.event_id INTO v_event_id;

  RETURN QUERY SELECT 'CONSENT_RECORDED_NOT_AUTHORITY_GRANTED'::text,v_event_id;
END
$fn$;

CREATE FUNCTION tien404_v172c40g_qa.revoke_owner_membership(
  p_actor_ref text,p_tenant_ref text,p_store_ref text,p_reason_code text
) RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path=''
AS $fn$
DECLARE v_membership tien404_v172c40g_qa.owner_memberships%ROWTYPE;
DECLARE v_target text;
BEGIN
  SELECT * INTO v_membership
  FROM tien404_v172c40g_qa.owner_memberships
  WHERE actor_ref=p_actor_ref AND tenant_ref=p_tenant_ref AND store_ref=p_store_ref
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DENY_MEMBERSHIP_NOT_FOUND'; END IF;
  v_target:=p_actor_ref||':'||p_tenant_ref||':'||p_store_ref;
  INSERT INTO tien404_v172c40g_qa.owner_revocation_events
    (target_type,target_ref,actor_ref,reason_code)
  VALUES ('MEMBERSHIP',v_target,'synthetic-security-reviewer',p_reason_code)
  ON CONFLICT(target_type,target_ref) DO NOTHING;
  UPDATE tien404_v172c40g_qa.owner_memberships
  SET active=false,revoked_at=COALESCE(revoked_at,clock_timestamp())
  WHERE actor_ref=p_actor_ref AND tenant_ref=p_tenant_ref AND store_ref=p_store_ref;
  RETURN 'MEMBERSHIP_REVOKED';
END
$fn$;

CREATE FUNCTION tien404_v172c40g_qa.revoke_owner_consent(
  p_event_id bigint,p_reason_code text
) RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path=''
AS $fn$
DECLARE v_event tien404_v172c40g_qa.owner_consent_events%ROWTYPE;
BEGIN
  SELECT * INTO v_event FROM tien404_v172c40g_qa.owner_consent_events
  WHERE event_id=p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'DENY_CONSENT_EVENT_NOT_FOUND'; END IF;
  INSERT INTO tien404_v172c40g_qa.owner_revocation_events
    (target_type,target_ref,actor_ref,reason_code)
  VALUES ('CONSENT_EVENT',p_event_id::text,'synthetic-security-reviewer',p_reason_code)
  ON CONFLICT(target_type,target_ref) DO NOTHING;
  RETURN 'CONSENT_REVOKED';
END
$fn$;

CREATE FUNCTION tien404_v172c40g_qa.check_current_consent(p_event_id bigint)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path=''
AS $fn$
DECLARE v_event tien404_v172c40g_qa.owner_consent_events%ROWTYPE;
DECLARE v_session tien404_v172c40g_qa.owner_sessions%ROWTYPE;
DECLARE v_membership tien404_v172c40g_qa.owner_memberships%ROWTYPE;
DECLARE v_challenge tien404_v172c40g_qa.owner_challenges%ROWTYPE;
DECLARE v_membership_target text;
BEGIN
  SELECT * INTO v_event FROM tien404_v172c40g_qa.owner_consent_events
  WHERE event_id=p_event_id;
  IF NOT FOUND OR v_event.consent_action<>'ACCEPT' THEN RETURN 'DENY'; END IF;

  SELECT * INTO v_session FROM tien404_v172c40g_qa.owner_sessions
  WHERE session_ref=v_event.session_ref;
  SELECT * INTO v_membership FROM tien404_v172c40g_qa.owner_memberships
  WHERE actor_ref=v_event.actor_ref AND tenant_ref=v_event.tenant_ref AND store_ref=v_event.store_ref;
  SELECT * INTO v_challenge FROM tien404_v172c40g_qa.owner_challenges
  WHERE challenge_digest=v_event.challenge_digest;
  v_membership_target:=v_event.actor_ref||':'||v_event.tenant_ref||':'||v_event.store_ref;

  IF v_session.session_ref IS NULL OR v_session.active IS NOT TRUE
     OR v_session.revoked_at IS NOT NULL OR v_session.expires_at<=clock_timestamp()
     OR v_membership.actor_ref IS NULL OR v_membership.active IS NOT TRUE
     OR v_membership.revoked_at IS NOT NULL OR v_membership.member_role<>'owner'
     OR v_challenge.state<>'consumed'
     OR EXISTS (SELECT 1 FROM tien404_v172c40g_qa.owner_revocation_events
                WHERE target_type='MEMBERSHIP' AND target_ref=v_membership_target)
     OR EXISTS (SELECT 1 FROM tien404_v172c40g_qa.owner_revocation_events
                WHERE target_type='CONSENT_EVENT' AND target_ref=p_event_id::text)
  THEN RETURN 'DENY'; END IF;

  RETURN 'REVIEW_REQUIRED_NOT_AUTHORITY_GO';
END
$fn$;

REVOKE ALL ON ALL TABLES IN SCHEMA tien404_v172c40g_qa FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA tien404_v172c40g_qa FROM PUBLIC,anon,authenticated;
COMMIT;
