-- V17.2C.18 CANDIDATE ONLY — NEVER RUN ON CURRENT SUPABASE STAGING.
-- Run ONLY on isolated approved disposable PostgreSQL / private project.
-- The registry is private, NOT an API endpoint. No service-role client exposure.
-- A cryptographic receipt + real server-side Auth consent verification MUST happen
-- before the trusted server/operator may insert an issued entry.
BEGIN;
CREATE SCHEMA tien404_v172c18_private;
REVOKE ALL ON SCHEMA tien404_v172c18_private FROM PUBLIC, anon, authenticated;
CREATE TABLE tien404_v172c18_private.consent_receipts (
  receipt_id text PRIMARY KEY CHECK (receipt_id ~ '^[a-f0-9]{32}$'),
  actor_slot text NOT NULL CHECK (actor_slot IN ('QA_A','QA_B')),
  project_ref text NOT NULL,
  tenant_ref text NOT NULL,
  store_ref text NOT NULL,
  subject_ref text NOT NULL,
  scope text NOT NULL CHECK (scope='synthetic_catalog_readonly_no_send_no_write'),
  reviewer_ref text NOT NULL,
  auth_evidence_ref text NOT NULL,
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'issued'
    CHECK (state IN ('issued','consumed','revoked')),
  consumed_at timestamptz,
  CHECK (expires_at > issued_at AND expires_at <= issued_at + interval '24 hours'),
  CHECK ((state='consumed' AND consumed_at IS NOT NULL)
      OR (state IN ('issued','revoked') AND consumed_at IS NULL))
);
CREATE INDEX qa_consent_scope_idx
 ON tien404_v172c18_private.consent_receipts
 (project_ref,tenant_ref,store_ref,actor_slot,state);
ALTER TABLE tien404_v172c18_private.consent_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tien404_v172c18_private.consent_receipts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA tien404_v172c18_private
 FROM PUBLIC, anon, authenticated;
-- No policy for anon/authenticated: all access denied.
COMMIT;
