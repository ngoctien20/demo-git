-- TIEN404 V19.8.10 / LOCAL DOCKER ONLY.
-- Simulated privately managed Bot Installation / Owner Consent and durable test inbox.
-- This schema is NOT a hosted migration. No real provider credentials or customer data.
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE public.t404_v19810_installations (
 installation_ref text PRIMARY KEY CHECK(installation_ref ~ '^QA_INSTALL_[A-Z]$'),
 endpoint_ref text NOT NULL UNIQUE CHECK(endpoint_ref ~ '^QA_ENDPOINT_[A-Z]$'),
 bot_ref text NOT NULL UNIQUE CHECK(bot_ref ~ '^QA_BOT_[A-Z]$'),
 credential_ref text NOT NULL CHECK(credential_ref ~ '^QA_CRED_[A-Z]$'),
 credential_epoch integer NOT NULL CHECK(credential_epoch>0),
 tenant_id uuid NOT NULL,
 store_code text NOT NULL CHECK(store_code IN ('A','B')),
 owner_user_id uuid NOT NULL,
 state text NOT NULL CHECK(state IN ('qa_active','revoked')),
 version integer NOT NULL CHECK(version>0),
 verified_at timestamptz NOT NULL,
 revoked_at timestamptz,
 FOREIGN KEY(tenant_id,store_code,owner_user_id)
   REFERENCES public.t404_v1989_store_memberships(tenant_id,store_code,user_id),
 UNIQUE(installation_ref,owner_user_id)
);
CREATE TABLE public.t404_v19810_owner_consents (
 installation_ref text PRIMARY KEY,
 owner_user_id uuid NOT NULL,
 consent text NOT NULL CHECK(consent IN ('consented_readonly_qa','revoked')),
 approved_version integer NOT NULL CHECK(approved_version>0),
 approved_at timestamptz NOT NULL,
 revoked_at timestamptz,
 FOREIGN KEY(installation_ref,owner_user_id)
  REFERENCES public.t404_v19810_installations(installation_ref,owner_user_id)
);
CREATE TABLE public.t404_v19810_event_inbox (
 installation_ref text NOT NULL
  REFERENCES public.t404_v19810_installations(installation_ref),
 event_ref text NOT NULL CHECK(event_ref ~ '^EVT_[A-Z0-9_]{3,40}$'),
 received_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(installation_ref,event_ref)
);
ALTER TABLE public.t404_v19810_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t404_v19810_owner_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t404_v19810_event_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t404_v19810_installations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.t404_v19810_owner_consents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.t404_v19810_event_inbox FORCE ROW LEVEL SECURITY;
-- Internal resolver simulation uses local disposable postgres in QA, NOT Data API
-- or a client-provided service role. No anon/authenticated access or RLS policy.
REVOKE ALL ON public.t404_v19810_installations,
 public.t404_v19810_owner_consents,public.t404_v19810_event_inbox
 FROM PUBLIC,anon,authenticated;
COMMIT;
