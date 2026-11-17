-- V17.1D: two-step source approval on EXACT disposable PostgreSQL 17.
-- Run only after qa/v171c-commerce/pg17-private-link-context-disposable-only.sql
\set ON_ERROR_STOP on
DO $g$
BEGIN
 IF current_database()<>'t404_v171c_ci' OR current_user<>'postgres'
 OR current_setting('tien404.v171c_ephemeral',true)<>'RPC171C_DISPOSABLE'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('qa_v171c.link_challenges') IS NULL
 THEN RAISE EXCEPTION 'V171D_REFUSE_NON_DISPOSABLE_LINK'; END IF;
END $g$;
CREATE TABLE qa_v171c.pending_link_approvals(
 token_hash text PRIMARY KEY REFERENCES qa_v171c.link_challenges(token_hash),
 tenant_id text NOT NULL,
 store_id text NOT NULL,
 target_channel text NOT NULL CHECK (target_channel IN ('MESSENGER','ZALO_OA','ZALO_BOT')),
 target_account_id text NOT NULL,
 target_subject_hash text NOT NULL CHECK (target_subject_hash ~ '^[a-f0-9]{64}$'),
 status text NOT NULL DEFAULT 'PENDING_SOURCE' CHECK (status IN ('PENDING_SOURCE','SOURCE_APPROVED')),
 source_approved_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(tenant_id,store_id) REFERENCES qa_v171c.stores(tenant_id,store_id),
 CHECK ((status='PENDING_SOURCE' AND source_approved_at IS NULL)
    OR (status='SOURCE_APPROVED' AND source_approved_at IS NOT NULL))
);
ALTER TABLE qa_v171c.pending_link_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_v171c.pending_link_approvals FORCE ROW LEVEL SECURITY;
REVOKE ALL ON qa_v171c.pending_link_approvals FROM PUBLIC;
COMMENT ON TABLE qa_v171c.pending_link_approvals IS
 'V17.1D throwaway CI source-confirmed target link; no real provider signature or Merchant data';
