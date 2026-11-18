\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
\echo V18_3_6E_PGTAP_EXECUTION_START
DO $guard$ BEGIN
 IF current_database()<>'tien404_v1836e_disposable' THEN RAISE EXCEPTION 'NOT_DISPOSABLE'; END IF;
 IF current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999 THEN RAISE EXCEPTION 'NOT_PG17'; END IF;
END $guard$;

-- DML testing helpers execute as the synthetic actor and suppress only known fixture errors.
CREATE FUNCTION qa_private.try_write(p_sql text) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $f$
BEGIN
 EXECUTE p_sql;
 RETURN 'OK';
EXCEPTION WHEN OTHERS THEN
 RETURN SQLSTATE;
END $f$;
CREATE FUNCTION qa_private.try_write_count(p_sql text) RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $f$
DECLARE n integer;
BEGIN
 EXECUTE p_sql;
 GET DIAGNOSTICS n = ROW_COUNT;
 RETURN n;
EXCEPTION WHEN OTHERS THEN
 RETURN -1;
END $f$;
REVOKE ALL ON FUNCTION qa_private.try_write(text),qa_private.try_write_count(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qa_private.try_write(text),qa_private.try_write_count(text) TO tien404_e_actor;

SELECT * FROM no_plan();
SELECT ok(current_setting('server_version_num')::int BETWEEN 170000 AND 179999,'G01 PostgreSQL 17');
SELECT is((SELECT count(*)::integer FROM pg_policies WHERE schemaname='public' AND permissive='RESTRICTIVE' AND tablename IN ('products','customers','orders','order_items','conversations','messages')),6,'G02 six restrictive boundary policies');
SELECT ok((SELECT count(*) FROM public.products WHERE store_id IS NULL)=1,'G03 legacy product fixture preserved');
SELECT ok((SELECT count(*) FROM public.orders WHERE store_id IS NULL)=1,'G04 legacy order fixture preserved');
SELECT ok((SELECT count(*) FROM public.products WHERE sku='COMMON')=3,'G05 same SKU across three independent Stores');
SELECT ok(NOT has_table_privilege('tien404_e_actor','public.store_memberships','SELECT'),'G06 authority tables not exposed to actor');
SELECT ok((SELECT count(*) FROM pg_trigger WHERE tgname LIKE '%immutable_store_scope')=6,'G07 all six immutable Store triggers exist');
SELECT is(qa_private.try_write($q$INSERT INTO public.products VALUES('00000000-0000-0000-0000-000000002095','00000000-0000-0000-0000-000000000001',NULL,'INVALID-NULL-PRIVILEGED',1,1)$q$),'23514','G08 NOT VALID CHECK rejects privileged new NULL Store row');

SET ROLE tien404_e_actor;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000001001';
SELECT is((SELECT count(*)::integer FROM public.products),1,'A01 Owner A sees product A only');
SELECT is((SELECT count(*)::integer FROM public.orders),1,'A02 Owner A sees order A only');
SELECT is((SELECT count(*)::integer FROM public.customers),1,'A03 Owner A sees customer A only');
SELECT is((SELECT count(*)::integer FROM public.order_items),1,'A04 Owner A sees order item A only');
SELECT is((SELECT count(*)::integer FROM public.conversations),1,'A05 Owner A sees conversation A only');
SELECT is((SELECT count(*)::integer FROM public.messages),1,'A06 Owner A sees message A only');
SELECT is((SELECT count(*)::integer FROM public.products WHERE sku='QA-LEGACY'),0,'A07 Owner A cannot read unmapped legacy product');
SELECT is((SELECT count(*)::integer FROM public.orders WHERE id='00000000-0000-0000-0000-000000004003'),0,'A08 Owner A cannot read unmapped legacy order');
SELECT is(qa_private.try_write_count($q$UPDATE public.products SET price_vnd=777 WHERE id='00000000-0000-0000-0000-000000002002'$q$),0,'A09 Owner A cannot update B product even with legacy wide read policy');
SELECT is(qa_private.try_write($q$INSERT INTO public.products VALUES('00000000-0000-0000-0000-000000002091','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000102','SPOOF-B',1,1)$q$),'42501','A10 Owner A cannot insert in Store B');
SELECT is(qa_private.try_write($q$INSERT INTO public.orders VALUES('00000000-0000-0000-0000-000000004091','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000003002','pending',10)$q$),'23503','A11 order A cannot reference customer B');
SELECT is(qa_private.try_write($q$INSERT INTO public.order_items VALUES('00000000-0000-0000-0000-000000005091','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000004001','00000000-0000-0000-0000-000000002002',1,250)$q$),'23503','A12 order item A cannot reference product B');
SELECT is(qa_private.try_write($q$INSERT INTO public.messages VALUES('00000000-0000-0000-0000-000000007091','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000006002','staff','cross-store')$q$),'23503','A13 message A cannot reference conversation B');
SELECT is(qa_private.try_write($q$INSERT INTO public.products VALUES('00000000-0000-0000-0000-000000002092','00000000-0000-0000-0000-000000000001',NULL,'INVALID-NULL',1,1)$q$),'42501','A14 actor NULL Store row rejected by restrictive RLS before CHECK');
SELECT is(qa_private.try_write($q$INSERT INTO public.products VALUES('00000000-0000-0000-0000-000000002093','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','COMMON',1,1)$q$),'23505','A15 duplicate SKU in same Store rejected');
SELECT is(qa_private.try_write_count($q$INSERT INTO public.products VALUES('00000000-0000-0000-0000-000000002094','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','A-NEW',110,2)$q$),1,'A16 Owner A can insert scoped product');
SELECT is(qa_private.try_write_count($q$UPDATE public.products SET price_vnd=111 WHERE id='00000000-0000-0000-0000-000000002094'$q$),1,'A17 Owner A can update scoped product');
SELECT is(qa_private.try_write_count($q$DELETE FROM public.products WHERE id='00000000-0000-0000-0000-000000002094'$q$),0,'A18 Owner A cannot physically delete product');
SELECT is(qa_private.try_write_count($q$DELETE FROM public.orders WHERE id='00000000-0000-0000-0000-000000004001'$q$),0,'A19 Owner A cannot physically delete order');

SET request.jwt.claim.sub='00000000-0000-0000-0000-000000001002';
SELECT is((SELECT count(*)::integer FROM public.products),1,'B01 Owner B sees only Store B');
SELECT is((SELECT count(*)::integer FROM public.orders),1,'B02 Owner B sees only order B');
SELECT is((SELECT count(*)::integer FROM public.messages),1,'B03 Owner B sees only message B');
SELECT is(qa_private.try_write_count($q$UPDATE public.orders SET total_vnd=9999 WHERE id='00000000-0000-0000-0000-000000004001'$q$),0,'B04 Owner B cannot change order A');

SET request.jwt.claim.sub='00000000-0000-0000-0000-000000001003';
SELECT is((SELECT count(*)::integer FROM public.products),2,'M01 Manager A sees only products A including new A product');
SELECT is(qa_private.try_write_count($q$UPDATE public.products SET price_vnd=112 WHERE id='00000000-0000-0000-0000-000000002094'$q$),1,'M02 Manager A can change Store A product');
SELECT is(qa_private.try_write_count($q$UPDATE public.orders SET status='confirmed' WHERE id='00000000-0000-0000-0000-000000004001'$q$),1,'M03 Manager A can change Store A order');
SELECT is(qa_private.try_write_count($q$UPDATE public.orders SET status='confirmed' WHERE id='00000000-0000-0000-0000-000000004002'$q$),0,'M04 Manager A cannot change B order');

SET request.jwt.claim.sub='00000000-0000-0000-0000-000000001004';
SELECT is((SELECT count(*)::integer FROM public.products),2,'S01 Staff A sees Store A catalog');
SELECT is((SELECT count(*)::integer FROM public.orders),1,'S02 Staff A sees Store A order');
SELECT is((SELECT count(*)::integer FROM public.customers),0,'S03 Staff A cannot enumerate customers');
SELECT is(qa_private.try_write_count($q$UPDATE public.products SET price_vnd=998 WHERE id='00000000-0000-0000-0000-000000002001'$q$),0,'S04 Staff A cannot edit product price');
SELECT is(qa_private.try_write_count($q$UPDATE public.orders SET total_vnd=998 WHERE id='00000000-0000-0000-0000-000000004001'$q$),0,'S05 Staff A cannot rewrite order total');
SELECT is(qa_private.try_write_count($q$INSERT INTO public.orders VALUES('00000000-0000-0000-0000-000000004094','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101',NULL,'pending',100)$q$),1,'S06 Staff A can create scoped order in synthetic table policy');
SELECT is(qa_private.try_write_count($q$INSERT INTO public.order_items VALUES('00000000-0000-0000-0000-000000005094','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000004094','00000000-0000-0000-0000-000000002001',1,100)$q$),1,'S07 Staff A can append scoped order item');
SELECT is(qa_private.try_write_count($q$DELETE FROM public.order_items WHERE id='00000000-0000-0000-0000-000000005094'$q$),0,'S08 Staff A cannot physically delete order item');

SET request.jwt.claim.sub='00000000-0000-0000-0000-000000001005';
SELECT is((SELECT count(*)::integer FROM public.products),0,'T01 Tenant Owner without Store membership denied products');
SELECT is((SELECT count(*)::integer FROM public.orders),0,'T02 Tenant Owner without Store membership denied orders');

SET request.jwt.claim.sub='00000000-0000-0000-0000-000000001006';
SELECT is((SELECT count(*)::integer FROM public.products),3,'D01 explicitly dual-scoped owner can see A+B products');
SELECT is((SELECT count(*)::integer FROM public.orders),3,'D02 explicitly dual-scoped owner can see A+B and new A orders');
SELECT is(qa_private.try_write($q$UPDATE public.products SET store_id='00000000-0000-0000-0000-000000000102' WHERE id='00000000-0000-0000-0000-000000002001'$q$),'23514','D03 dual-scoped owner cannot move product A to B');
SELECT is(qa_private.try_write($q$UPDATE public.orders SET store_id='00000000-0000-0000-0000-000000000102',customer_id='00000000-0000-0000-0000-000000003002' WHERE id='00000000-0000-0000-0000-000000004001'$q$),'23514','D04 dual-scoped owner cannot move order A to B');
SELECT is((SELECT count(*)::integer FROM public.products WHERE store_id IS NULL),0,'D05 dual-scoped owner cannot read legacy product');

SET request.jwt.claim.sub='00000000-0000-0000-0000-000000001007';
SELECT is((SELECT count(*)::integer FROM public.products),0,'R01 revoked membership blocked');
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000001008';
SELECT is((SELECT count(*)::integer FROM public.products),0,'R02 expired membership blocked');
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000001009';
SELECT is((SELECT count(*)::integer FROM public.products),0,'R03 non-member blocked');
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000001010';
SELECT is((SELECT count(*)::integer FROM public.products),1,'C01 cross-tenant owner sees own Tenant C only');
SELECT is((SELECT count(*)::integer FROM public.orders),0,'C02 cross-tenant owner sees zero Tenant A orders');
RESET request.jwt.claim.sub;
SELECT is((SELECT count(*)::integer FROM public.products),0,'N01 no Auth identity blocked');

RESET ROLE;
UPDATE public.stores SET status='suspended' WHERE id='00000000-0000-0000-0000-000000000101';
SET ROLE tien404_e_actor;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000001001';
SELECT is((SELECT count(*)::integer FROM public.products),0,'X01 suspended Store denies Owner A');
SELECT is((SELECT count(*)::integer FROM public.orders),0,'X02 suspended Store denies existing orders');
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000001002';
SELECT is((SELECT count(*)::integer FROM public.products),1,'X03 suspension Store A does not affect Store B');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.orders WHERE id='00000000-0000-0000-0000-000000004001' AND total_vnd=100),1,'Z01 unauthorized order total attempts did not mutate data');
SELECT is((SELECT count(*)::integer FROM public.products WHERE id='00000000-0000-0000-0000-000000002001' AND store_id='00000000-0000-0000-0000-000000000101' AND price_vnd=100),1,'Z02 immutable Store and Staff price controls preserved data');
SELECT * FROM finish();
\echo V18_3_6E_PGTAP_TEST_SCRIPT_FINISHED
