-- Bind the DEMO Messenger Page to a published assistant of QA Shop A on STAGING (environment 'demo').
-- Owner-approved 2026-11-22 07:23 UTC (decision card option A). Idempotent: does nothing if the Page
-- is already bound. Only effect: get_channel_menu('messenger','2379295362359912') returns this menu.
-- Nothing reads it in production (the n8n bridge is an unpublished draft). Undo: unbind-demo-page.sql.
\set ON_ERROR_STOP on
BEGIN;
DO $$
declare
 ta uuid := '9c8c524c-88db-4771-8ab0-a4316298494c'; sa uuid; ua uuid; aid uuid; sha text; page text := '2379295362359912';
begin
 if exists (select 1 from public.channel_connections where channel='messenger' and external_account_id=page) then
  raise notice 'T404_CC20_DEMO_ALREADY_BOUND'; return;
 end if;
 select s.id into sa from public.stores s where s.tenant_id=ta and s.is_default;
 select sm.user_id into ua from public.store_memberships sm where sm.store_id=sa and sm.role='owner' and sm.active limit 1;
 if sa is null or ua is null then raise exception 'T404_CC20_DEMO_FIXTURE_MISSING'; end if;
 perform set_config('request.jwt.claims', json_build_object('sub',ua,'role','authenticated')::text, true);
 execute 'set local role authenticated';
 aid := public.create_assistant(sa,'Trợ lý Messenger demo','shop');
 select config_sha256 into sha from public.assistant_config_versions where assistant_id=aid and state='draft';
 perform public.publish_assistant_config(aid,sha);
 execute 'reset role';
 insert into public.channel_connections(tenant_id,store_id,assistant_id,channel,external_account_id,display_name,environment,status)
  values (ta,sa,aid,'messenger',page,'TIEN404 demo Page','demo','active');
end $$;
SELECT 'T404_CC20_DEMO_BOUND' AS marker;
COMMIT;
