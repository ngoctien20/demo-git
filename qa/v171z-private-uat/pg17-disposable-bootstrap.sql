-- V17.1Z DISPOSABLE PG17 TEST BOOTSTRAP, ONLY in GitHub Actions service container.
-- THESE ARE FAKE QA subjects, NEVER actual Supabase Auth users/JWT.
CREATE SCHEMA auth;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $uid$
 SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid;
$uid$;
CREATE TABLE public.tenants(id uuid PRIMARY KEY);
CREATE TABLE public.tenant_memberships(
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 role text NOT NULL CHECK (role IN ('owner','manager','staff')),
 active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(tenant_id,user_id)
);
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
GRANT SELECT ON public.tenant_memberships TO authenticated;
