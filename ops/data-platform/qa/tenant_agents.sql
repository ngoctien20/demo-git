-- Synthetic database only. Roll back all users, shops and assignments.
BEGIN;
INSERT INTO auth.users VALUES ('aaaaaaaa-0000-4000-8000-000000000001'),('bbbbbbbb-0000-4000-8000-000000000002'),('cccccccc-0000-4000-8000-000000000003');
INSERT INTO public.tenants(id,slug,name) VALUES
 ('10000000-0000-4000-8000-000000000001','pilot-a','QA A'),('10000000-0000-4000-8000-000000000002','pilot-b','QA B');
INSERT INTO public.tenant_memberships(tenant_id,user_id,role) VALUES
 ('10000000-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001','owner'),
 ('10000000-0000-4000-8000-000000000002','bbbbbbbb-0000-4000-8000-000000000002','manager'),
 ('10000000-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000003','staff');
INSERT INTO public.tenant_agent_configs(tenant_id,channel,bot_id,workflow_version,prompt_version,knowledge_version,model)
 SELECT id,'pilot_lab','NvQfIffOrZokPBPW','4c2575de-5a92-41aa-88ab-c84f7e2e7e9f',slug,'qa','gpt-5-mini' FROM public.tenants;
INSERT INTO public.orders(tenant_id,status,total_vnd,created_at)
VALUES ('10000000-0000-4000-8000-000000000001','paid',159000,now()),
       ('10000000-0000-4000-8000-000000000001','refunded',20000,now()),
       ('10000000-0000-4000-8000-000000000001','paid',99000,now()-interval '14 days'),
       ('10000000-0000-4000-8000-000000000002','paid',75000,now());
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  row record;
  seen integer;
BEGIN
  FOR row IN SELECT * FROM (VALUES
    ('aaaaaaaa-0000-4000-8000-000000000001','pilot-a',1), ('bbbbbbbb-0000-4000-8000-000000000002','pilot-b',1),
    ('cccccccc-0000-4000-8000-000000000003','',0), ('dddddddd-0000-4000-8000-000000000004','',0)
  ) AS identities(uid,expected,visible)
  LOOP
    PERFORM set_config('request.jwt.claim.sub',row.uid,true);
    SELECT count(*) INTO seen FROM public.tenant_agent_configs;
    IF seen<>row.visible OR EXISTS (SELECT 1 FROM public.tenant_agent_configs WHERE prompt_version<>row.expected)
    THEN RAISE EXCEPTION 'agent tenant isolation failure'; END IF;
  END LOOP;
  IF has_table_privilege('anon','public.tenant_agent_configs','SELECT') OR
     has_any_column_privilege(current_user,'public.tenant_agent_configs','UPDATE') OR
     has_table_privilege(current_user,'public.tenant_agent_configs','INSERT') OR
     has_table_privilege(current_user,'public.tenant_agent_configs','DELETE') THEN RAISE EXCEPTION 'unexpected privileges'; END IF;
END $$;
DO $$
DECLARE shop_a uuid := '10000000-0000-4000-8000-000000000001';
BEGIN
  PERFORM set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000001',true);
  IF (SELECT sum(paid_vnd::numeric) FROM public.merchant_paid_orders_daily(shop_a,7)) IS DISTINCT FROM 159000
     OR (SELECT sum(order_count) FROM public.merchant_paid_orders_daily(shop_a,7)) IS DISTINCT FROM 2
     OR (SELECT sum(paid_vnd::numeric) FROM public.merchant_paid_orders_daily(shop_a,30)) IS DISTINCT FROM 258000
  THEN RAISE EXCEPTION 'invalid summary'; END IF;
  BEGIN PERFORM * FROM public.merchant_paid_orders_daily(shop_a,365);
    RAISE EXCEPTION 'invalid period accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub','bbbbbbbb-0000-4000-8000-000000000002',true);
  BEGIN PERFORM * FROM public.merchant_paid_orders_daily(shop_a,7);
    RAISE EXCEPTION 'foreign summary read'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub','cccccccc-0000-4000-8000-000000000003',true);
  BEGIN PERFORM * FROM public.merchant_paid_orders_daily(shop_a,7);
    RAISE EXCEPTION 'staff read'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  IF has_function_privilege('anon','public.merchant_paid_orders_daily(uuid,integer)','EXECUTE')
    THEN RAISE EXCEPTION 'anon execute'; END IF;
END $$;
ROLLBACK;
