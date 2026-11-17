-- RPC17.8A disposable PostgreSQL 17 only. No Supabase connection.
\set ON_ERROR_STOP on
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace
 WHERE s.nspname='rpc178_qa' AND c.relkind='r'
   AND c.relname IN ('tenants','stores','memberships','products')
   AND c.relrowsecurity AND c.relforcerowsecurity;
 IF n<>4 THEN RAISE EXCEPTION 'RPC178A FAIL: RLS/FORCE RLS missing on % of four tables',4-n; END IF;
 RAISE NOTICE 'RPC178A PASS: forced RLS on four tables';
 SELECT count(*) INTO n FROM pg_policies WHERE schemaname='rpc178_qa';
 IF n<>0 THEN RAISE EXCEPTION 'RPC178A FAIL: unexpected RLS policy count %',n; END IF;
 RAISE NOTICE 'RPC178A PASS: no policy -> deny by default';
 SELECT count(*) INTO n FROM information_schema.tables WHERE table_schema='rpc178_qa' AND table_type='BASE TABLE';
 IF n<>4 THEN RAISE EXCEPTION 'RPC178A FAIL: table count %',n; END IF;
 RAISE NOTICE 'RPC178A PASS: exact candidate tables';
END $$;
DO $$
DECLARE role_name text;
BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role']
 LOOP
  IF has_schema_privilege(role_name,'rpc178_qa','USAGE') THEN RAISE EXCEPTION 'RPC178A FAIL: % has schema usage',role_name; END IF;
  IF has_schema_privilege(role_name,'rpc178_qa','CREATE') THEN RAISE EXCEPTION 'RPC178A FAIL: % has schema create',role_name; END IF;
  IF has_table_privilege(role_name,'rpc178_qa.products','SELECT,INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'RPC178A FAIL: % has products table privilege',role_name; END IF;
  RAISE NOTICE 'RPC178A PASS: % has no QA schema/table access',role_name;
 END LOOP;
 IF EXISTS (SELECT 1 FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) AS a WHERE n.nspname='rpc178_qa' AND a.grantee=0 AND a.privilege_type IN ('USAGE','CREATE')) THEN RAISE EXCEPTION 'RPC178A FAIL: PUBLIC role has schema access'; END IF;
 RAISE NOTICE 'RPC178A PASS: PUBLIC has no schema usage';
END $$;
-- Table FK and member role/version constraints, synthetic row seeded only in disposable CI.
INSERT INTO rpc178_qa.tenants(tenant_id) VALUES ('11111111-1111-4111-8111-111111111111');
INSERT INTO rpc178_qa.stores(tenant_id,store_id,is_active,authority_version)
 VALUES ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',false,1),
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',false,1);
INSERT INTO rpc178_qa.memberships(tenant_id,store_id,user_id,role,is_active,authority_version)
 VALUES ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
         'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','owner',false,1);
INSERT INTO rpc178_qa.products(product_id,tenant_id,store_id,sku)
 VALUES ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1','11111111-1111-4111-8111-111111111111',
         'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','QA-SKU-A');
DO $$BEGIN RAISE NOTICE 'RPC178A PASS: synthetic additive FK fixture seeded in disposable PG17'; END $$;
