-- Disposable PostgreSQL only. Requires the staging schema and the two-shop allowlisted RPC.
BEGIN;
DO $$
DECLARE
  qa_shop constant uuid := '9c8c524c-88db-4771-8ab0-a4316298494c';
  other_shop uuid := gen_random_uuid();
  actor uuid;
  test_role text;
BEGIN
  IF current_database() <> 'tien404_disposable_qa' THEN
    RAISE EXCEPTION 'requires disposable QA database';
  END IF;
  INSERT INTO public.tenants(id,slug,name) VALUES
    (qa_shop,'qa-staging-shop-a-20261110','QA shop'),(other_shop,'excluded-shop','Excluded shop');
  FOREACH test_role IN ARRAY ARRAY['manager','staff','inactive','nonmember'] LOOP
    actor := gen_random_uuid();
    INSERT INTO auth.users(id) VALUES(actor);
    IF test_role <> 'nonmember' THEN
      INSERT INTO public.tenant_memberships(tenant_id,user_id,role,active)
        VALUES (qa_shop,actor,CASE WHEN test_role='inactive' THEN 'manager' ELSE test_role END,test_role<>'inactive');
    END IF;
    INSERT INTO public.tenant_memberships(tenant_id,user_id,role) VALUES (other_shop,actor,'owner');
    PERFORM set_config('request.jwt.claim.sub',actor::text,true);
    SET LOCAL ROLE authenticated;
    IF test_role='manager' THEN
      PERFORM public.save_merchant_product(qa_shop,'ROLE-QA','QA',10,true,1,NULL);
    ELSE
      BEGIN PERFORM public.save_merchant_product(qa_shop,test_role,'QA',10,true,1,NULL);
        RAISE EXCEPTION 'unauthorized role accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    END IF;
    BEGIN PERFORM public.save_merchant_product(other_shop,test_role,'QA',10,true,1,NULL);
      RAISE EXCEPTION 'owner outside allowlist accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    RESET ROLE;
  END LOOP;
  IF (SELECT count(*) FROM public.products WHERE tenant_id IN (qa_shop,other_shop)) <> 1 THEN
    RAISE EXCEPTION 'unexpected product count'; END IF;
END $$;
ROLLBACK;
