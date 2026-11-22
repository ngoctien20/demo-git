-- TIEN404 Config Core step 20 (get_channel_menu) — hosted UAT. Owner-approved 2026-11-22 07:23 UTC
-- (decision card: "Hàm chỉ-đọc cho anon"). One DO block; the final RAISE rolls every row back.
-- Uses a fake account id so it never collides with the real demo Page binding.
do $$
declare
 ta uuid := '9c8c524c-88db-4771-8ab0-a4316298494c'; tb uuid := '4b12fc28-4fc3-4b06-bbf1-72a1f62ad5c5';
 sa uuid; ua uuid; aid uuid; cfg jsonb; sha text; m jsonb; ok int := 0; bad text := ''; acct text := 'uat-cc20-000000';
begin
 select s.id into sa from public.stores s where s.tenant_id=ta and s.is_default;
 select sm.user_id into ua from public.store_memberships sm where sm.store_id=sa and sm.role='owner' and sm.active limit 1;
 if sa is null or ua is null then raise exception 'T404_CC20_HOSTED_FIXTURE_MISSING'; end if;
 perform set_config('request.jwt.claims', json_build_object('sub',ua,'role','authenticated')::text, true);
 execute 'set local role authenticated';
 aid := public.create_assistant(sa,'UAT cc20','shop');
 select config, config_sha256 into cfg, sha from public.assistant_config_versions where assistant_id=aid and state='draft';
 perform public.publish_assistant_config(aid,sha);
 -- new draft that must never leak
 perform public.save_assistant_draft(aid,jsonb_set(cfg,'{greeting}','"BẢN NHÁP KHÔNG ĐƯỢC LỘ"'),null);
 execute 'reset role';
 insert into public.channel_connections(tenant_id,store_id,assistant_id,channel,external_account_id,environment,status)
  values (ta,sa,aid,'messenger',acct,'staging','active');

 execute 'set local role anon';
 m := public.get_channel_menu('messenger',acct);
 if m->>'version_no'='1' and jsonb_array_length(m->'menu')>0 then ok:=ok+1; else bad:=bad||' ANON_READ'; end if;
 if m::text !~ (ta::text||'|'||sa::text||'|'||aid::text||'|tenant|store_id|assistant_id') then ok:=ok+1; else bad:=bad||' IDS_LEAK'; end if;
 if m::text !~ 'BẢN NHÁP' then ok:=ok+1; else bad:=bad||' DRAFT_LEAK'; end if;
 if not exists (select 1 from jsonb_array_elements(m->'menu') i where i->'enabled' <> 'true'::jsonb) then ok:=ok+1; else bad:=bad||' DISABLED_LEAK'; end if;
 if public.get_channel_menu('messenger','nope-000') is null then ok:=ok+1; else bad:=bad||' UNKNOWN_NOT_NULL'; end if;
 if public.get_channel_menu('sms',acct) is null then ok:=ok+1; else bad:=bad||' CHANNEL_NOT_NULL'; end if;
 begin perform count(*) from public.channel_connections; bad:=bad||' ANON_TABLE'; exception when sqlstate '42501' then ok:=ok+1; end;
 begin perform count(*) from public.assistant_config_versions; bad:=bad||' ANON_VERSIONS'; exception when sqlstate '42501' then ok:=ok+1; end;
 execute 'reset role';
 update public.channel_connections set status='disabled' where external_account_id=acct;
 execute 'set local role anon';
 if public.get_channel_menu('messenger',acct) is null then ok:=ok+1; else bad:=bad||' DISABLED_CONN_NOT_NULL'; end if;
 execute 'reset role';
 raise exception 'T404_CC20_HOSTED_UAT pass=% fail=[%]', ok, btrim(bad);
end $$;
