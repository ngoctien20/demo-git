\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
\echo V18_3_6F_PGTAP_STARTED
DO $guard$ BEGIN
 IF current_database()<>'tien404_v1836e_disposable' OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 THEN RAISE EXCEPTION 'NOT_DISPOSABLE_PG17'; END IF;
END $guard$;
-- Error introspection helper for test assertions only: no data/network side effects.
CREATE FUNCTION qa_private.try_write(p_sql text) RETURNS text
 LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
BEGIN
 EXECUTE p_sql;
 RETURN 'OK';
EXCEPTION WHEN OTHERS THEN
 RETURN SQLSTATE;
END $fn$;
CREATE FUNCTION qa_private.try_activate(p_tenant uuid,p_store uuid) RETURNS text
 LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
BEGIN
 RETURN qa_private.admin_activate_store(p_tenant,p_store);
EXCEPTION WHEN OTHERS THEN
 RETURN SQLSTATE;
END $fn$;
REVOKE ALL ON FUNCTION qa_private.try_write(text),qa_private.try_activate(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qa_private.try_write(text),qa_private.try_activate(uuid,uuid) TO tien404_e_actor;
GRANT EXECUTE ON FUNCTION qa_private.try_write(text) TO tien404_f_gateway;

SELECT * FROM no_plan();
SELECT ok(current_setting('server_version_num')::integer BETWEEN 170000 AND 179999,'G01 running PostgreSQL 17');
SELECT ok((SELECT rolbypassrls FROM pg_roles WHERE rolname='tien404_f_executor'),'G02 privileged internal executor explicitly BYPASSRLS');
SELECT ok(NOT (SELECT rolbypassrls FROM pg_roles WHERE rolname='tien404_f_gateway'),'G03 exposed gateway caller cannot BYPASSRLS');
SELECT ok(NOT has_table_privilege('tien404_f_gateway','public.orders','SELECT'),'G04 gateway has no direct Order SELECT privilege');
SELECT ok(NOT has_table_privilege('tien404_f_gateway','public.orders','UPDATE'),'G05 gateway has no direct Order UPDATE privilege');
SELECT ok(NOT has_table_privilege('tien404_e_actor','public.store_memberships','UPDATE'),'G06 normal actor cannot directly update Store memberships');
SELECT ok((SELECT count(*) FROM pg_trigger WHERE tgname='f_guard_last_owner')=1,'G07 owner-removal invariant database trigger installed');
SELECT ok((SELECT count(*) FROM pg_trigger WHERE tgname='f_store_activation')=1,'G08 Store activation invariant database trigger installed');
SELECT ok((SELECT count(*) FROM qa_private.receipts WHERE used_at IS NOT NULL)=1,'G09 synthetic receipt replay fixture seeded');

SET ROLE tien404_e_actor;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000001001';
SELECT is(qa_private.admin_invite('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000001009','staff'),'INVITED','A01 Store Owner A can invite staff in A');
SELECT is(qa_private.admin_invite('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000001009','manager'),'DENY_MEMBERSHIP_EXISTS','A02 no privilege overwrite of pending invite');
SELECT is(qa_private.admin_invite('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000001009','store_owner'),'DENY_OWNER_GRANT','A03 Store Owner cannot promote Store Owner');
SELECT is(qa_private.admin_invite('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000001009','staff'),'DENY_ACTOR_SCOPE','A04 Store Owner A cannot invite staff in B');
SELECT is(qa_private.admin_invite('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000001010','staff'),'DENY_TARGET_TENANT','A05 cross Tenant invitation rejected');
SELECT is(qa_private.admin_invite('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000001004','staff'),'DENY_MEMBERSHIP_EXISTS','A06 cannot silently overwrite active member');
SELECT is(qa_private.admin_revoke('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000001004'),'REVOKED','A07 Store Owner can revoke Staff A');
SELECT is(qa_private.admin_invite('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000001004','staff'),'INVITED','A08 reinvite after revoke requires fresh approval');
SELECT is(qa_private.try_write($q$UPDATE public.store_memberships SET role='store_owner' WHERE user_id='00000000-0000-0000-0000-000000001009'$q$),'42501','A09 direct membership UPDATE denied to actor');
SELECT is(qa_private.try_write($q$SELECT count(*) FROM public.store_memberships$q$),'42501','A10 direct membership SELECT denied to actor');
SELECT is(qa_private.try_write($q$SELECT count(*) FROM qa_private.membership_audit$q$),'42501','A11 private membership audit not exposed');
SELECT is(qa_private.admin_create_store('00000000-0000-0000-0000-000000000001','qa-member-f'),'DENY_TENANT_OWNER','A12 Store Owner cannot create new Store');

SET request.jwt.claim.sub='00000000-0000-0000-0000-000000001003';
SELECT is(qa_private.admin_invite('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000001009','staff'),'DENY_ACTOR_SCOPE','M01 Manager cannot grant membership');
SELECT is(qa_private.admin_revoke('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000001009'),'DENY_TARGET','M02 Manager cannot bypass pending membership state');

SET request.jwt.claim.sub='00000000-0000-0000-0000-000000001009';
SELECT is(qa_private.admin_accept('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101'),'ACCEPTED','I01 invitee accepts own Store A membership');
SELECT is(qa_private.admin_accept('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101'),'DENY_NO_FRESH_INVITE','I02 invite cannot be accepted twice');
SELECT is(qa_private.store_role('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101'),'staff','I03 accepted actor has scoped staff role');
SELECT is((SELECT count(*)::integer FROM public.products),1,'I04 new staff sees A products only');

SET request.jwt.claim.sub='00000000-0000-0000-0000-000000001004';
SELECT is(qa_private.admin_accept('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101'),'ACCEPTED','I05 revoked Staff requires new invitation and acceptance');
SELECT is(qa_private.store_role('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101'),'staff','I06 re-invited Staff gets exact role');

SET request.jwt.claim.sub='00000000-0000-0000-0000-000000001005';
SELECT is(qa_private.admin_create_store('00000000-0000-0000-0000-000000000001','qa-member-f'),'CREATED_PROVISIONING','T01 Tenant Owner creates provisioning Store');
SELECT is(qa_private.admin_create_store('00000000-0000-0000-0000-000000000002','foreign-tenant-f'),'DENY_TENANT_OWNER','T02 Tenant Owner cannot create Store in T2');
SELECT is(qa_private.admin_create_store('00000000-0000-0000-0000-000000000001','Bad Slug'),'DENY_IDENTITY_OR_SLUG','T03 invalid Store slug rejected');

RESET ROLE;
SELECT id AS f_new_store FROM public.stores WHERE slug='qa-member-f' AND tenant_id='00000000-0000-0000-0000-000000000001' \gset
SELECT is((SELECT status FROM public.stores WHERE id=:'f_new_store'),'provisioning','T04 new Store starts non-active');
SET ROLE tien404_e_actor;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000001005';
SELECT is(qa_private.try_activate('00000000-0000-0000-0000-000000000001',:'f_new_store'),'23514','T05 Store activation without active owner rejected');
SELECT is(qa_private.admin_invite('00000000-0000-0000-0000-000000000001',:'f_new_store','00000000-0000-0000-0000-000000001001','store_owner'),'INVITED','T06 Tenant Owner may appoint owner to provisioning Store');
SELECT is(qa_private.try_activate('00000000-0000-0000-0000-000000000001',:'f_new_store'),'23514','T07 invitation alone is not owner activation');

SET request.jwt.claim.sub='00000000-0000-0000-0000-000000001001';
SELECT is(qa_private.admin_accept('00000000-0000-0000-0000-000000000001',:'f_new_store'),'ACCEPTED','T08 nominated owner accepts membership before Store activation');
SELECT is(qa_private.admin_activate_store('00000000-0000-0000-0000-000000000001',:'f_new_store'),'DENY_TENANT_OWNER','T09 Store Owner cannot activate provisioning Store');

SET request.jwt.claim.sub='00000000-0000-0000-0000-000000001005';
SELECT is(qa_private.admin_activate_store('00000000-0000-0000-0000-000000000001',:'f_new_store'),'ACTIVATED','T10 Tenant Owner activates Store with accepted owner');
SELECT is(qa_private.admin_activate_store('00000000-0000-0000-0000-000000000001',:'f_new_store'),'DENY_LIFECYCLE','T11 repeat Store activation rejected');
SELECT is(qa_private.admin_revoke('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000001002'),'REVOKED','T12 Tenant Owner may revoke one of two Store B owners');
SELECT is(qa_private.try_write($q$SELECT qa_private.admin_revoke('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000001006')$q$),'23514','T13 cannot remove last Store B owner');
SELECT is(qa_private.admin_invite('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000001002','store_owner'),'INVITED','T14 revoked owner requires explicit reinvitation');

SET request.jwt.claim.sub='00000000-0000-0000-0000-000000001002';
SELECT is(qa_private.admin_accept('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000102'),'ACCEPTED','T15 replacement Store B owner accepts');
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000001005';
SELECT is(qa_private.admin_revoke('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000001006'),'REVOKED','T16 owner transfer with replacement can revoke previous owner');

SET request.jwt.claim.sub='00000000-0000-0000-0000-000000001011';
SELECT is(qa_private.try_write($q$SELECT qa_private.admin_revoke('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000001010')$q$),'23514','L01 Tenant Owner cannot revoke final Store C owner');
SELECT is(qa_private.admin_invite('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000001011','store_owner'),'INVITED','L02 Tenant Owner may propose second Store C owner');
SELECT is(qa_private.admin_accept('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000201'),'ACCEPTED','L03 Tenant Owner accepts own explicit Store C owner membership');
SELECT is(qa_private.admin_revoke('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000001010'),'REVOKED','L04 Store C owner transfer possible after second owner active');
SELECT is(qa_private.try_write($q$SELECT qa_private.admin_revoke('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000001011')$q$),'23514','L05 new final owner cannot be revoked');

RESET ROLE;
SELECT is(qa_private.try_write($q$DELETE FROM public.store_memberships WHERE tenant_id='00000000-0000-0000-0000-000000000002' AND store_id='00000000-0000-0000-0000-000000000201' AND user_id='00000000-0000-0000-0000-000000001011'$q$),'23514','L06 privileged direct DELETE blocked by last-owner trigger');
SELECT is(qa_private.try_write($q$UPDATE public.store_memberships SET status='suspended' WHERE tenant_id='00000000-0000-0000-0000-000000000002' AND store_id='00000000-0000-0000-0000-000000000201' AND user_id='00000000-0000-0000-0000-000000001011'$q$),'23514','L07 privileged direct suspension of last Owner blocked');
SELECT is(qa_private.try_write($q$UPDATE public.store_memberships SET store_id='00000000-0000-0000-0000-000000000102' WHERE tenant_id='00000000-0000-0000-0000-000000000001' AND store_id='00000000-0000-0000-0000-000000000101' AND user_id='00000000-0000-0000-0000-000000001001'$q$),'23514','L08 privileged membership scope reassignment blocked');
SELECT is((SELECT count(*)::integer FROM public.store_memberships WHERE tenant_id='00000000-0000-0000-0000-000000000002' AND store_id='00000000-0000-0000-0000-000000000201' AND status='active' AND role='store_owner'),1,'L09 final Store C owner survives attempted removals');
SELECT ok((SELECT count(*) FROM qa_private.membership_audit WHERE event_type IN('INVITE','ACCEPT','REVOKE'))>=10,'L10 authority changes generate audit events');
SELECT ok((SELECT count(*) FROM public.stores WHERE slug='qa-member-f' AND status='active')=1,'L11 provisioning Store now active');

-- The executor's BYPASSRLS read can see A+B+legacy when granted SQL SELECT.
SET ROLE tien404_f_executor;
SELECT is((SELECT count(*)::integer FROM public.orders),3,'B01 internal BYPASSRLS executor can see cross-Store and legacy rows: threat demonstration');
RESET ROLE;

SET ROLE tien404_e_actor;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000001001';
SELECT is(qa_private.try_write($q$SELECT qa_private.gateway_execute('00000000-0000-0000-0000-000000009001','00000000-0000-0000-0000-000000004001','00000000-0000-0000-0000-000000000101','READ_ORDER')$q$),'42501','B02 human actor cannot call private Gateway method');
RESET ROLE;
SET ROLE tien404_f_gateway;
SELECT is(qa_private.try_write($q$SELECT count(*) FROM public.orders$q$),'42501','B03 gateway role cannot directly SELECT orders');
SELECT is(qa_private.try_write($q$UPDATE public.orders SET status='confirmed' WHERE id='00000000-0000-0000-0000-000000004002'$q$),'42501','B04 gateway role cannot directly UPDATE Store B order');
SELECT is(qa_private.try_write($q$INSERT INTO qa_private.receipts(id) VALUES('00000000-0000-0000-0000-000000009999')$q$),'42501','B05 gateway role cannot mint trusted receipt');
SELECT is(qa_private.try_write($q$SELECT qa_private.admin_invite('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000001009','store_owner')$q$),'42501','B06 gateway cannot call human membership admin method');
SELECT is(qa_private.gateway_execute('00000000-0000-0000-0000-000000009001','00000000-0000-0000-0000-000000004001','00000000-0000-0000-0000-000000000101','READ_ORDER'),'ALLOW_READ_pending','B07 valid A proof reads only A order');
SELECT is(qa_private.gateway_execute('00000000-0000-0000-0000-000000009001','00000000-0000-0000-0000-000000004001','00000000-0000-0000-0000-000000000101','READ_ORDER'),'DENY_REPLAY_OR_EXPIRED','B08 consumed receipt replay denied');
SELECT is(qa_private.gateway_execute('00000000-0000-0000-0000-000000009010','00000000-0000-0000-0000-000000004001','00000000-0000-0000-0000-000000000101','READ_ORDER'),'DENY_REPLAY_OR_EXPIRED','B09 previously used receipt denied');
SELECT is(qa_private.gateway_execute('00000000-0000-0000-0000-000000009013','00000000-0000-0000-0000-000000004001','00000000-0000-0000-0000-000000000101','READ_ORDER'),'DENY_REPLAY_OR_EXPIRED','B10 expired proof denied');
SELECT is(qa_private.gateway_execute('00000000-0000-0000-0000-000000009014','00000000-0000-0000-0000-000000004001','00000000-0000-0000-0000-000000000101','READ_ORDER'),'DENY_ATTESTATION','B11 wrong audience denied');
SELECT is(qa_private.gateway_execute('00000000-0000-0000-0000-000000009015','00000000-0000-0000-0000-000000004001','00000000-0000-0000-0000-000000000101','READ_ORDER'),'DENY_ATTESTATION','B12 not-server-verified attestation denied');
SELECT is(qa_private.gateway_execute('00000000-0000-0000-0000-000000009016','00000000-0000-0000-0000-000000004001','00000000-0000-0000-0000-000000000101','READ_ORDER'),'DENY_ATTESTATION','B13 missing owner consent denied');
SELECT is(qa_private.gateway_execute('00000000-0000-0000-0000-000000009011','00000000-0000-0000-0000-000000004001','00000000-0000-0000-0000-000000000101','READ_ORDER'),'DENY_INSTALLATION','B14 revoked provider installation denied');
SELECT is(qa_private.gateway_execute('00000000-0000-0000-0000-000000009012','00000000-0000-0000-0000-000000004001','00000000-0000-0000-0000-000000000101','READ_ORDER'),'DENY_CAPABILITY','B15 installation without read capability denied');
SELECT is(qa_private.gateway_execute('00000000-0000-0000-0000-000000009017','00000000-0000-0000-0000-000000004001','00000000-0000-0000-0000-000000000102','READ_ORDER'),'DENY_SCOPE','B16 receipt Store disagrees with installation Store');
SELECT is(qa_private.gateway_execute('00000000-0000-0000-0000-000000009018','00000000-0000-0000-0000-000000004001','00000000-0000-0000-0000-000000000101','READ_ORDER'),'DENY_SCOPE','B17 receipt Store disagrees with other installation');
SELECT is(qa_private.gateway_execute('00000000-0000-0000-0000-000000009009','00000000-0000-0000-0000-000000004002','00000000-0000-0000-0000-000000000101','READ_ORDER'),'DENY_SCOPE','B18 requested Store B order denied against A receipt');
SELECT is(qa_private.gateway_execute('00000000-0000-0000-0000-000000009008','00000000-0000-0000-0000-000000004001','00000000-0000-0000-0000-000000000102','READ_ORDER'),'DENY_SCOPE','B19 forged Store ID denied');
SELECT is(qa_private.gateway_execute('00000000-0000-0000-0000-000000009007','00000000-0000-0000-0000-000000004001','00000000-0000-0000-0000-000000000101','WRITE_CONFIRM'),'DENY_CAPABILITY','B20 forged operation denied');
SELECT is(qa_private.gateway_execute('00000000-0000-0000-0000-000000009999','00000000-0000-0000-0000-000000004001','00000000-0000-0000-0000-000000000101','READ_ORDER'),'DENY_RECEIPT_NOT_FOUND','B21 unknown proof denied');
SELECT is(qa_private.gateway_execute('00000000-0000-0000-0000-000000009005','00000000-0000-0000-0000-000000004001','00000000-0000-0000-0000-000000000101','ARBITRARY_UPDATE'),'DENY_BAD_INPUT','B22 nonallowlisted action denied');
SELECT is(qa_private.gateway_execute('00000000-0000-0000-0000-000000009002','00000000-0000-0000-0000-000000004001','00000000-0000-0000-0000-000000000101','WRITE_CONFIRM'),'ALLOW_WRITE_CONFIRMED','B23 valid single-use scoped order status transition');
SELECT is(qa_private.gateway_execute('00000000-0000-0000-0000-000000009002','00000000-0000-0000-0000-000000004001','00000000-0000-0000-0000-000000000101','WRITE_CONFIRM'),'DENY_REPLAY_OR_EXPIRED','B24 write replay denied');
SELECT is(qa_private.gateway_execute('00000000-0000-0000-0000-000000009019','00000000-0000-0000-0000-000000004001','00000000-0000-0000-0000-000000000101','WRITE_CONFIRM'),'DENY_TRANSITION','B25 second status transition denied');
RESET ROLE;
SELECT is((SELECT status FROM public.orders WHERE id='00000000-0000-0000-0000-000000004001'),'confirmed','B26 Store A status changed by approved scoped gateway command');
SELECT is((SELECT status FROM public.orders WHERE id='00000000-0000-0000-0000-000000004002'),'pending','B27 Store B order unchanged after forged gateway write');
SELECT ok((SELECT used_at IS NOT NULL FROM qa_private.receipts WHERE id='00000000-0000-0000-0000-000000009001'),'B28 READ proof atomically consumed');
SELECT ok((SELECT used_at IS NOT NULL FROM qa_private.receipts WHERE id='00000000-0000-0000-0000-000000009002'),'B29 WRITE proof atomically consumed');
SELECT ok((SELECT used_at IS NULL FROM qa_private.receipts WHERE id='00000000-0000-0000-0000-000000009009'),'B30 denied proof was not converted into write');
SELECT is(qa_private.try_write($q$INSERT INTO qa_private.receipts(id,installation_id,tenant_id,store_id,order_id,operation,audience,nonce,issued_at,expires_at,server_verified,owner_consented)
 VALUES('00000000-0000-0000-0000-000000009099','00000000-0000-0000-0000-000000008001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000004001','READ_ORDER','TIEN404_V1836F_PRIVATE_QA','synthetic-nonce-1',now(),now()+interval '1 hour',true,true)$q$),'23505','B31 duplicate idempotency nonce rejected');

SELECT * FROM finish();
\echo V18_3_6F_ADMIN_GATEWAY_PGTAP_FINISHED
