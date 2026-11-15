-- TIEN404 V13.6M.7 — EPHEMERAL CI POSTGRES ONLY, NOT a Supabase migration.
-- Exact database guard must run BEFORE any CREATE/ALTER/GRANT.
-- Never run this in an existing user database. Only GitHub Actions job DB
-- named tien404_replay_ci is allowed. Synthetic records and credentials only.
\set ON_ERROR_STOP on
DO $m7_guard$
BEGIN
 IF current_database() <> 'tien404_replay_ci' OR current_user <> 'postgres' THEN
  RAISE EXCEPTION 'M7_EPHEMERAL_ONLY_DO_NOT_MIGRATE';
 END IF;
END
$m7_guard$;

CREATE SCHEMA qa_messenger_v136m7;
REVOKE ALL ON SCHEMA qa_messenger_v136m7 FROM PUBLIC;

-- REVIEW DIFFERENCE from V13.6M.5:
-- Rotating sender/event HMAC alone changes the old UNIQUE composite.
-- A stable canonical_event_digest, derived from an INDEPENDENT SERVER-ONLY
-- key covering verified Page/PSID/MID and tenant/store, is needed to avoid
-- v1 vs v2 concurrent duplicate inserts. The anchor key must itself have
-- an explicitly reviewed long-term rotation/retention strategy.
-- No raw PSID, raw body, token, customer text or AI response in this table.
CREATE TABLE qa_messenger_v136m7.event_claims (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 tenant_id uuid NOT NULL,
 store_id uuid NOT NULL,
 page_id text NOT NULL CHECK(page_id ~ '^[0-9]{5,30}$'),
 canonical_event_digest char(64) NOT NULL CHECK(canonical_event_digest ~ '^[0-9a-f]{64}$'),
 sender_hash char(64) NOT NULL CHECK(sender_hash ~ '^[0-9a-f]{64}$'),
 event_hash char(64) NOT NULL CHECK(event_hash ~ '^[0-9a-f]{64}$'),
 key_version text NOT NULL CHECK(key_version ~ '^v[1-9][0-9]{0,3}$'),
 binding_version integer NOT NULL CHECK(binding_version > 0),
 lease_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'CLAIMED'
   CHECK(status IN ('CLAIMED','PREVIEW_READY','REJECTED')),
 claimed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 completed_at timestamptz NULL,
 expires_at timestamptz NOT NULL,
 CONSTRAINT ci_unique_canonical_replay
  UNIQUE(tenant_id,store_id,page_id,canonical_event_digest)
);
ALTER TABLE qa_messenger_v136m7.event_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_messenger_v136m7.event_claims FORCE ROW LEVEL SECURITY;
REVOKE ALL ON qa_messenger_v136m7.event_claims FROM PUBLIC;

-- Negatively test a low-privilege account. This is NOT a hosted Supabase JWT.
CREATE ROLE qa_messenger_ci_denied NOLOGIN NOSUPERUSER NOBYPASSRLS
 NOCREATEDB NOCREATEROLE NOINHERIT;
GRANT USAGE ON SCHEMA qa_messenger_v136m7 TO qa_messenger_ci_denied;
GRANT SELECT ON qa_messenger_v136m7.event_claims TO qa_messenger_ci_denied;
-- No RLS policies: reader sees ZERO rows. Host acceptance requires
-- separately designed scoped policies and real JWTs for Shop A/B.
