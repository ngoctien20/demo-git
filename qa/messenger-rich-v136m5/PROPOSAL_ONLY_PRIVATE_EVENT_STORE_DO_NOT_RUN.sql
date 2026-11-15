-- TIEN404 V13.6M.5: PRIVATE EVENT STORE BLUEPRINT, REVIEW ONLY
-- NOT A MIGRATION; staging lacks the canonical stores, bindings and products.store_id.
-- Unconditionally ABORT if someone tries to run this file. Never remove this
-- guard except in a SEPARATELY APPROVED, backed-up and reviewed migration.
DO $tien404_m5_block$
BEGIN
  RAISE EXCEPTION 'TIEN404_V13_6M5_MIGRATION_NOT_APPROVED';
END
$tien404_m5_block$;

-- FUTURE DDL DESIGN (COMMENTED OUT — not executable):
-- CREATE TABLE app_private.messenger_event_claims (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   tenant_id uuid NOT NULL,
--   store_id uuid NOT NULL,
--   page_id text NOT NULL,
--   sender_hash char(64) NOT NULL,
--   binding_version integer NOT NULL CHECK (binding_version > 0),
--   event_hash char(64) NOT NULL,
--   status text NOT NULL CHECK (status IN ('CLAIMED','PREVIEW_READY','REJECTED')),
--   lease_id uuid NOT NULL,
--   claimed_at timestamptz NOT NULL,
--   completed_at timestamptz NULL,
--   expires_at timestamptz NOT NULL,
--   CONSTRAINT uq_messenger_event_scope UNIQUE
--     (tenant_id,store_id,page_id,sender_hash,binding_version,event_hash)
-- );
-- ALTER TABLE app_private.messenger_event_claims ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE app_private.messenger_event_claims FORCE ROW LEVEL SECURITY;
-- REVOKE ALL ON app_private.messenger_event_claims FROM PUBLIC,anon,authenticated,service_role;
--
-- DESIGN GATES:
-- 1. app_private MUST be absent from Supabase Data API exposed schemas;
--    verify real grants, schema USAGE, PUBLIC defaults and API endpoints.
-- 2. Create approved least-privilege DB role with NO BYPASSRLS, not table owner;
--    secure session identity derived from server VERIFIED Page→Tenant→Store,
--    not from request JSON, custom user_metadata or insecure set_config.
-- 3. Role-specific RLS policies need independent hosted Shop A/B, cross-tenant,
--    same-tenant cross-Store tests, and negative owner-revocation tests.
-- 4. Atomic INSERT... ON CONFLICT DO NOTHING RETURNING inside DB transaction;
--    identical claim key has exactly 1 winner, even across worker instances.
-- 5. Finalize under lease_id and status=CLAIMED; stale leases MUST NOT be
--    automatically reclaimed without durable outcome/inflight checks.
-- 6. expiry/retention cleanup is a separately reviewed operation: deleting
--    expired keys may allow replay after the dedupe window. Reconcile policies.
-- 7. No raw Messenger PSID, message text, photo, payload, access token,
--    app secret or phone number belongs in this table. Sender is keyed HMAC.
-- 8. Key rotation MUST preserve deduplication: use versioned index/dual-read
--    or equivalent, test old/new-key collisions and replay across rotations.
-- 9. Event store is NOT a provider SEND authorization nor order write.
--    A future outbox needs its own review, policy, transactional guarantees
--    and separate explicit approval.
-- 10. Separate approval requires restorable backup, rollback rehearsal,
--     owner-approved Page binding mapping and V14.2 canonical Store/RLS.
-- 11. Verify DB isolation at actual SQL role level, not just JS flags.
-- 12. Never promote this blueprint to a migration automatically.
