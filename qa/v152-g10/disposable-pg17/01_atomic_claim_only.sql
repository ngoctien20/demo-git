-- TIEN404 G0.10 — DISPOSABLE PostgreSQL 17 ONLY.
-- This is NOT a Supabase migration and MUST NOT be run on hosted/project DB.
-- Tests atomic dedupe of already independently verified real-Page events.
-- No real Page/MID/PSID, credential, phone, Orders, stock or PII permitted.
-- All digests are HMAC-SHA256 calculated by an operator-owned private adapter,
-- not unsalted SHA256 of predictable Page IDs or message IDs.
BEGIN;
CREATE SCHEMA IF NOT EXISTS t404_g10_disposable_qa;
REVOKE ALL ON SCHEMA t404_g10_disposable_qa FROM PUBLIC;
CREATE TABLE IF NOT EXISTS t404_g10_disposable_qa.event_claims (
    provider text NOT NULL CHECK (provider = 'MESSENGER'),
    installation_digest bytea NOT NULL CHECK (octet_length(installation_digest) = 32),
    event_digest bytea NOT NULL CHECK (octet_length(event_digest) = 32),
    payload_digest bytea NOT NULL CHECK (octet_length(payload_digest) = 32),
    first_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT t404_g10_disposable_unique_event
      PRIMARY KEY (provider, installation_digest, event_digest)
);
REVOKE ALL ON TABLE t404_g10_disposable_qa.event_claims FROM PUBLIC;
-- Defense in depth: only privileged disposable owner can run the function,
-- no broad anon/authenticated grants, no SECURITY DEFINER and no public schema.
ALTER TABLE t404_g10_disposable_qa.event_claims ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION t404_g10_disposable_qa.claim_once(
  p_provider text,
  p_installation_digest bytea,
  p_event_digest bytea,
  p_payload_digest bytea
) RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog, t404_g10_disposable_qa
AS $$
DECLARE
  inserted_payload bytea;
  prior_payload bytea;
BEGIN
  IF p_provider IS DISTINCT FROM 'MESSENGER'
     OR p_installation_digest IS NULL OR octet_length(p_installation_digest) <> 32
     OR p_event_digest IS NULL OR octet_length(p_event_digest) <> 32
     OR p_payload_digest IS NULL OR octet_length(p_payload_digest) <> 32
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'G10_INVALID_BOUNDED_FINGERPRINT';
  END IF;

  -- Index arbitration is atomic ACROSS PG connections and workers, unlike
  -- n8n rowNotExists + later insert. No update/write on duplicate delivery.
  INSERT INTO t404_g10_disposable_qa.event_claims
    (provider, installation_digest, event_digest, payload_digest)
  VALUES
    (p_provider, p_installation_digest, p_event_digest, p_payload_digest)
  ON CONFLICT (provider, installation_digest, event_digest) DO NOTHING
  RETURNING payload_digest INTO inserted_payload;

  IF FOUND THEN
    RETURN 'claimed';
  END IF;

  -- A concurrent conflicting insert was allowed to finish by unique-index
  -- arbitration. PL/pgSQL VOLATILE statement snapshot (READ COMMITTED) can
  -- now inspect committed comparison digest without returning raw event.
  SELECT payload_digest INTO prior_payload
  FROM t404_g10_disposable_qa.event_claims
  WHERE provider = p_provider
    AND installation_digest = p_installation_digest
    AND event_digest = p_event_digest;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001',
      MESSAGE = 'G10_CLAIM_RACE_OR_VISIBILITY_UNCERTAIN';
  END IF;
  IF prior_payload <> p_payload_digest THEN
    RETURN 'conflict'; -- Same event ID, different payload (fail closed)
  END IF;
  RETURN 'duplicate';
END;
$$;
REVOKE ALL ON FUNCTION t404_g10_disposable_qa.claim_once(text,bytea,bytea,bytea) FROM PUBLIC;
COMMIT;
