-- TIEN404 AI V13.6M.2 MESSENGER BINDING — PROPOSAL ONLY; NOT A MIGRATION.
-- Requires independent approval of V14.2 Store/RLS migration, backup and rollback.
BEGIN;
DO $stop$
BEGIN
 RAISE EXCEPTION 'V13_6M2_PAGE_BINDING_NOT_APPROVED';
END;
$stop$;
-- INERT DESIGN. WILL NEVER REACH THIS WITHOUT REMOVING THE APPROVAL GATE.
CREATE TABLE app_private.messenger_page_bindings (
 page_id text PRIMARY KEY CHECK (page_id ~ '^[0-9]{5,30}$'),
 tenant_id uuid NOT NULL,
 store_id uuid NOT NULL,
 state text NOT NULL DEFAULT 'pending'
   CHECK (state IN ('pending','active','paused','revoked')),
 owner_verified boolean NOT NULL DEFAULT false,
 inbound_enabled boolean NOT NULL DEFAULT false,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 owner_approval_ref text,
 verified_at timestamptz,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,store_id) REFERENCES public.stores(tenant_id,id)
   ON DELETE RESTRICT,
 CHECK (NOT (state='active' AND owner_verified AND inbound_enabled)
   OR (owner_approval_ref IS NOT NULL AND verified_at IS NOT NULL))
);
-- PRIVATE schema, non-exposed. Must audit privileges and create a restricted
-- server-only read role separately, never a public SECURITY DEFINER endpoint.
REVOKE ALL ON app_private.messenger_page_bindings FROM PUBLIC,anon,authenticated;
ALTER TABLE app_private.messenger_page_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.messenger_page_bindings FORCE ROW LEVEL SECURITY;
-- No service-role browser access, no credential storage and no granted live role.
ROLLBACK;
