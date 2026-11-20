-- TIEN404 V19.8.11 — LOCAL AUTH JWT merchant-consent fixture only.
-- This is NOT a hosted migration. Requires existing V19.8.9 + V19.8.10 QA schemas.
-- Installation membership is server-owned; authenticated owner may change ONLY
-- their own consent STATUS via RLS, never installation/tenant/Store identity.
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE public.t404_v19811_owner_consents (
 installation_ref text PRIMARY KEY,
 owner_user_id uuid NOT NULL,
 tenant_id uuid NOT NULL,
 store_code text NOT NULL,
 binding_version integer NOT NULL CHECK(binding_version>0),
 challenge_ref text NOT NULL UNIQUE,
 scope text NOT NULL CHECK(scope='readonly_catalog_qa_only'),
 state text NOT NULL CHECK(state IN ('pending','approved','revoked')),
 requested_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 approved_at timestamptz,
 revoked_at timestamptz,
 FOREIGN KEY(installation_ref,owner_user_id)
  REFERENCES public.t404_v19810_installations(installation_ref,owner_user_id),
 FOREIGN KEY(tenant_id,store_code,owner_user_id)
  REFERENCES public.t404_v1989_store_memberships(tenant_id,store_code,user_id)
);
ALTER TABLE public.t404_v19811_owner_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t404_v19811_owner_consents FORCE ROW LEVEL SECURITY;

CREATE POLICY v19811_owner_read ON public.t404_v19811_owner_consents
 FOR SELECT TO authenticated USING (
  owner_user_id=(SELECT auth.uid())
  AND EXISTS(SELECT 1 FROM public.t404_v1989_store_memberships sm
    WHERE sm.tenant_id=t404_v19811_owner_consents.tenant_id
      AND sm.store_code=t404_v19811_owner_consents.store_code
      AND sm.user_id=(SELECT auth.uid()) AND sm.active=true AND sm.role='owner')
  AND EXISTS(SELECT 1 FROM public.t404_v1989_tenant_memberships tm
    WHERE tm.tenant_id=t404_v19811_owner_consents.tenant_id
      AND tm.user_id=(SELECT auth.uid()) AND tm.owner_active=true)
);
CREATE POLICY v19811_owner_change_consent ON public.t404_v19811_owner_consents
 FOR UPDATE TO authenticated
 USING (
   owner_user_id=(SELECT auth.uid()) AND state IN ('pending','approved')
   AND EXISTS(SELECT 1 FROM public.t404_v1989_store_memberships sm
      WHERE sm.tenant_id=t404_v19811_owner_consents.tenant_id
      AND sm.store_code=t404_v19811_owner_consents.store_code
      AND sm.user_id=(SELECT auth.uid()) AND sm.active=true AND sm.role='owner')
   AND EXISTS(SELECT 1 FROM public.t404_v1989_tenant_memberships tm
      WHERE tm.tenant_id=t404_v19811_owner_consents.tenant_id
      AND tm.user_id=(SELECT auth.uid()) AND tm.owner_active=true)
 )
 WITH CHECK (
   owner_user_id=(SELECT auth.uid()) AND state IN ('approved','revoked')
   AND EXISTS(SELECT 1 FROM public.t404_v1989_store_memberships sm
      WHERE sm.tenant_id=t404_v19811_owner_consents.tenant_id
      AND sm.store_code=t404_v19811_owner_consents.store_code
      AND sm.user_id=(SELECT auth.uid()) AND sm.active=true AND sm.role='owner')
 );
CREATE FUNCTION public.t404_v19811_consent_transition_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog
AS $$
BEGIN
 IF OLD.state='pending' AND NEW.state='approved'
   AND OLD.expires_at>statement_timestamp()
   AND OLD.approved_at IS NULL AND OLD.revoked_at IS NULL THEN
   NEW.approved_at=statement_timestamp();
   NEW.revoked_at=NULL;
 ELSIF OLD.state='approved' AND NEW.state='revoked' AND OLD.revoked_at IS NULL THEN
   NEW.revoked_at=statement_timestamp();
 ELSE
   RAISE EXCEPTION 'Consent status transition denied';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.t404_v19811_consent_transition_guard()
 FROM PUBLIC,anon,authenticated;
CREATE TRIGGER t404_v19811_consent_status_guard
 BEFORE UPDATE ON public.t404_v19811_owner_consents
 FOR EACH ROW EXECUTE FUNCTION public.t404_v19811_consent_transition_guard();
REVOKE ALL ON public.t404_v19811_owner_consents FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.t404_v19811_owner_consents TO authenticated;
GRANT UPDATE(state) ON public.t404_v19811_owner_consents TO authenticated;
COMMIT;
