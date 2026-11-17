-- TIEN404 V15.0-10U.1 — ADDITIVE V2 MAPPING ONLY — APPROVAL-BOUND.
-- CRITICAL: REVIEW-ONLY. NEVER paste/run on hosted Supabase. This file intentionally aborts.
-- Requiring: proven M0 restore, v1 caller mapping & PR review, approved operator and security design.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '5s';
DO $$ BEGIN RAISE EXCEPTION 'REVIEW_ONLY_V15_0_10U1_NO_APPROVED_MIGRATION'; END $$;
-- Statements below are UNREACHABLE while above guard remains in place.
-- Disposable PostgreSQL 17 ONLY after separately approved review and deliberate guard removal.

-- Preserve tien404_r1_qa.tenant_identity_map UNCHANGED (PK tenant_key, unique auth_tenant_id).
-- Preserve all existing Shop B / Owner RPCs and their grants UNCHANGED.
CREATE TABLE tien404_r1_qa.tenant_authorities_v2 (
  tenant_key text PRIMARY KEY,
  auth_tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT v2_tenant_qa_key CHECK (tenant_key ~ '^qa-[a-z0-9-]+$')
);
CREATE TABLE tien404_r1_qa.stores_v2 (
  tenant_key text NOT NULL REFERENCES tien404_r1_qa.tenant_authorities_v2(tenant_key) ON DELETE RESTRICT,
  store_key text NOT NULL,
  status text NOT NULL DEFAULT 'disabled' CHECK (status IN ('active','disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_key,store_key),
  CONSTRAINT v2_store_qa_key CHECK (store_key ~ '^qa-[a-z0-9-]+$')
);
CREATE TABLE tien404_r1_qa.store_bot_identity_map_v2 (
  tenant_key text NOT NULL,
  store_key text NOT NULL,
  bot_key text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('qa-fixture','zalo','messenger','website')),
  external_bot_hash text NOT NULL CHECK (external_bot_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'revoked' CHECK (status IN ('active','revoked')),
  valid_from timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_key,store_key,bot_key),
  UNIQUE(channel,external_bot_hash),
  FOREIGN KEY(tenant_key,store_key) REFERENCES tien404_r1_qa.stores_v2(tenant_key,store_key) ON DELETE RESTRICT,
  FOREIGN KEY(tenant_key,store_key,bot_key) REFERENCES tien404_r1_qa.shop_bots(tenant_key,store_key,bot_key) ON DELETE RESTRICT,
  CHECK (expires_at>valid_from)
);
CREATE TABLE tien404_r1_qa.store_reader_memberships_v2 (
  subject_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  tenant_key text NOT NULL,
  store_key text NOT NULL,
  permission text NOT NULL DEFAULT 'catalog_read' CHECK (permission='catalog_read'),
  status text NOT NULL DEFAULT 'revoked' CHECK (status IN ('active','revoked')),
  revoked_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(subject_id,tenant_key,store_key),
  FOREIGN KEY(tenant_key,store_key) REFERENCES tien404_r1_qa.stores_v2(tenant_key,store_key) ON DELETE RESTRICT,
  CHECK (status='revoked' OR revoked_at IS NULL)
);
CREATE INDEX v2_reader_membership_store_idx ON tien404_r1_qa.store_reader_memberships_v2(tenant_key,store_key,subject_id);
CREATE INDEX v2_bot_expiry_idx ON tien404_r1_qa.store_bot_identity_map_v2(status,expires_at);

-- Defense in depth; no new SELECT grants or policies. All readers denied by default.
ALTER TABLE tien404_r1_qa.tenant_authorities_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE tien404_r1_qa.tenant_authorities_v2 FORCE ROW LEVEL SECURITY;
ALTER TABLE tien404_r1_qa.stores_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE tien404_r1_qa.stores_v2 FORCE ROW LEVEL SECURITY;
ALTER TABLE tien404_r1_qa.store_bot_identity_map_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE tien404_r1_qa.store_bot_identity_map_v2 FORCE ROW LEVEL SECURITY;
ALTER TABLE tien404_r1_qa.store_reader_memberships_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE tien404_r1_qa.store_reader_memberships_v2 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON tien404_r1_qa.tenant_authorities_v2 FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON tien404_r1_qa.stores_v2 FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON tien404_r1_qa.store_bot_identity_map_v2 FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON tien404_r1_qa.store_reader_memberships_v2 FROM PUBLIC, anon, authenticated, service_role;
-- NO v1 DROP/ALTER. NO CREATE ROLE / CREDENTIAL. NO SELECT policy in this migration.
COMMIT;