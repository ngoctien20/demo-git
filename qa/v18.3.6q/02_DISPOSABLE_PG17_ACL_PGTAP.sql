\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
\echo V18_3_6Q_ACL_PGTAP_START
SELECT * FROM no_plan();
SELECT ok(current_database()='tien404_v1836m_disposable','Q01 PG17 database only');
SELECT ok(current_setting('server_version_num')::integer BETWEEN 170000 AND 179999,'Q02 PG17 version');
SELECT ok(NOT (SELECT rolcanlogin FROM pg_roles WHERE rolname='tien404_m_owner'),'Q03 Q owner NOLOGIN');
SELECT ok(NOT (SELECT rolcanlogin FROM pg_roles WHERE rolname='tien404_q_rpc_caller'),'Q04 Q caller NOLOGIN');
SELECT ok(NOT (SELECT rolbypassrls FROM pg_roles WHERE rolname='tien404_q_rpc_caller'),'Q05 Q caller NOBYPASSRLS');
SELECT ok(NOT (SELECT rolcanlogin FROM pg_roles WHERE rolname='tien404_q_untrusted'),'Q06 Q untrusted NOLOGIN');
SELECT ok(NOT (SELECT rolbypassrls FROM pg_roles WHERE rolname='tien404_q_untrusted'),'Q07 Q untrusted NOBYPASSRLS');
SELECT ok(NOT has_schema_privilege('tien404_q_untrusted','qa_q_private','USAGE'),'Q08 no PUBLIC usage Q schema');
SELECT ok(has_schema_privilege('tien404_q_rpc_caller','qa_q_private','USAGE'),'Q09 Q caller private schema usage');
SELECT ok(NOT has_table_privilege('tien404_q_rpc_caller','qa_m_auth.sessions','SELECT'),'Q10 Q caller cannot directly SELECT Auth sessions');
SELECT ok(NOT has_table_privilege('tien404_q_rpc_caller','qa_m_auth.sessions','DELETE'),'Q11 Q caller cannot DELETE Auth sessions');
SELECT ok(NOT has_table_privilege('tien404_q_rpc_caller','qa_m_private.membership','SELECT'),'Q12 Q caller cannot directly SELECT Store membership');
SELECT ok(NOT has_table_privilege('tien404_q_rpc_caller','qa_m_private.catalog','SELECT'),'Q13 Q caller cannot directly SELECT catalog');
SELECT ok(NOT has_table_privilege('tien404_q_rpc_caller','qa_m_private.catalog','UPDATE'),'Q14 Q caller cannot write catalog');
SELECT ok(NOT has_table_privilege('tien404_q_rpc_caller','qa_m_private.nonce_ledger','SELECT'),'Q15 Q caller cannot directly SELECT nonce');
SELECT ok(NOT has_table_privilege('tien404_q_rpc_caller','qa_m_private.nonce_ledger','INSERT'),'Q16 Q caller cannot directly INSERT nonce');
SELECT ok(NOT has_table_privilege('tien404_q_rpc_caller','qa_q_private.fixture_signer','SELECT'),'Q17 Q caller cannot directly access HMAC fixture key');
SELECT ok(NOT has_table_privilege('tien404_q_rpc_caller','qa_q_private.fixture_signer','INSERT'),'Q18 Q caller cannot INSERT key');
SELECT ok(NOT has_table_privilege('tien404_q_rpc_caller','qa_q_private.fixture_signer','DELETE'),'Q19 Q caller cannot DELETE key');
SELECT ok(NOT has_table_privilege('tien404_q_untrusted','qa_q_private.fixture_signer','SELECT'),'Q20 Q untrusted cannot SELECT signer key');
SELECT ok(has_function_privilege('tien404_q_rpc_caller','qa_q_private.signed_catalog_read(uuid,uuid,uuid,uuid,integer,uuid,uuid,bigint,text)','EXECUTE'),'Q21 Q caller can EXECUTE only protected entrypoint');
SELECT ok(NOT has_function_privilege('tien404_q_untrusted','qa_q_private.signed_catalog_read(uuid,uuid,uuid,uuid,integer,uuid,uuid,bigint,text)','EXECUTE'),'Q22 Q untrusted cannot EXECUTE wrapper');
SELECT ok(NOT has_function_privilege('tien404_q_rpc_caller','qa_m_private.catalog_read_if_session_exists(text,text,uuid,uuid,uuid,uuid,uuid,integer,uuid,text,timestamptz)','EXECUTE'),'Q23 Q caller cannot directly EXECUTE previous M routine');
SELECT ok((SELECT EXISTS(SELECT 1 FROM unnest(proconfig) cfg WHERE replace(cfg,'"','')='search_path=') FROM pg_proc WHERE oid='qa_q_private.signed_catalog_read(uuid,uuid,uuid,uuid,integer,uuid,uuid,bigint,text)'::regprocedure),'Q24 Q wrapper fixed search_path set');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid='qa_q_private.signed_catalog_read(uuid,uuid,uuid,uuid,integer,uuid,uuid,bigint,text)'::regprocedure),'Q25 Q wrapper is SECURITY DEFINER');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='qa_q_private.fixture_signer'::regclass),'Q26 Q private fixture signer table RLS enabled');
SELECT ok((SELECT count(*) FROM qa_q_private.fixture_signer WHERE environment='DISPOSABLE_ONLY' AND encode(fixture_hmac_key,'hex')=repeat('51',32))=1,'Q27 Q synthetic key not production material');
SELECT ok(NOT pg_has_role('tien404_q_rpc_caller','tien404_m_owner','MEMBER'),'Q28 Q caller is not member of definer owner role');
SELECT ok(NOT pg_has_role('tien404_q_untrusted','tien404_m_owner','MEMBER'),'Q29 Q untrusted is not member of definer owner role');
SELECT ok((SELECT count(*) FROM qa_m_private.nonce_ledger WHERE jti='00000000-0000-4000-8000-000000009701')=0,'Q30 No prior nonce fixture consumed');
SELECT * FROM finish();
\echo V18_3_6Q_ACL_PGTAP_DONE
