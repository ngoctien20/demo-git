-- TIEN404 RPC.9: disposable PG17 synthetic Store and cross-Store Commerce fixture.
-- No Supabase, production SQL, or real owner records.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'t404_rpc8_ci'
   OR current_user<>'postgres'
   OR current_setting('tien404.rpc8_ephemeral',true)<>'RPC8_DISPOSABLE'
   OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 THEN RAISE EXCEPTION 'RPC9_DISPOSABLE_PG17_ONLY'; END IF;
 IF to_regclass('qa_rpc8.stores') IS NULL
   OR (SELECT count(*) FROM qa_rpc8.products)<>2
   OR (SELECT count(*) FROM qa_rpc8.orders)<>2
   OR (SELECT count(*) FROM qa_rpc8.stores)<>0
 THEN RAISE EXCEPTION 'RPC9_M1_DISPOSABLE_BASELINE_NOT_CLEAN';END IF;
END $guard$;
-- Owner A, Manager B share Tenant 1. Owner C belongs to Tenant 2.
UPDATE qa_rpc8.tenant_memberships SET role='manager'
 WHERE tenant_id='11111111-1111-4111-8111-111111111111'
 AND user_id='bbbbbbbb-0000-4000-8000-000000000002';
INSERT INTO qa_rpc8.stores(id,tenant_id,code) VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','qa-a'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','qa-b'),
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','22222222-2222-4222-8222-222222222222','qa-c');
INSERT INTO qa_rpc8.store_memberships(tenant_id,store_id,user_id,role) VALUES
('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000001','owner'),
('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','bbbbbbbb-0000-4000-8000-000000000002','manager'),
('22222222-2222-4222-8222-222222222222','cccccccc-cccc-4ccc-8ccc-cccccccccccc','cccccccc-0000-4000-8000-000000000003','owner');
-- Third synthetic Product/Order in same Tenant tests future multi-Store;
-- EXISTING hosted has only 2 Products and 2 Orders across two separate Tenants.
INSERT INTO qa_rpc8.products(id,tenant_id,sku,price_vnd,stock_on_hand)
 VALUES('bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb',
'11111111-1111-4111-8111-111111111111','QA-B-ONLY',189000,9);
INSERT INTO qa_rpc8.orders(id,tenant_id,customer_id,status,total_vnd)
 VALUES('bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb',
'11111111-1111-4111-8111-111111111111',NULL,'pending',189000);
