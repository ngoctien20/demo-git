-- V17.2C.30 EPHEMERAL CI ONLY. Contract candidate, not Commerce deployment DDL.
-- Synthetic orders A/B same tenant and C in another tenant. All writes happen
-- on GitHub Actions' isolated Postgres 17 service; never a Supabase project.
CREATE SCHEMA tien404_v172c30_orders_qa;
REVOKE ALL ON SCHEMA tien404_v172c30_orders_qa FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA tien404_v172c30_orders_qa TO authenticated;

CREATE TABLE tien404_v172c30_orders_qa.memberships(
 tenant_id text NOT NULL,store_id text NOT NULL,subject_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN ('owner','viewer')),
 active boolean NOT NULL DEFAULT false,
 PRIMARY KEY(tenant_id,store_id,subject_id)
);
CREATE TABLE tien404_v172c30_orders_qa.orders(
 order_id text PRIMARY KEY,
 tenant_id text NOT NULL,store_id text NOT NULL,
 status text NOT NULL CHECK(status IN ('pending','confirmed','completed','cancelled')),
 total_vnd bigint NOT NULL CHECK(total_vnd>=0),
 CHECK(length(order_id)>0 AND length(tenant_id)>0 AND length(store_id)>0)
);
CREATE INDEX ON tien404_v172c30_orders_qa.memberships(subject_id,active,tenant_id,store_id);
CREATE INDEX ON tien404_v172c30_orders_qa.orders(tenant_id,store_id);

INSERT INTO tien404_v172c30_orders_qa.memberships
(tenant_id,store_id,subject_id,role,active) VALUES
('tenant-1','store-A','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owner',true),
('tenant-1','store-B','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','owner',true),
('tenant-2','store-C','cccccccc-cccc-4ccc-8ccc-cccccccccccc','owner',true),
('tenant-1','store-B','dddddddd-dddd-4ddd-8ddd-dddddddddddd','viewer',true);
INSERT INTO tien404_v172c30_orders_qa.orders
(order_id,tenant_id,store_id,status,total_vnd) VALUES
('SYN-ORDER-A','tenant-1','store-A','pending',159000),
('SYN-ORDER-B','tenant-1','store-B','pending',259000),
('SYN-ORDER-C','tenant-2','store-C','pending',359000);

ALTER TABLE tien404_v172c30_orders_qa.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE tien404_v172c30_orders_qa.memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE tien404_v172c30_orders_qa.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tien404_v172c30_orders_qa.orders FORCE ROW LEVEL SECURITY;
CREATE POLICY own_membership ON tien404_v172c30_orders_qa.memberships
 FOR SELECT TO authenticated
 USING(active AND subject_id=(SELECT auth.uid()));
CREATE POLICY own_order_read ON tien404_v172c30_orders_qa.orders
 FOR SELECT TO authenticated
 USING(EXISTS (
  SELECT 1 FROM tien404_v172c30_orders_qa.memberships m
  WHERE m.tenant_id=orders.tenant_id AND m.store_id=orders.store_id
   AND m.subject_id=(SELECT auth.uid()) AND m.active
 ));
CREATE POLICY owner_status_change ON tien404_v172c30_orders_qa.orders
 FOR UPDATE TO authenticated
 USING(EXISTS (
  SELECT 1 FROM tien404_v172c30_orders_qa.memberships m
  WHERE m.tenant_id=orders.tenant_id AND m.store_id=orders.store_id
    AND m.subject_id=(SELECT auth.uid()) AND m.role='owner' AND m.active
 ))
 WITH CHECK(EXISTS (
  SELECT 1 FROM tien404_v172c30_orders_qa.memberships m
  WHERE m.tenant_id=orders.tenant_id AND m.store_id=orders.store_id
    AND m.subject_id=(SELECT auth.uid()) AND m.role='owner' AND m.active
 ));
REVOKE ALL ON ALL TABLES IN SCHEMA tien404_v172c30_orders_qa FROM PUBLIC,anon,authenticated;
GRANT SELECT ON tien404_v172c30_orders_qa.memberships,
 tien404_v172c30_orders_qa.orders TO authenticated;
-- Explicitly scoped status field only. CI tests below always ROLLBACK.
GRANT UPDATE(status) ON tien404_v172c30_orders_qa.orders TO authenticated;
