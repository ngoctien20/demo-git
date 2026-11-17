-- TIEN404 V17.1C: private-schema, disposable PostgreSQL 17 ONLY.
-- This is a QA schema, NOT a Supabase migration. No production identifiers.
-- Database: t404_v171c_ci; role: postgres; GUC: RPC171C_DISPOSABLE.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'t404_v171c_ci'
  OR current_user<>'postgres'
  OR current_setting('tien404.v171c_ephemeral',true)<>'RPC171C_DISPOSABLE'
  OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 THEN RAISE EXCEPTION 'V171C_DISPOSABLE_PG17_ONLY';END IF;
END $guard$;
CREATE SCHEMA qa_v171c;
REVOKE ALL ON SCHEMA qa_v171c FROM PUBLIC;
CREATE ROLE qa_v171c_untrusted NOLOGIN;
CREATE TABLE qa_v171c.stores (
 tenant_id text NOT NULL,
 store_id text NOT NULL,
 PRIMARY KEY(tenant_id,store_id)
);
INSERT INTO qa_v171c.stores VALUES
 ('qa-tenant-1','qa-store-a'),
 ('qa-tenant-1','qa-store-b'),
 ('qa-tenant-2','qa-store-c');
CREATE TABLE qa_v171c.link_challenges (
 token_hash text PRIMARY KEY CHECK(token_hash ~ '^[a-f0-9]{64}$'),
 tenant_id text NOT NULL,
 store_id text NOT NULL,
 source_channel text NOT NULL CHECK(source_channel IN('MESSENGER','ZALO_BOT','ZALO_OA')),
 source_subject_hash text NOT NULL,
 target_channel text NOT NULL CHECK(target_channel IN('MESSENGER','ZALO_BOT','ZALO_OA')),
 canonical_customer_id text NOT NULL,
 issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 FOREIGN KEY(tenant_id,store_id) REFERENCES qa_v171c.stores(tenant_id,store_id),
 CHECK(expires_at>issued_at),
 CHECK(source_channel<>target_channel)
);
CREATE TABLE qa_v171c.identity_links (
 tenant_id text NOT NULL,
 store_id text NOT NULL,
 channel text NOT NULL,
 account_id text NOT NULL,
 subject_hash text NOT NULL,
 canonical_customer_id text NOT NULL,
 linked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 status text NOT NULL DEFAULT 'active' CHECK(status IN('active','revoked')),
 PRIMARY KEY(tenant_id,store_id,channel,account_id,subject_hash),
 FOREIGN KEY(tenant_id,store_id) REFERENCES qa_v171c.stores(tenant_id,store_id)
);
CREATE TABLE qa_v171c.conversation_sessions (
 tenant_id text NOT NULL,
 store_id text NOT NULL,
 canonical_customer_id text NOT NULL,
 state jsonb NOT NULL DEFAULT '{}'::jsonb,
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>=1),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL,
 PRIMARY KEY(tenant_id,store_id,canonical_customer_id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES qa_v171c.stores(tenant_id,store_id),
 CHECK (jsonb_typeof(state)='object' AND length(state::text)<1024)
);
CREATE TABLE qa_v171c.inbound_event_claims (
 tenant_id text NOT NULL,
 store_id text NOT NULL,
 channel text NOT NULL,
 account_id text NOT NULL,
 event_id text NOT NULL,
 claimed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL,
 PRIMARY KEY(tenant_id,store_id,channel,account_id,event_id),
 FOREIGN KEY(tenant_id,store_id) REFERENCES qa_v171c.stores(tenant_id,store_id)
);
ALTER TABLE qa_v171c.link_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_v171c.link_challenges FORCE ROW LEVEL SECURITY;
ALTER TABLE qa_v171c.identity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_v171c.identity_links FORCE ROW LEVEL SECURITY;
ALTER TABLE qa_v171c.conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_v171c.conversation_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE qa_v171c.inbound_event_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_v171c.inbound_event_claims FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA qa_v171c FROM PUBLIC;
-- No GRANT to anon/authenticated, no SECURITY DEFINER and no web exposure.
-- QA postgres owns the tables; this does not certify a hosted least-privilege role.
