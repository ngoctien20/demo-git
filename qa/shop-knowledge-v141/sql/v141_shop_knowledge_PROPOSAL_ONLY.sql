-- TIEN404 AI V14.1 — PROPOSED / NOT APPROVED / DO NOT EXECUTE AS-IS
-- Existing staging schema has NO public.stores and no store_id in commerce tables.
-- This script intentionally FAILS CLOSED before any DDL. Do not remove the gate
-- until store identity / RLS plan and hosted Shop A/B session tests are authorized.
BEGIN;
DO $$
BEGIN
  RAISE EXCEPTION 'BLOCKED_V141_REQUIRES_OWNER_APPROVAL_AND_CANONICAL_STORE_RLS';
END $$;

-- From here down is REVIEW DRAFT, unreachable until safety gate is removed
-- by a separately approved migration change.
CREATE SCHEMA IF NOT EXISTS app_private;

-- Dependencies required before real execution:
-- public.stores(id uuid,tenant_id uuid) with UNIQUE(tenant_id,id)
-- public.staff_store_assignments protected with server-verified membership.
-- Do not use legacy tien404_r1_qa store_key as production authorization.

CREATE TABLE IF NOT EXISTS app_private.shop_knowledge_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  store_id uuid NOT NULL,
  version text NOT NULL CHECK(length(trim(version)) BETWEEN 2 AND 80),
  state text NOT NULL CHECK(state IN ('DRAFT','REVIEW','APPROVED','PUBLISHED','ARCHIVED')),
  content_sha256 text CHECK(content_sha256 ~ '^[a-f0-9]{64}$'),
  created_by uuid NOT NULL,
  reviewed_by uuid,
  merchant_approved_by uuid,
  published_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  merchant_approved_at timestamptz,
  published_at timestamptz,
  archived_at timestamptz,
  CONSTRAINT release_store_fk FOREIGN KEY (tenant_id,store_id)
    REFERENCES public.stores(tenant_id,id) ON DELETE RESTRICT,
  CONSTRAINT release_scope_identity UNIQUE (tenant_id,store_id,id),
  CONSTRAINT version_unique_per_store UNIQUE (tenant_id,store_id,version),
  CONSTRAINT distinct_reviewer CHECK(reviewed_by IS NULL OR reviewed_by <> created_by)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_published_knowledge_release_per_store
 ON app_private.shop_knowledge_releases(tenant_id,store_id) WHERE state='PUBLISHED';

CREATE TABLE IF NOT EXISTS app_private.shop_knowledge_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  store_id uuid NOT NULL,
  item_type text NOT NULL CHECK(item_type IN ('PROFILE','FAQ','POLICY','BEHAVIOR')),
  topic text NOT NULL CHECK(length(topic) BETWEEN 2 AND 100),
  question text,
  value text NOT NULL CHECK(length(trim(value)) BETWEEN 1 AND 4000),
  visibility text NOT NULL CHECK(visibility IN ('PUBLIC','STAFF_ONLY','RESTRICTED')),
  source_ref text NOT NULL CHECK(length(trim(source_ref)) BETWEEN 2 AND 250),
  source_status text NOT NULL CHECK(source_status IN ('UNVERIFIED','VERIFIED','REJECTED')),
  effective_at timestamptz NOT NULL,
  expires_at timestamptz,
  merchant_approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT items_release_scope_fk FOREIGN KEY (tenant_id,store_id,release_id)
   REFERENCES app_private.shop_knowledge_releases(tenant_id,store_id,id) ON DELETE RESTRICT,
  CONSTRAINT items_valid_period CHECK(expires_at IS NULL OR expires_at>effective_at),
  CONSTRAINT faq_question_required CHECK(item_type<>'FAQ' OR length(trim(coalesce(question,'')))>=3)
);
CREATE INDEX IF NOT EXISTS knowledge_lookup_by_scope_topic
 ON app_private.shop_knowledge_items(tenant_id,store_id,release_id,topic,visibility);
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_item_unique_topic_for_non_faq
 ON app_private.shop_knowledge_items(tenant_id,store_id,release_id,item_type,topic)
 WHERE item_type<>'FAQ';

CREATE TABLE IF NOT EXISTS app_private.shop_knowledge_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL,
  store_id uuid NOT NULL,
  release_id uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  action text NOT NULL,
  reason text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  previous_hash text,
  next_hash text,
  CONSTRAINT audit_release_scope_fk FOREIGN KEY(tenant_id,store_id,release_id)
   REFERENCES app_private.shop_knowledge_releases(tenant_id,store_id,id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS knowledge_audit_scope_time
 ON app_private.shop_knowledge_audit(tenant_id,store_id,occurred_at DESC);

ALTER TABLE app_private.shop_knowledge_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.shop_knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.shop_knowledge_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.shop_knowledge_releases FROM PUBLIC, anon, authenticated;
REVOKE ALL ON app_private.shop_knowledge_items FROM PUBLIC, anon, authenticated;
REVOKE ALL ON app_private.shop_knowledge_audit FROM PUBLIC, anon, authenticated;

-- NO client-facing grants or policies here. Any future access path must:
-- 1) resolve store_id from authenticated server-side membership, not a body param;
-- 2) enforce recipient role and assignment, short-lived session, audit read;
-- 3) return only PUBLISHED + PUBLIC + verified + merchant-approved + effective rows;
-- 4) expose no SECURITY DEFINER function to anon/authenticated without review;
-- 5) compare release version and enforce CAS/idempotent publication transaction.
COMMIT;

-- ROLLBACK PLANNING ONLY (NOT AN EXECUTABLE DOWN MIGRATION):
-- disable routes, retain audit evidence, restore prior published release atomically,
-- then separately approve database down-migration with backups before dropping.
