\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
\echo V18_3_6H_PGTAP_NONCE_START
SELECT * FROM no_plan();
SELECT ok(current_setting('server_version_num')::integer BETWEEN 170000 AND 179999,'P01 pg17 version verified');
SELECT ok(NOT (SELECT rolcanlogin FROM pg_roles WHERE rolname='tien404_h_nonce_owner'),'P02 nonce owner NOLOGIN');
SELECT ok(NOT (SELECT rolbypassrls FROM pg_roles WHERE rolname='tien404_h_nonce_caller'),'P03 nonce caller cannot bypass RLS');
SELECT ok((SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid='qa_h_private.nonce_ledger'::regclass)='tien404_h_nonce_owner','P04 ledger owned by private DB owner');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='qa_h_private.nonce_ledger'::regclass)=true,'P05 ledger RLS enabled');
SELECT ok(NOT has_function_privilege('tien404_h_nonce_untrusted','qa_h_private.consume_verified_nonce(text,text,uuid,text,text,text,timestamptz)','EXECUTE'),'P06 untrusted has no execute privilege');
SELECT ok(NOT has_table_privilege('tien404_h_nonce_caller','qa_h_private.nonce_ledger','SELECT'),'P07 caller has no SELECT table grant');
SELECT ok(NOT has_table_privilege('tien404_h_nonce_caller','qa_h_private.nonce_ledger','INSERT'),'P08 caller has no INSERT table grant');
SELECT ok(NOT has_table_privilege('tien404_h_nonce_caller','qa_h_private.nonce_ledger','UPDATE'),'P09 caller has no UPDATE table grant');
SELECT ok(has_function_privilege('tien404_h_nonce_caller','qa_h_private.consume_verified_nonce(text,text,uuid,text,text,text,timestamptz)','EXECUTE'),'P10 caller can execute only narrow function');
SET ROLE tien404_h_nonce_caller;
SELECT is(qa_h_private.consume_verified_nonce('tien404-private-authority-staging','tien404-private-commerce-readonly','00000000-0000-4000-8000-000000000011',repeat('a',64),repeat('b',64),repeat('c',64),clock_timestamp()+interval '45 seconds'),'ACCEPTED','N01 first nonce accepted');
SELECT is(qa_h_private.consume_verified_nonce('tien404-private-authority-staging','tien404-private-commerce-readonly','00000000-0000-4000-8000-000000000011',repeat('a',64),repeat('b',64),repeat('c',64),clock_timestamp()+interval '45 seconds'),'REPLAY','N02 exact replay denied');
SELECT is(qa_h_private.consume_verified_nonce('tien404-private-authority-staging','tien404-private-commerce-readonly','00000000-0000-4000-8000-000000000011',repeat('a',64),repeat('d',64),repeat('c',64),clock_timestamp()+interval '45 seconds'),'REPLAY','N03 scope-swapped same JTI rejected');
SELECT is(qa_h_private.consume_verified_nonce('tien404-private-authority-staging','tien404-private-commerce-readonly','00000000-0000-4000-8000-000000000011',repeat('a',64),repeat('b',64),repeat('e',64),clock_timestamp()+interval '45 seconds'),'REPLAY','N04 token-hash-swapped same JTI rejected');
SELECT is(qa_h_private.consume_verified_nonce('tien404-private-authority-staging','tien404-private-commerce-readonly','00000000-0000-4000-8000-000000000012',repeat('a',64),repeat('b',64),repeat('c',64),clock_timestamp()+interval '45 seconds'),'ACCEPTED','N05 different nonce accepted');
SELECT is(qa_h_private.consume_verified_nonce('untrusted-issuer','tien404-private-commerce-readonly','00000000-0000-4000-8000-000000000013',repeat('a',64),repeat('b',64),repeat('c',64),clock_timestamp()+interval '45 seconds'),'DENY_ISSUER_AUDIENCE','N06 wrong issuer rejected');
SELECT is(qa_h_private.consume_verified_nonce('tien404-private-authority-staging','untrusted-audience','00000000-0000-4000-8000-000000000014',repeat('a',64),repeat('b',64),repeat('c',64),clock_timestamp()+interval '45 seconds'),'DENY_ISSUER_AUDIENCE','N07 wrong audience rejected');
SELECT is(qa_h_private.consume_verified_nonce('tien404-private-authority-staging','tien404-private-commerce-readonly','00000000-0000-4000-8000-000000000015',repeat('a',64),repeat('b',64),repeat('c',64),clock_timestamp()-interval '1 second'),'DENY_EXPIRY','N08 already expired denied');
SELECT is(qa_h_private.consume_verified_nonce('tien404-private-authority-staging','tien404-private-commerce-readonly','00000000-0000-4000-8000-000000000016',repeat('a',64),repeat('b',64),repeat('c',64),clock_timestamp()+interval '121 seconds'),'DENY_EXPIRY','N09 excessive TTL denied');
SELECT is(qa_h_private.consume_verified_nonce('tien404-private-authority-staging','tien404-private-commerce-readonly','00000000-0000-4000-8000-000000000017',repeat('a',64),repeat('b',64),repeat('c',64),NULL),'DENY_EXPIRY','N10 missing expiry denied');
SELECT is(qa_h_private.consume_verified_nonce('tien404-private-authority-staging','tien404-private-commerce-readonly','00000000-0000-4000-8000-000000000018','bad-hash',repeat('b',64),repeat('c',64),clock_timestamp()+interval '45 seconds'),'DENY_INPUT','N11 invalid tenant hash denied');
SELECT is(qa_h_private.consume_verified_nonce('tien404-private-authority-staging','tien404-private-commerce-readonly','00000000-0000-4000-8000-000000000019',repeat('a',64),'bad-hash',repeat('c',64),clock_timestamp()+interval '45 seconds'),'DENY_INPUT','N12 invalid Store hash denied');
SELECT is(qa_h_private.consume_verified_nonce('tien404-private-authority-staging','tien404-private-commerce-readonly','00000000-0000-4000-8000-000000000020',repeat('a',64),repeat('b',64),'notsha256',clock_timestamp()+interval '45 seconds'),'DENY_INPUT','N13 invalid token digest denied');
SELECT is(qa_h_private.consume_verified_nonce('tien404-private-authority-staging','tien404-private-commerce-readonly',NULL,repeat('a',64),repeat('b',64),repeat('c',64),clock_timestamp()+interval '45 seconds'),'DENY_INPUT','N14 NULL nonce denied');
SELECT is(qa_h_private.consume_verified_nonce('tien404-private-authority-staging','tien404-private-commerce-readonly','00000000-0000-0000-0000-000000000000',repeat('a',64),repeat('b',64),repeat('c',64),clock_timestamp()+interval '45 seconds'),'DENY_INPUT','N15 nil UUID denied');
SELECT is(qa_h_private.consume_verified_nonce(NULL,'tien404-private-commerce-readonly','00000000-0000-4000-8000-000000000023',repeat('a',64),repeat('b',64),repeat('c',64),clock_timestamp()+interval '45 seconds'),'DENY_ISSUER_AUDIENCE','N16 missing issuer denied');
SELECT is(qa_h_private.consume_verified_nonce('tien404-private-authority-staging',NULL,'00000000-0000-4000-8000-000000000024',repeat('a',64),repeat('b',64),repeat('c',64),clock_timestamp()+interval '45 seconds'),'DENY_ISSUER_AUDIENCE','N17 missing audience denied');
SELECT is(qa_h_private.consume_verified_nonce('tien404-private-authority-staging','tien404-private-commerce-readonly','00000000-0000-4000-8000-000000000025',repeat('a',64),repeat('d',64),repeat('c',64),clock_timestamp()+interval '45 seconds'),'ACCEPTED','N18 distinct Store JTI admitted');
SELECT is(qa_h_private.consume_verified_nonce('tien404-private-authority-staging','tien404-private-commerce-readonly','00000000-0000-4000-8000-000000000025',repeat('a',64),repeat('b',64),repeat('c',64),clock_timestamp()+interval '45 seconds'),'REPLAY','N19 distinct Store cannot replay same nonce');
RESET ROLE;
SELECT ok((SELECT count(*) FROM qa_h_private.nonce_ledger)=3,'Z01 exactly three nonce rows persisted');
SELECT ok((SELECT count(*) FROM qa_h_private.nonce_ledger WHERE jti='00000000-0000-4000-8000-000000000011')=1,'Z02 one row for first nonce');
SELECT ok((SELECT count(*) FROM qa_h_private.nonce_ledger WHERE length(authority_sha256)=64 AND length(tenant_hash)=64 AND length(store_hash)=64)=3,'Z03 ledger data includes only digests, not session token');
SELECT ok((SELECT count(*) FROM pg_constraint WHERE conrelid='qa_h_private.nonce_ledger'::regclass AND contype='p')=1,'Z04 unique primary key on issuer+jti');
SELECT ok(NOT has_schema_privilege('tien404_h_nonce_untrusted','qa_h_private','USAGE'),'Z05 no default public schema access to ledger');
SELECT * FROM finish();
\echo V18_3_6H_PGTAP_NONCE_FINISHED
