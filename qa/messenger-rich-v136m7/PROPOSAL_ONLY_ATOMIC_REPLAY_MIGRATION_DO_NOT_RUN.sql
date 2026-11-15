-- TIEN404 V13.6M.7 ATOMIC REPLAY MIGRATION REVIEW (NOT EXECUTABLE)
-- This file is NOT the ephemeral PostgreSQL CI fixture and is NOT a migration.
-- NEVER run on Supabase staging or production. The unconditional STOP stays.
DO $m7_review_stop$
BEGIN
  RAISE EXCEPTION 'TIEN404_V13_6M7_OWNER_APPROVAL_AND_RESTORE_REQUIRED';
END
$m7_review_stop$;

-- CRITICAL DESIGN FINDING:
-- V13.6M.5 proposes UNIQUE(tenant_id, store_id, page_id, sender_hash,
-- binding_version, event_hash). Both sender_hash and event_hash change when
-- rotating the HMAC key. A previously claimed event could be accepted AGAIN.
-- V13.6M.6 synthetic dual-read across old/new keys is not a distributed,
-- atomic PostgreSQL claim in a multi-worker deployment.
--
-- PROPOSED REVIEW OPTION (not approved):
-- - Store a canonical_event_digest computed by an independently keyed,
--   domain-separated, server-side HMAC over VERIFIED tenant/store/Page/PSID/
--   Meta MID or deterministic normalized fallback. Never trust a tenant,
--   store, sender or canonical digest supplied by the browser/AI Agent.
-- - UNIQUE(tenant_id,store_id,page_id,canonical_event_digest) serves as
--   PostgreSQL arbiter for concurrent claims across all live workers.
-- - Versioned sender_hash/event_hash/key_version remain optional metadata
--   only, never the arbiter for replay uniqueness. Do not store raw PSID.
-- - Canonical anchor key lifecycle MUST be separately reviewed. Changing
--   that key without a versioned migration can also re-admit duplicates.
-- - Keep CLAIMED records until reconciled; never auto-finalize as SENT.
-- - Real role permissions, grants, FORCE RLS, role impersonation and Data API
--   schema exposure must be verified. Do not use service_role for RLS proof.
--
-- REQUIRED STAGING DEPENDENCIES:
-- V14.2 canonical public.stores + store_memberships + products.store_id and
-- atomic replacement of tenant-wide permissive RLS, owner-confirmed row
-- backfill (currently 2 Products + 2 Orders), backed-up and restored.
-- Independently approved Page binding and private Event Store schema,
-- revocable Page owner consent, restricted Postgres DB role and session scope.
-- Real same-tenant multi-Store authorized JWT QA and cross-tenant negative QA.
-- Privileged SECURITY DEFINER RPCs (existing advisor WARN) reviewed.
--
-- REQUIRED BACKUP EVIDENCE (UNKNOWN, NOT VERIFIED):
-- Timestamped recoverable backup identifier, retention, location of restricted
-- evidence, isolated restore rehearsal and checksum/schema/RLS comparison,
-- approved rollback runbook, owner signature and distinct reviewer.
-- Connected Supabase MCP has no verified backup listing/export/restore tool.
--
-- DEPLOY GATES:
-- - Owner approves migration and costs separately after evidence is reviewed.
-- - Generate actual migration only with authorized Supabase CLI workflow;
--   do not copy this file into a migration or remove the STOP instruction.
-- - No automatic customer backfill, old-key removal, replay cleanup, Meta
--   sends, order writes, credential changes, or production deploy.
--
-- SAFE ROLLBACK HERE: close the V13.6M.7 Draft PR. No hosted DB state exists.
