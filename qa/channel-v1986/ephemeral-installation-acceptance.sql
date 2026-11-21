-- TIEN404 V19.8.6 - PostgreSQL 17 disposable integration QA ONLY.
-- Synthetic Bot refs are NOT provider authenticity or merchant ownership evidence.
\set ON_ERROR_STOP on
\echo == V19.8.6 exact installation/credential/owner Store scope ==
SET ROLE qa1986_verifier;
SELECT qa1983.assert_count('A exact endpoint binding',
 (SELECT count(*) FROM qa1986.check_binding('QA_ENDPOINT_A','QA_CRED_REF_A',2)),1);
SELECT qa1983.assert_count('B exact endpoint binding same tenant different Store',
 (SELECT count(*) FROM qa1986.check_binding('QA_ENDPOINT_B','QA_CRED_REF_B',1)),1);
SELECT qa1983.assert_count('A cannot read with B credential reference',
 (SELECT count(*) FROM qa1986.check_binding('QA_ENDPOINT_A','QA_CRED_REF_B',2)),0);
SELECT qa1983.assert_count('A old credential epoch fails',
 (SELECT count(*) FROM qa1986.check_binding('QA_ENDPOINT_A','QA_CRED_REF_A',1)),0);
SELECT qa1983.assert_count('unknown endpoint denied',
 (SELECT count(*) FROM qa1986.check_binding('QA_ENDPOINT_X','QA_CRED_REF_A',2)),0);
SELECT qa1983.assert_count('B wrong secret epoch denied',
 (SELECT count(*) FROM qa1986.check_binding('QA_ENDPOINT_B','QA_CRED_REF_B',2)),0);
SELECT qa1983.assert_count('A returns Store A only',
 (SELECT count(*) FROM qa1986.check_binding('QA_ENDPOINT_A','QA_CRED_REF_A',2)
  WHERE store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),1);
SELECT qa1983.assert_count('A cannot be bound to Store B',
 (SELECT count(*) FROM qa1986.check_binding('QA_ENDPOINT_A','QA_CRED_REF_A',2)
  WHERE store_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),0);
SELECT qa1983.assert_count('B returns Store B only',
 (SELECT count(*) FROM qa1986.check_binding('QA_ENDPOINT_B','QA_CRED_REF_B',1)
  WHERE store_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),1);
DO $$
BEGIN
 BEGIN
  UPDATE qa1986.bot_installations SET credential_epoch=100 WHERE installation_ref='QA_INSTALL_A';
  RAISE EXCEPTION 'FAIL internal verifier was able to write';
 EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS internal verifier registry read-only'; END;
END $$;
RESET ROLE;

\echo == Authenticated customer and anonymous cannot access internal registry ==
SET ROLE qa_authenticated;
DO $$
BEGIN
 BEGIN
  PERFORM * FROM qa1986.bot_installations LIMIT 1;
  RAISE EXCEPTION 'FAIL customer role exposed private registry';
 EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS customer registry denied'; END;
END $$;
DO $$
BEGIN
 BEGIN
  PERFORM * FROM qa1986.check_binding('QA_ENDPOINT_A','QA_CRED_REF_A',2);
  RAISE EXCEPTION 'FAIL customer role called internal verifier';
 EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS customer verifier denied'; END;
END $$;
RESET ROLE;
SET ROLE qa_anon;
DO $$
BEGIN
 BEGIN
  PERFORM * FROM qa1986.check_binding('QA_ENDPOINT_A','QA_CRED_REF_A',2);
  RAISE EXCEPTION 'FAIL anonymous role called internal verifier';
 EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS anonymous verifier denied'; END;
END $$;
RESET ROLE;

\echo == Simulate server-side revoke/restore: owner consent ==
UPDATE qa1986.owner_consents SET consent='revoked',
 revoked_at=statement_timestamp() WHERE installation_ref='QA_INSTALL_A';
SET ROLE qa1986_verifier;
SELECT qa1983.assert_count('revoked owner consent blocks A',
 (SELECT count(*) FROM qa1986.check_binding('QA_ENDPOINT_A','QA_CRED_REF_A',2)),0);
SELECT qa1983.assert_count('B unaffected by A consent revocation',
 (SELECT count(*) FROM qa1986.check_binding('QA_ENDPOINT_B','QA_CRED_REF_B',1)),1);
RESET ROLE;
UPDATE qa1986.owner_consents SET consent='consented_readonly_qa',
 revoked_at=NULL WHERE installation_ref='QA_INSTALL_A';

\echo == Simulate installation revoke/restore ==
UPDATE qa1986.bot_installations SET state='revoked',revoked_at=statement_timestamp()
 WHERE installation_ref='QA_INSTALL_A';
SET ROLE qa1986_verifier;
SELECT qa1983.assert_count('revoked installation blocks A',
 (SELECT count(*) FROM qa1986.check_binding('QA_ENDPOINT_A','QA_CRED_REF_A',2)),0);
RESET ROLE;
UPDATE qa1986.bot_installations SET state='qa_active',revoked_at=NULL
 WHERE installation_ref='QA_INSTALL_A';

\echo == Simulate Owner A Store membership revocation/restore ==
UPDATE qa1983.store_memberships SET active=false
 WHERE tenant_id='00000000-0000-0000-0000-000000000001'
 AND store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
 AND user_id='aaaaaaaa-0000-0000-0000-000000000001';
SET ROLE qa1986_verifier;
SELECT qa1983.assert_count('revoked Store membership blocks A',
 (SELECT count(*) FROM qa1986.check_binding('QA_ENDPOINT_A','QA_CRED_REF_A',2)),0);
RESET ROLE;
UPDATE qa1983.store_memberships SET active=true
 WHERE store_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
 AND user_id='aaaaaaaa-0000-0000-0000-000000000001';

\echo == Simulate Owner A Tenant membership revocation/restore ==
UPDATE qa1983.tenant_memberships SET active=false
 WHERE user_id='aaaaaaaa-0000-0000-0000-000000000001';
SET ROLE qa1986_verifier;
SELECT qa1983.assert_count('revoked Tenant membership blocks A',
 (SELECT count(*) FROM qa1986.check_binding('QA_ENDPOINT_A','QA_CRED_REF_A',2)),0);
RESET ROLE;
UPDATE qa1983.tenant_memberships SET active=true
 WHERE user_id='aaaaaaaa-0000-0000-0000-000000000001';

\echo == Versioned consent and credential cutover ==
UPDATE qa1986.bot_installations SET version=4 WHERE installation_ref='QA_INSTALL_A';
SET ROLE qa1986_verifier;
SELECT qa1983.assert_count('updated Bot config requires renewed owner consent',
 (SELECT count(*) FROM qa1986.check_binding('QA_ENDPOINT_A','QA_CRED_REF_A',2)),0);
RESET ROLE;
UPDATE qa1986.bot_installations SET version=3 WHERE installation_ref='QA_INSTALL_A';

UPDATE qa1986.bot_installations SET credential_epoch=3 WHERE installation_ref='QA_INSTALL_A';
SET ROLE qa1986_verifier;
SELECT qa1983.assert_count('stale credential epoch blocked after rotation',
 (SELECT count(*) FROM qa1986.check_binding('QA_ENDPOINT_A','QA_CRED_REF_A',2)),0);
RESET ROLE;
UPDATE qa1986.bot_installations SET credential_epoch=2 WHERE installation_ref='QA_INSTALL_A';

\echo == Cross Store/duplicate Bot installation structural constraints ==
DO $$
BEGIN
 BEGIN
  INSERT INTO qa1986.bot_installations VALUES
  ('QA_INSTALL_X','QA_ENDPOINT_A','zalo_bot','QA_BOT_X','QA_CRED_REF_X',1,
   '00000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'aaaaaaaa-0000-0000-0000-000000000001','qa_active',1,
   statement_timestamp(),NULL);
  RAISE EXCEPTION 'FAIL duplicate endpoint accepted';
 EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'PASS duplicate endpoint denied'; END;
END $$;
DO $$
BEGIN
 BEGIN
  INSERT INTO qa1986.bot_installations VALUES
  ('QA_INSTALL_Y','QA_ENDPOINT_Y','zalo_bot','QA_BOT_A','QA_CRED_REF_Y',1,
   '00000000-0000-0000-0000-000000000001','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'bbbbbbbb-0000-0000-0000-000000000002','qa_active',1,
   statement_timestamp(),NULL);
  RAISE EXCEPTION 'FAIL same Bot bound twice';
 EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'PASS duplicate Bot ref denied'; END;
END $$;
DO $$
BEGIN
 BEGIN
  INSERT INTO qa1986.bot_installations VALUES
  ('QA_INSTALL_Z','QA_ENDPOINT_Z','zalo_bot','QA_BOT_Z','QA_CRED_REF_Z',1,
   '00000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'bbbbbbbb-0000-0000-0000-000000000002','qa_active',1,
   statement_timestamp(),NULL);
  RAISE EXCEPTION 'FAIL Store B owner bound Bot to Store A';
 EXCEPTION WHEN foreign_key_violation THEN RAISE NOTICE 'PASS cross-Store owner FK denied'; END;
END $$;
DO $$
BEGIN
 BEGIN
  UPDATE qa1986.owner_consents SET store_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  WHERE installation_ref='QA_INSTALL_A';
  RAISE EXCEPTION 'FAIL consent Store reassignment succeeded';
 EXCEPTION WHEN foreign_key_violation THEN RAISE NOTICE 'PASS invalid Store reassignment denied'; END;
END $$;

SET ROLE qa1986_verifier;
SELECT qa1983.assert_count('A final restored',
 (SELECT count(*) FROM qa1986.check_binding('QA_ENDPOINT_A','QA_CRED_REF_A',2)),1);
SELECT qa1983.assert_count('B final restored',
 (SELECT count(*) FROM qa1986.check_binding('QA_ENDPOINT_B','QA_CRED_REF_B',1)),1);
RESET ROLE;
\echo TIEN404_V1986_POSTGRES_INSTALLATION_AUTHORITY_SQL_COMPLETE
