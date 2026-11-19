\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
\echo V18_3_6P_PG17_TX_ATTESTATION_START
SELECT * FROM no_plan();
SELECT ok(current_setting('server_version_num')::integer BETWEEN 170000 AND 179999,'P01 exactly PG17 disposable context');
SELECT ok(current_database()='tien404_v1836m_disposable','P02 correct disposable database');
SELECT ok(NOT has_table_privilege('tien404_m_gateway','qa_m_auth.sessions','SELECT'),'P03 gateway cannot directly query Auth rows');
SELECT ok(NOT has_table_privilege('tien404_m_gateway','qa_m_private.membership','SELECT'),'P04 gateway cannot query membership rows directly');
SELECT ok(NOT has_table_privilege('tien404_m_gateway','qa_m_private.nonce_ledger','INSERT'),'P05 gateway cannot directly mint JTI');
SELECT ok(NOT (SELECT rolbypassrls FROM pg_roles WHERE rolname='tien404_m_gateway'),'P06 gateway NOBYPASSRLS');
SELECT ok(NOT (SELECT rolcanlogin FROM pg_roles WHERE rolname='tien404_m_gateway'),'P07 gateway NOLOGIN');
SELECT ok((SELECT count(*) FROM qa_m_auth.sessions WHERE id='00000000-0000-4000-8000-000000000111')=0,'P08 prior deleted session A remains absent');
SELECT ok((SELECT count(*) FROM qa_m_auth.sessions WHERE id='00000000-0000-4000-8000-000000000112')=1,'P09 unrelated synthetic session B still exists');
SELECT ok((SELECT count(*) FROM qa_m_private.membership WHERE user_id='00000000-0000-4000-8000-000000000211' AND revision=2)=1,'P10 member A current revision is 2');
SET ROLE tien404_m_gateway;
SELECT is((SELECT decision FROM qa_m_private.catalog_read_if_session_exists('tien404-synthetic-authority','tien404-synthetic-catalog-read','00000000-0000-4000-8000-000000009901','00000000-0000-4000-8000-000000000112','00000000-0000-4000-8000-000000000212','00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000402',1,'00000000-0000-4000-8000-000000000502','CATALOG_READ',clock_timestamp()+interval '75 seconds')),'ALLOW_CATALOG','P11 signed scope B read result in disposable fixture');
SELECT is((SELECT price_vnd::text FROM qa_m_private.catalog_read_if_session_exists('tien404-synthetic-authority','tien404-synthetic-catalog-read','00000000-0000-4000-8000-000000009902','00000000-0000-4000-8000-000000000112','00000000-0000-4000-8000-000000000212','00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000402',1,'00000000-0000-4000-8000-000000000502','CATALOG_READ',clock_timestamp()+interval '75 seconds')),'189000','P12 exact scoped synthetic B price');
SELECT is((SELECT decision FROM qa_m_private.catalog_read_if_session_exists('tien404-synthetic-authority','tien404-synthetic-catalog-read','00000000-0000-4000-8000-000000009903','00000000-0000-4000-8000-000000000112','00000000-0000-4000-8000-000000000212','00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000402',1,'00000000-0000-4000-8000-000000000501','CATALOG_READ',clock_timestamp()+interval '75 seconds')),'DENY_RESOURCE_SCOPE','P13 same Tenant Store B cross-resource denied');
SELECT is((SELECT decision FROM qa_m_private.catalog_read_if_session_exists('tien404-synthetic-authority','tien404-synthetic-catalog-read','00000000-0000-4000-8000-000000009904','00000000-0000-4000-8000-000000000111','00000000-0000-4000-8000-000000000211','00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000401',2,'00000000-0000-4000-8000-000000000501','CATALOG_READ',clock_timestamp()+interval '75 seconds')),'DENY_SESSION','P14 deleted session cannot be resurrected');
SELECT is((SELECT decision FROM qa_m_private.catalog_read_if_session_exists('tien404-synthetic-authority','tien404-synthetic-catalog-read','00000000-0000-4000-8000-000000009901','00000000-0000-4000-8000-000000000112','00000000-0000-4000-8000-000000000212','00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000402',1,'00000000-0000-4000-8000-000000000502','CATALOG_READ',clock_timestamp()+interval '75 seconds')),'REPLAY','P15 first JTI cannot be reused');
RESET ROLE;
SELECT ok((SELECT count(*) FROM qa_m_private.nonce_ledger WHERE jti='00000000-0000-4000-8000-000000009901')=1,'P16 nonce durable fixture uniqueness');
SELECT ok((SELECT count(*) FROM qa_m_private.nonce_ledger WHERE jti IN ('00000000-0000-4000-8000-000000009903','00000000-0000-4000-8000-000000009904'))=0,'P17 denied reads did not consume nonce');
SELECT * FROM finish();
\echo V18_3_6P_PG17_TX_ATTESTATION_DONE
