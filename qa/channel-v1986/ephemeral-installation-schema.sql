-- TIEN404 V19.8.6 EPHEMERAL PostgreSQL 17 fixture ONLY, NOT a Supabase migration.
-- Run ONLY after qa/channel-v1983/ephemeral-postgres-schema.sql in disposable CI.
-- Bot IDs, credential REFERENCES, owners and Stores below are fabricated QA metadata.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA qa1986;
CREATE ROLE qa1986_verifier NOLOGIN;
GRANT USAGE ON SCHEMA qa1983,qa1986 TO qa1986_verifier;
GRANT SELECT ON qa1983.stores,qa1983.tenant_memberships,qa1983.store_memberships TO qa1986_verifier;
-- Prior fixture memberships have RLS: explicitly admit ONLY the synthetic internal verifier role.
CREATE POLICY qa1986_verifier_tenant ON qa1983.tenant_memberships
 FOR SELECT TO qa1986_verifier USING(true);
CREATE POLICY qa1986_verifier_store ON qa1983.store_memberships
 FOR SELECT TO qa1986_verifier USING(true);
GRANT EXECUTE ON FUNCTION qa1983.assert_count(text,bigint,bigint) TO qa1986_verifier;

CREATE TABLE qa1986.bot_installations (
 installation_ref text PRIMARY KEY,
 endpoint_ref text NOT NULL UNIQUE,
 channel text NOT NULL CHECK(channel='zalo_bot'),
 bot_ref text NOT NULL UNIQUE,
 credential_binding_ref text NOT NULL,
 credential_epoch integer NOT NULL CHECK(credential_epoch>=1),
 tenant_id uuid NOT NULL,
 store_id uuid NOT NULL,
 owner_id uuid NOT NULL,
 state text NOT NULL CHECK(state IN ('pending','qa_active','revoked')),
 version integer NOT NULL CHECK(version>0),
 verified_at timestamptz NOT NULL,
 revoked_at timestamptz,
 FOREIGN KEY(tenant_id,store_id) REFERENCES qa1983.stores(tenant_id,id),
 FOREIGN KEY(tenant_id,store_id,owner_id)
   REFERENCES qa1983.store_memberships(tenant_id,store_id,user_id),
 UNIQUE(tenant_id,store_id,installation_ref)
);

CREATE TABLE qa1986.owner_consents (
 installation_ref text PRIMARY KEY REFERENCES qa1986.bot_installations(installation_ref),
 tenant_id uuid NOT NULL,
 store_id uuid NOT NULL,
 owner_id uuid NOT NULL,
 consent text NOT NULL CHECK(consent IN ('pending','consented_readonly_qa','revoked')),
 approved_version integer NOT NULL CHECK(approved_version>0),
 approved_at timestamptz NOT NULL,
 revoked_at timestamptz,
 FOREIGN KEY(tenant_id,store_id,owner_id)
  REFERENCES qa1983.store_memberships(tenant_id,store_id,user_id)
);
INSERT INTO qa1986.bot_installations VALUES
 ('QA_INSTALL_A','QA_ENDPOINT_A','zalo_bot','QA_BOT_A','QA_CRED_REF_A',2,
 '00000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 'aaaaaaaa-0000-0000-0000-000000000001','qa_active',3,
 statement_timestamp()-interval '2 days',NULL),
 ('QA_INSTALL_B','QA_ENDPOINT_B','zalo_bot','QA_BOT_B','QA_CRED_REF_B',1,
 '00000000-0000-0000-0000-000000000001','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
 'bbbbbbbb-0000-0000-0000-000000000002','qa_active',1,
 statement_timestamp()-interval '2 days',NULL);
INSERT INTO qa1986.owner_consents VALUES
 ('QA_INSTALL_A','00000000-0000-0000-0000-000000000001',
 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-0000-0000-0000-000000000001',
 'consented_readonly_qa',3,statement_timestamp()-interval '1 day',NULL),
 ('QA_INSTALL_B','00000000-0000-0000-0000-000000000001',
 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','bbbbbbbb-0000-0000-0000-000000000002',
 'consented_readonly_qa',1,statement_timestamp()-interval '1 day',NULL);

ALTER TABLE qa1986.bot_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa1986.owner_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY verifier_only_installations ON qa1986.bot_installations
 FOR SELECT TO qa1986_verifier USING(true);
CREATE POLICY verifier_only_owner_consents ON qa1986.owner_consents
 FOR SELECT TO qa1986_verifier USING(true);
GRANT SELECT ON qa1986.bot_installations,qa1986.owner_consents TO qa1986_verifier;
REVOKE ALL ON qa1986.bot_installations,qa1986.owner_consents FROM PUBLIC,qa_authenticated,qa_anon;

CREATE FUNCTION qa1986.check_binding(p_endpoint text,p_credential_ref text,p_epoch integer)
RETURNS TABLE(installation_ref text, tenant_id uuid, store_id uuid, bot_ref text)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path=pg_catalog
AS $$
SELECT i.installation_ref,i.tenant_id,i.store_id,i.bot_ref
FROM qa1986.bot_installations i
JOIN qa1986.owner_consents a ON a.installation_ref=i.installation_ref
JOIN qa1983.stores s ON s.tenant_id=i.tenant_id AND s.id=i.store_id
JOIN qa1983.store_memberships sm ON sm.tenant_id=i.tenant_id AND sm.store_id=i.store_id
 AND sm.user_id=i.owner_id
JOIN qa1983.tenant_memberships tm ON tm.tenant_id=i.tenant_id AND tm.user_id=i.owner_id
WHERE i.endpoint_ref=p_endpoint AND i.credential_binding_ref=p_credential_ref
 AND i.credential_epoch=p_epoch AND i.channel='zalo_bot'
 AND i.state='qa_active' AND i.revoked_at IS NULL
 AND i.verified_at<=statement_timestamp()
 AND s.active=true AND sm.active=true AND sm.role='owner'
 AND tm.active=true AND tm.role='owner'
 AND a.tenant_id=i.tenant_id AND a.store_id=i.store_id AND a.owner_id=i.owner_id
 AND a.consent='consented_readonly_qa' AND a.approved_version=i.version
 AND a.approved_at>=i.verified_at AND a.approved_at<=statement_timestamp()
 AND a.revoked_at IS NULL
$$;
REVOKE ALL ON FUNCTION qa1986.check_binding(text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qa1986.check_binding(text,text,integer) TO qa1986_verifier;
COMMIT;
