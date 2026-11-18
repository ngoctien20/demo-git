-- V17.2C.15: synthetic disposable fixture for ephemeral CI PostgreSQL ONLY.
-- Neither credential nor customer data. Actor IDs are static test constants only.
INSERT INTO auth.users(id) VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO tien404_v172c10_disposable.qa_tenants(tenant_id,label)
VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','synthetic');
INSERT INTO tien404_v172c10_disposable.qa_stores(tenant_id,store_id,label) VALUES
('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','Store A'),
('dddddddd-dddd-4ddd-8ddd-dddddddddddd','22222222-2222-4222-8222-222222222222','Store B');
INSERT INTO tien404_v172c10_disposable.qa_store_memberships
(tenant_id,store_id,user_id,role,active) VALUES
('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owner',true),
('dddddddd-dddd-4ddd-8ddd-dddddddddddd','22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','owner',true);
INSERT INTO tien404_v172c10_disposable.qa_catalog
(tenant_id,store_id,sku,name,price_vnd,stock_on_hand) VALUES
('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','QA-A','Synthetic A',100,1),
('dddddddd-dddd-4ddd-8ddd-dddddddddddd','22222222-2222-4222-8222-222222222222','QA-B','Synthetic B',200,1);
