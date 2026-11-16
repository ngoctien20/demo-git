-- TIEN404 V15.2 ADV6A: EPHEMERAL GitHub Actions postgres:17 ONLY.
-- This is NOT the hosted Supabase migration and MUST NEVER be applied there.
-- Preflight DB name, user, 127.0.0.1, CI flag in Node before this is loaded.
DO $$
BEGIN
 IF current_database() <> 'adv6a_qa' OR current_user <> 'adv6a_qa' THEN
   RAISE EXCEPTION 'ADV6A_FORBIDDEN_DATABASE_OR_ROLE';
 END IF;
END $$;
CREATE SCHEMA tien404_action_private;
REVOKE ALL ON SCHEMA tien404_action_private FROM PUBLIC;
CREATE TABLE tien404_action_private.action_nonce_claims (
 nonce_key_hash bytea PRIMARY KEY,
 claimed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 retain_until timestamptz NOT NULL,
 CONSTRAINT t404_nonce_is_sha256 CHECK (octet_length(nonce_key_hash) = 32),
 CONSTRAINT t404_nonce_retention CHECK (retain_until > claimed_at)
);
ALTER TABLE tien404_action_private.action_nonce_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE tien404_action_private.action_nonce_claims FROM PUBLIC;
-- Disposable synthetic business event table (NOT Commerce schema):
CREATE TABLE tien404_action_private.qa_business_effects (
 event_id text PRIMARY KEY,
 nonce_key_hash bytea NOT NULL REFERENCES tien404_action_private.action_nonce_claims(nonce_key_hash),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE tien404_action_private.qa_business_effects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE tien404_action_private.qa_business_effects FROM PUBLIC;
CREATE ROLE adv6a_unprivileged NOLOGIN;
-- No USAGE / table SELECT / write granted to the unprivileged role.
