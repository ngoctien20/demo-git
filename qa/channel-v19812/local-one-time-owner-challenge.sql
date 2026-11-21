-- TIEN404 V19.8.12 — DISPOSABLE LOCAL SUPABASE ONLY / NO HOSTED MIGRATION.
-- Owner consent requires a server-issued one-time 256-bit challenge, a
-- real local Supabase Auth JWT, and a matching active store ownership.
-- Unlike V19.8.11's state-only QA, there is NO direct authenticated DML here.
\set ON_ERROR_STOP on
BEGIN;

CREATE TABLE public.t404_v19812_challenges (
 challenge_ref text PRIMARY KEY CHECK(challenge_ref ~ '^QA_CHALLENGE_[A-Z0-9_]{3,40}$'),
 installation_ref text NOT NULL
  REFERENCES public.t404_v19810_installations(installation_ref),
 owner_user_id uuid NOT NULL REFERENCES auth.users(id),
 tenant_id uuid NOT NULL,
 store_code text NOT NULL CHECK(store_code IN ('A','B')),
 binding_version integer NOT NULL CHECK(binding_version>0),
 scope text NOT NULL CHECK(scope='readonly_catalog_qa_only'),
 nonce_sha256 char(64) NOT NULL CHECK(nonce_sha256 ~ '^[a-f0-9]{64}$'),
 issued_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 state text NOT NULL CHECK(state IN ('pending','consumed','revoked')),
 consumed_at timestamptz,
 UNIQUE(installation_ref,challenge_ref),
 FOREIGN KEY(tenant_id,store_code,owner_user_id)
  REFERENCES public.t404_v1989_store_memberships(tenant_id,store_code,user_id)
);
CREATE TABLE public.t404_v19812_grants (
 installation_ref text PRIMARY KEY
  REFERENCES public.t404_v19810_installations(installation_ref),
 owner_user_id uuid NOT NULL REFERENCES auth.users(id),
 tenant_id uuid NOT NULL,
 store_code text NOT NULL CHECK(store_code IN ('A','B')),
 binding_version integer NOT NULL CHECK(binding_version>0),
 scope text NOT NULL CHECK(scope='readonly_catalog_qa_only'),
 state text NOT NULL CHECK(state IN ('pending','approved','revoked')),
 consented_at timestamptz,
 revoked_at timestamptz,
 FOREIGN KEY(tenant_id,store_code,owner_user_id)
  REFERENCES public.t404_v1989_store_memberships(tenant_id,store_code,user_id)
);

ALTER TABLE public.t404_v19812_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t404_v19812_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t404_v19812_challenges FORCE ROW LEVEL SECURITY;
ALTER TABLE public.t404_v19812_grants FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.t404_v19812_challenges,public.t404_v19812_grants
 FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.t404_v19812_approve_challenge(
 p_installation_ref text,p_challenge_ref text,p_nonce text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE matched_ref text;
BEGIN
 IF auth.uid() IS NULL OR auth.role()<>'authenticated'
    OR p_installation_ref IS NULL OR p_challenge_ref IS NULL
    OR p_nonce !~ '^[a-f0-9]{64}$'
 THEN RETURN false; END IF;
 -- Locks prevent a second concurrent request from consuming the same challenge.
 SELECT ch.challenge_ref INTO matched_ref
 FROM public.t404_v19812_challenges ch
 JOIN public.t404_v19810_installations i
   ON i.installation_ref=ch.installation_ref
 JOIN public.t404_v19812_grants g
   ON g.installation_ref=i.installation_ref
 JOIN public.t404_v1989_store_memberships sm
   ON sm.tenant_id=i.tenant_id AND sm.store_code=i.store_code
      AND sm.user_id=i.owner_user_id
 JOIN public.t404_v1989_tenant_memberships tm
   ON tm.tenant_id=i.tenant_id AND tm.user_id=i.owner_user_id
 WHERE i.installation_ref=p_installation_ref
   AND ch.challenge_ref=p_challenge_ref
   AND i.owner_user_id=auth.uid()
   AND i.state='qa_active' AND i.revoked_at IS NULL
   AND i.verified_at <= statement_timestamp()
   AND ch.owner_user_id=i.owner_user_id
   AND ch.tenant_id=i.tenant_id AND ch.store_code=i.store_code
   AND ch.binding_version=i.version
   AND ch.scope='readonly_catalog_qa_only'
   AND ch.state='pending' AND ch.consumed_at IS NULL
   AND ch.issued_at>=i.verified_at
   AND ch.issued_at<=statement_timestamp()
   AND ch.expires_at>statement_timestamp()
   AND ch.nonce_sha256=encode(sha256(convert_to(p_nonce,'UTF8')),'hex')
   AND g.owner_user_id=i.owner_user_id
   AND g.tenant_id=i.tenant_id AND g.store_code=i.store_code
   AND g.binding_version=i.version
   AND g.scope='readonly_catalog_qa_only'
   AND g.state='pending' AND g.consented_at IS NULL AND g.revoked_at IS NULL
   AND sm.active=true AND sm.role='owner' AND tm.owner_active=true
 FOR UPDATE OF ch,g;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.t404_v19812_challenges
  SET state='consumed',consumed_at=statement_timestamp()
  WHERE challenge_ref=matched_ref AND state='pending';
 UPDATE public.t404_v19812_grants
  SET state='approved',consented_at=statement_timestamp()
  WHERE installation_ref=p_installation_ref AND state='pending';
 RETURN true;
END $fn$;

CREATE FUNCTION public.t404_v19812_revoke_consent(
 p_installation_ref text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE matched_ref text;
BEGIN
 IF auth.uid() IS NULL OR auth.role()<>'authenticated' THEN RETURN false; END IF;
 SELECT g.installation_ref INTO matched_ref
 FROM public.t404_v19812_grants g
 JOIN public.t404_v19810_installations i ON i.installation_ref=g.installation_ref
 JOIN public.t404_v1989_store_memberships sm
  ON sm.tenant_id=i.tenant_id AND sm.store_code=i.store_code AND sm.user_id=i.owner_user_id
 JOIN public.t404_v1989_tenant_memberships tm
  ON tm.tenant_id=i.tenant_id AND tm.user_id=i.owner_user_id
 WHERE g.installation_ref=p_installation_ref
   AND g.owner_user_id=auth.uid() AND i.owner_user_id=auth.uid()
   AND g.tenant_id=i.tenant_id AND g.store_code=i.store_code
   AND g.binding_version=i.version AND g.scope='readonly_catalog_qa_only'
   AND g.state='approved' AND g.revoked_at IS NULL
   AND sm.active=true AND sm.role='owner' AND tm.owner_active=true
 FOR UPDATE OF g;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.t404_v19812_grants
  SET state='revoked',revoked_at=statement_timestamp()
  WHERE installation_ref=matched_ref AND state='approved';
 RETURN true;
END $fn$;

REVOKE ALL ON FUNCTION public.t404_v19812_approve_challenge(text,text,text)
 FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.t404_v19812_revoke_consent(text)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.t404_v19812_approve_challenge(text,text,text)
 TO authenticated;
GRANT EXECUTE ON FUNCTION public.t404_v19812_revoke_consent(text)
 TO authenticated;
COMMIT;
