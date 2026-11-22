-- TIEN404 V21.1 — DISPOSABLE PostgreSQL 17 QA ONLY.
-- Not a Supabase migration. Never apply to hosted/staging/production without separate approval.
-- No real PSIDs, Page IDs, tenants, credentials, or customer data.
BEGIN;
CREATE SCHEMA IF NOT EXISTS t404_reaction_qa;
REVOKE ALL ON SCHEMA t404_reaction_qa FROM PUBLIC;

CREATE TABLE IF NOT EXISTS t404_reaction_qa.claims (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id text NOT NULL,
  page_id text NOT NULL,
  sender_id text NOT NULL,
  message_id text NOT NULL,
  action text NOT NULL DEFAULT 'react' CHECK (action = 'react'),
  claimed_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  status text NOT NULL DEFAULT 'claimed'
    CHECK (status IN ('claimed','accepted','unknown','skipped')),
  UNIQUE (tenant_id, page_id, sender_id, message_id, action)
);
CREATE INDEX IF NOT EXISTS t404_reaction_claims_by_sender_hour
  ON t404_reaction_qa.claims(tenant_id,page_id,sender_id,action,claimed_at DESC);
REVOKE ALL ON TABLE t404_reaction_qa.claims FROM PUBLIC;

-- The same transaction and session-level consistency are required for:
-- 1) unique tenant/Page/sender/MID/action 2) cooldown 3) hourly quota.
-- Advisory lock is scoped by tenant+Page+sender. Hash collisions only serialize.
CREATE OR REPLACE FUNCTION t404_reaction_qa.try_claim(
  p_tenant text, p_page text, p_sender text, p_mid text,
  p_cooldown_seconds integer, p_hourly_limit integer
) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  v_now timestamptz;
  v_rows integer;
BEGIN
  IF p_tenant IS NULL OR p_page IS NULL OR p_sender IS NULL OR p_mid IS NULL OR
     length(p_tenant) < 2 OR length(p_page) < 2 OR length(p_sender) < 2 OR
     length(p_mid) < 4 OR length(p_mid) > 512 OR
     p_cooldown_seconds IS NULL OR p_cooldown_seconds NOT BETWEEN 60 AND 3600 OR
     p_hourly_limit IS NULL OR p_hourly_limit NOT BETWEEN 1 AND 6 THEN
    RETURN false;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      pg_catalog.concat_ws(chr(31), p_tenant, p_page, p_sender, 'react'), 0
    )
  );
  v_now := pg_catalog.clock_timestamp();

  -- Refuse a second reaction in the same conversation before cooldown elapses.
  IF EXISTS (
    SELECT 1 FROM t404_reaction_qa.claims c
    WHERE c.tenant_id=p_tenant AND c.page_id=p_page AND c.sender_id=p_sender
      AND c.action='react'
      AND c.claimed_at > v_now - pg_catalog.make_interval(secs => p_cooldown_seconds)
  ) THEN RETURN false; END IF;

  -- Lock above serializes read-check-insert for same tenant/Page/sender.
  IF (
    SELECT count(*) FROM t404_reaction_qa.claims c
    WHERE c.tenant_id=p_tenant AND c.page_id=p_page AND c.sender_id=p_sender
      AND c.action='react' AND c.claimed_at > v_now - interval '1 hour'
  ) >= p_hourly_limit THEN RETURN false; END IF;

  INSERT INTO t404_reaction_qa.claims(tenant_id,page_id,sender_id,message_id,action,claimed_at)
  VALUES (p_tenant,p_page,p_sender,p_mid,'react',v_now)
  ON CONFLICT (tenant_id,page_id,sender_id,message_id,action) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;
REVOKE ALL ON FUNCTION t404_reaction_qa.try_claim(text,text,text,text,integer,integer) FROM PUBLIC;
COMMIT;
