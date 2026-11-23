-- TIEN404 Config Core v1 — hosted UAT (restore-test, then staging). Owner-approved 2026-11-22 06:58 UTC.
-- One DO block; every row it creates (temp staff user, assistants, versions, connection, audit rows)
-- lives only inside the transaction: the final RAISE rolls everything back and carries the result.
-- Auth simulated like PostgREST: SET LOCAL ROLE authenticated/anon/service_role + request.jwt.claims.
-- GoTrue-signed JWT signatures are NOT exercised. Users = existing QA owners of QA Shop A / Shop B.
do $$
declare
 ta uuid := '9c8c524c-88db-4771-8ab0-a4316298494c'; tb uuid := '4b12fc28-4fc3-4b06-bbf1-72a1f62ad5c5';
 sa uuid; sb uuid; ua uuid; ub uuid; us uuid := gen_random_uuid();
 aid uuid; bid uuid; cfg jsonb; sha text; sha2 text; v int; n int; ok int := 0; bad text := '';
 procedure_result text;
begin
 select s.id into sa from public.stores s where s.tenant_id=ta and s.is_default;
 select s.id into sb from public.stores s where s.tenant_id=tb and s.is_default;
 select sm.user_id into ua from public.store_memberships sm where sm.store_id=sa and sm.role='owner' and sm.active limit 1;
 select sm.user_id into ub from public.store_memberships sm where sm.store_id=sb and sm.role='owner' and sm.active limit 1;
 if sa is null or sb is null or ua is null or ub is null then raise exception 'T404_CC_HOSTED_FIXTURE_MISSING'; end if;
 insert into auth.users(id,instance_id,aud,role,email) values (us,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','uat-cc-staff@example.invalid');
 insert into public.tenant_memberships(tenant_id,user_id,role) values (ta,us,'staff');
 insert into public.store_memberships(tenant_id,store_id,user_id,role) values (ta,sa,us,'staff');

 -- Owner A: create, edit, publish, second version, rollback
 perform set_config('request.jwt.claims', json_build_object('sub',ua,'role','authenticated')::text, true);
 execute 'set local role authenticated';
 aid := public.create_assistant(sa,'UAT trợ lý A','shop');
 select config, config_sha256 into cfg, sha from public.assistant_config_versions where assistant_id=aid and state='draft';
 if cfg->'menu'->0->>'id'='catalog' then ok:=ok+1; else bad:=bad||' A_TEMPLATE'; end if;
 cfg := jsonb_set(cfg,'{menu,3,label}','"Gặp tư vấn viên"');
 begin perform public.save_assistant_draft(aid,cfg,'stale'); bad:=bad||' STALE_ACCEPTED'; exception when sqlstate 'PT409' then ok:=ok+1; end;
 sha := public.save_assistant_draft(aid,cfg,sha);
 begin perform public.save_assistant_draft(aid,jsonb_set(cfg,'{menu,0,action_config}','{"tool":"create_order"}'),sha); bad:=bad||' INJECTION_ACCEPTED';
 exception when sqlstate '22023' then ok:=ok+1; end;
 v := public.publish_assistant_config(aid,sha); if v=1 then ok:=ok+1; else bad:=bad||' PUBLISH_V1'; end if;
 sha2 := public.save_assistant_draft(aid,jsonb_set(cfg,'{greeting}','"Chào bạn, bản 2"'),null);
 v := public.publish_assistant_config(aid,sha2); if v=2 then ok:=ok+1; else bad:=bad||' PUBLISH_V2'; end if;
 v := public.rollback_assistant_config(aid,1);
 if v=3 and (select config->>'greeting' from public.assistant_config_versions where assistant_id=aid and state='published')=cfg->>'greeting'
  then ok:=ok+1; else bad:=bad||' ROLLBACK'; end if;
 begin perform public.create_assistant(sb,'x','shop'); bad:=bad||' A_CREATE_IN_B'; exception when sqlstate '42501' then ok:=ok+1; end;
 begin perform * from public.resolve_channel_assistant('messenger','x'); bad:=bad||' A_RESOLVER'; exception when sqlstate '42501' then ok:=ok+1; end;
 begin insert into public.assistants(tenant_id,store_id,name) values (ta,sa,'x'); bad:=bad||' A_DIRECT_INSERT'; exception when sqlstate '42501' then ok:=ok+1; end;
 execute 'reset role';

 -- Owner B: isolation
 perform set_config('request.jwt.claims', json_build_object('sub',ub,'role','authenticated')::text, true);
 execute 'set local role authenticated';
 select count(*) into n from public.assistants where id=aid; if n=0 then ok:=ok+1; else bad:=bad||' B_SEES_A'; end if;
 select count(*) into n from public.assistant_config_versions where assistant_id=aid; if n=0 then ok:=ok+1; else bad:=bad||' B_SEES_A_VERSIONS'; end if;
 begin perform public.save_assistant_draft(aid,cfg,null); bad:=bad||' B_EDITS_A'; exception when sqlstate '42501' then ok:=ok+1; end;
 begin perform public.rollback_assistant_config(aid,1); bad:=bad||' B_ROLLBACK_A'; exception when sqlstate '42501' then ok:=ok+1; end;
 bid := public.create_assistant(sb,'UAT trợ lý B','artist');
 execute 'reset role';

 -- Staff of A: read only
 perform set_config('request.jwt.claims', json_build_object('sub',us,'role','authenticated')::text, true);
 execute 'set local role authenticated';
 select count(*) into n from public.assistants where id=aid; if n=1 then ok:=ok+1; else bad:=bad||' STAFF_CANNOT_READ'; end if;
 select count(*) into n from public.assistants where id=bid; if n=0 then ok:=ok+1; else bad:=bad||' STAFF_SEES_B'; end if;
 begin perform public.save_assistant_draft(aid,cfg,null); bad:=bad||' STAFF_EDITS'; exception when sqlstate '42501' then ok:=ok+1; end;
 execute 'reset role';

 -- anon
 perform set_config('request.jwt.claims', '{"role":"anon"}', true);
 execute 'set local role anon';
 begin select count(*) into n from public.assistants; bad:=bad||' ANON_READS'; exception when sqlstate '42501' then ok:=ok+1; end;
 begin perform public.create_assistant(sa,'x','shop'); bad:=bad||' ANON_CREATES'; exception when sqlstate '42501' then ok:=ok+1; end;
 execute 'reset role';

 -- service_role: bind a fake account and resolve
 perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
 execute 'set local role service_role';
 insert into public.channel_connections(tenant_id,store_id,assistant_id,channel,external_account_id,environment,status)
  values (ta,sa,aid,'web','uat-cc-site','staging','active');
 begin
  insert into public.channel_connections(tenant_id,store_id,assistant_id,channel,external_account_id,environment,status)
   values (tb,sb,bid,'web','uat-cc-site','staging','active');
  bad:=bad||' ACCOUNT_BOUND_TWICE';
 exception when unique_violation then ok:=ok+1; end;
 select count(*) into n from public.resolve_channel_assistant('web','uat-cc-site') r where r.tenant_id=ta and r.version_no=3;
 if n=1 then ok:=ok+1; else bad:=bad||' RESOLVER'; end if;
 execute 'reset role';

 select count(*) into n from app_private.audit_events where event_type like 'assistant_%' and created_at > now() - interval '5 minutes';
 if n>=7 then ok:=ok+1; else bad:=bad||' AUDIT'; end if;

 raise exception 'T404_CC_HOSTED_UAT pass=% fail=[%] ROLLED_BACK', ok, btrim(bad);
end $$;
