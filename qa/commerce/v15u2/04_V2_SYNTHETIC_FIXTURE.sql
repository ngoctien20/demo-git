-- Disposable-only synthetic v2 fixture; same Tenant qa-tenant-a, two distinct Stores.
BEGIN;
INSERT INTO tien404_r1_qa.tenant_authorities_v2(tenant_key,auth_tenant_id) VALUES
 ('qa-tenant-a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('qa-tenant-b','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO tien404_r1_qa.stores_v2(tenant_key,store_key,status) VALUES
 ('qa-tenant-a','qa-store-a','active'),
 ('qa-tenant-a','qa-store-a2','active'),
 ('qa-tenant-b','qa-store-b','active');
INSERT INTO tien404_r1_qa.store_bot_identity_map_v2
 (tenant_key,store_key,bot_key,channel,external_bot_hash,status,valid_from,expires_at) VALUES
 ('qa-tenant-a','qa-store-a','qa-bot-a','qa-fixture',repeat('a',64),'active',now()-interval '1 hour',now()+interval '1 day'),
 ('qa-tenant-a','qa-store-a2','qa-bot-a2','qa-fixture',repeat('b',64),'active',now()-interval '1 hour',now()+interval '1 day'),
 ('qa-tenant-b','qa-store-b','qa-bot-b','qa-fixture',repeat('c',64),'active',now()-interval '1 hour',now()+interval '1 day');
INSERT INTO tien404_r1_qa.store_reader_memberships_v2
 (subject_id,tenant_key,store_key,permission,status,expires_at) VALUES
 ('11111111-1111-4111-8111-111111111111','qa-tenant-a','qa-store-a','catalog_read','active',now()+interval '1 day'),
 ('22222222-2222-4222-8222-222222222222','qa-tenant-a','qa-store-a2','catalog_read','active',now()+interval '1 day'),
 ('33333333-3333-4333-8333-333333333333','qa-tenant-b','qa-store-b','catalog_read','active',now()+interval '1 day');
COMMIT;