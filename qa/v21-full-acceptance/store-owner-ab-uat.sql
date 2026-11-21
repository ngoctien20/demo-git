-- V21 Round 3a: Store Authority UAT Owner A/B on Supabase STAGING (read-only in effect).
-- Runs as one DO block; every fixture row lives only inside the transaction and the final
-- RAISE EXCEPTION rolls everything back. The result string is carried in the error message.
-- Auth is simulated the way PostgREST does it: SET LOCAL ROLE authenticated/anon +
-- request.jwt.claims {sub, role}. GoTrue-issued JWT signatures are NOT exercised here.
-- Users: A = owner tenant A/store SA; B = owner tenant B/store SB;
--        M = temp user, tenant A owner but manager of a temp second store S2 only.
-- Expected and observed (2026-11-21 13:3x UTC):
--   A: sees only SA rows; direct INSERT/UPDATE denied; RPC create in tenant A ok, tenant B denied;
--      edit of S2 product denied; revenue A ok, B denied.
--   B: mirror of A.
--   M: sees only S2 product (not SA); RPC create via default store SA denied; edit S2 ok.
--   anon: tables and RPC denied (42501).
-- After run: stores=2 products=2 users=3 store_memberships=3 tenant_memberships=3, 0 UAT rows.
-- ids below are the staging synthetic QA tenants/stores/owners.
do $$
declare
 r text := '';
 ta uuid := '9c8c524c-88db-4771-8ab0-a4316298494c'; tb uuid := '4b12fc28-4fc3-4b06-bbf1-72a1f62ad5c5';
 sa uuid := '21b26638-96df-46dc-8471-c0ed9ca9a7ae'; sb uuid := 'f5a1ec49-f2fd-416f-8b20-43e5e55289b3';
 ua uuid := '9f8a880f-aaf1-4481-8d0d-f46c863964a7'; ub uuid := '2b12df31-b275-41f4-a4fa-d17308b22d38';
 um uuid := gen_random_uuid(); sa2 uuid := gen_random_uuid();
 n int; s text; u uuid;
begin
 insert into public.stores(id,tenant_id,store_key,name) values (sa2,ta,'uat-v21-store-2','UAT V21 Store 2');
 insert into public.products(tenant_id,store_id,sku,name,price_vnd) values (ta,sa2,'UAT-V21-SKU-S2','UAT product S2',1000);
 insert into auth.users(id,instance_id,aud,role,email) values (um,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','uat-v21-manager@example.invalid');
 insert into public.tenant_memberships(tenant_id,user_id,role) values (ta,um,'owner');
 insert into public.store_memberships(tenant_id,store_id,user_id,role) values (ta,sa2,um,'manager');
 foreach u in array array[ua,ub,um] loop
  perform set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  s := case u when ua then 'A' when ub then 'B' else 'M' end;
  r := r || format(E'\n%s: stores=%s prodA=%s prodB=%s prodS2=%s ordA=%s ordB=%s custA=%s custB=%s memb=%s',
   s,(select count(*) from public.stores),
   (select count(*) from public.products where store_id=sa),(select count(*) from public.products where store_id=sb),
   (select count(*) from public.products where store_id=sa2),
   (select count(*) from public.orders where store_id=sa),(select count(*) from public.orders where store_id=sb),
   (select count(*) from public.customers where store_id=sa),(select count(*) from public.customers where store_id=sb),
   (select count(*) from public.store_memberships));
  begin insert into public.products(tenant_id,store_id,sku,name,price_vnd) values (ta,sa,'X','x',1); r:=r||' directInsert=ALLOWED'; exception when others then r:=r||' directInsert=DENIED('||sqlstate||')'; end;
  begin update public.products set price_vnd=price_vnd where true; get diagnostics n=row_count; r:=r||' directUpdate='||n; exception when others then r:=r||' directUpdate=DENIED('||sqlstate||')'; end;
  begin perform public.save_merchant_product(ta,'UAT-RPC-'||s,'uat',1000,true,0,null); r:=r||' rpcCreateTenantA=OK'; exception when others then r:=r||' rpcCreateTenantA=DENIED('||sqlstate||')'; end;
  begin perform public.save_merchant_product(tb,'UAT-RPC-'||s,'uat',1000,true,0,null); r:=r||' rpcCreateTenantB=OK'; exception when others then r:=r||' rpcCreateTenantB=DENIED('||sqlstate||')'; end;
  begin perform public.save_merchant_product(ta,'UAT-V21-SKU-S2','uat',2000,true,null,now()); r:=r||' rpcEditS2=OK'; exception when others then r:=r||' rpcEditS2=DENIED('||sqlstate||')'; end;
  begin perform public.merchant_revenue_v3(tb,current_date-30,current_date); r:=r||' revenueB=OK'; exception when others then r:=r||' revenueB=DENIED('||sqlstate||')'; end;
  begin perform public.merchant_revenue_v3(ta,current_date-30,current_date); r:=r||' revenueA=OK'; exception when others then r:=r||' revenueA=DENIED('||sqlstate||')'; end;
  execute 'reset role';
 end loop;
 perform set_config('request.jwt.claims', '{"role":"anon"}', true);
 execute 'set local role anon';
 begin r := r || E'\nanon: products='||(select count(*) from public.products); exception when others then r:=r||E'\nanon: products=DENIED('||sqlstate||')'; end;
 begin r := r || ' stores='||(select count(*) from public.stores); exception when others then r:=r||' stores=DENIED('||sqlstate||')'; end;
 begin perform public.save_merchant_product(ta,'UAT-ANON','x',1,true,0,null); r:=r||' rpc=OK'; exception when others then r:=r||' rpc=DENIED('||sqlstate||')'; end;
 execute 'reset role';
 raise exception 'UAT_RESULT_ROLLED_BACK%', r;
end $$;
